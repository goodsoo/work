import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createMeeting,
  deleteMeeting,
  getMeeting,
  listDeletedMeetings,
  listMeetings,
  purgeMeeting,
  restoreMeeting,
  updateMeeting,
  type Meeting,
  type MeetingInsert,
  type MeetingUpdate,
} from "../api/meetings";
import { summaryPath, transcriptPath } from "../lib/vault/scan";
import { useVault } from "../lib/vault/useVault";
import type { VaultWatcher } from "../lib/vault/watcher";

// 한 회의는 메인 + 2 sidecar 파일이라 자기 write 마크도 셋 다. path 기반.
function markMeetingSelfWrite(watcher: VaultWatcher, path: string): void {
  watcher.markSelfWrite(path);
  watcher.markSelfWrite(transcriptPath(path));
  watcher.markSelfWrite(summaryPath(path));
}

const meetingsKey = ["meetings"] as const;
const deletedMeetingsKey = ["meetings", "deleted"] as const;
// detail cache key 는 uid (frontmatter 의 영구 id) 기반. path rename 에 영향 받지 않음.
const meetingKey = (uid: string) => ["meetings", "detail", uid] as const;

// uid → file path lookup. list query cache 에 의존. list 가 active 면 항상 valid.
function uidToPath(qc: QueryClient, uid: string): string | undefined {
  const list = qc.getQueryData<Meeting[]>(meetingsKey);
  return list?.find((m) => m.uid === uid)?.id;
}

// 새 메모 직후 자동 focus 용 1회성 flag. useCreateMeeting 가 set, MeetingForm 가 consume.
let _justCreatedMeetingUid: string | null = null;
export function consumeJustCreatedMeetingUid(uid: string): boolean {
  if (_justCreatedMeetingUid === uid) {
    _justCreatedMeetingUid = null;
    return true;
  }
  return false;
}

// patch 형식 (string | null | array) 을 Meeting 의 정규 type 으로 변환.
function normalizeAttendeesPatch(v: MeetingUpdate["attendees"]): string[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) {
    return v.filter((s): s is string => typeof s === "string");
  }
  if (typeof v === "string") {
    return v.trim() === ""
      ? []
      : v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function applyOptimisticPatch(prev: Meeting, patch: MeetingUpdate): Meeting {
  const out: Meeting = { ...prev };
  if (patch.title !== undefined) out.title = patch.title ?? "";
  if (patch.date !== undefined) out.date = patch.date ?? null;
  if (patch.time !== undefined) out.time = patch.time ?? null;
  if (patch.attendees !== undefined) {
    out.attendees = normalizeAttendeesPatch(patch.attendees);
  }
  if (patch.tags !== undefined) out.tags = patch.tags ?? [];
  if (patch.content !== undefined) out.content = patch.content ?? "";
  if (patch.transcript !== undefined) out.transcript = patch.transcript ?? "";
  if (patch.discussion_items !== undefined) {
    out.discussion_items = patch.discussion_items ?? [];
  }
  if (patch.decisions !== undefined) out.decisions = patch.decisions ?? [];
  if (patch.action_items !== undefined) {
    out.action_items = patch.action_items ?? [];
  }
  return out;
}

export function useMeetings() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: meetingsKey,
    queryFn: () => listMeetings(adapter),
    enabled: isReady,
  });
}

export function useDeletedMeetings() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: deletedMeetingsKey,
    queryFn: () => listDeletedMeetings(adapter),
    enabled: isReady,
  });
}

export function useMeeting(uid: string | undefined) {
  const { adapter, isReady } = useVault();
  const qc = useQueryClient();
  return useQuery({
    queryKey: uid ? meetingKey(uid) : ["meetings", "none"],
    queryFn: async () => {
      if (!uid) return null;
      const path = uidToPath(qc, uid);
      if (!path) return null; // list cache miss — 다음 list refetch 후 사용자가 재시도.
      return getMeeting(adapter, path);
    },
    enabled: !!uid && isReady,
  });
}

export function useCreateMeeting() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MeetingInsert) => {
      const created = await createMeeting(adapter, input);
      markMeetingSelfWrite(watcher, created.id);
      _justCreatedMeetingUid = created.uid;
      return created;
    },
    onSuccess: (created) => {
      qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
        prev ? [created, ...prev] : [created],
      );
      qc.setQueryData(meetingKey(created.uid), created);
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

export function useUpdateMeeting(uid: string) {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    // 같은 메모에 대한 mutation 직렬화 (uid 기반 scope — path rename 무관).
    scope: { id: `meeting:${uid}` },
    mutationFn: async (patch: MeetingUpdate) => {
      // uid 는 영구 — list cache 에서 현재 path 조회.
      const path = uidToPath(qc, uid);
      if (!path) throw new Error(`meeting not found: uid=${uid}`);
      markMeetingSelfWrite(watcher, path);
      const updated = await updateMeeting(adapter, path, patch);
      if (updated.id !== path) {
        // rename 발생 — 새 path 도 self-write 마크.
        markMeetingSelfWrite(watcher, updated.id);
      }
      return updated;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: meetingKey(uid) });
      const prevDetail = qc.getQueryData<Meeting>(meetingKey(uid));
      if (prevDetail) {
        qc.setQueryData(meetingKey(uid), applyOptimisticPatch(prevDetail, patch));
      }
      qc.setQueryData<Meeting[]>(meetingsKey, (curr) =>
        curr?.map((m) => (m.uid === uid ? applyOptimisticPatch(m, patch) : m)),
      );
      return { prevDetail };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevDetail) qc.setQueryData(meetingKey(uid), ctx.prevDetail);
      qc.invalidateQueries({ queryKey: meetingsKey });
    },
    onSuccess: (updated) => {
      // uid 는 변하지 않음 — cache key 그대로. path 만 변할 수 있고 list 의 그 entry 의 id 가 갱신됨.
      // 옛 path 의 cache 청소 / hash 갱신 / 옛 detail query 보존 같은 복잡 흐름 다 사라짐.
      qc.setQueryData(meetingKey(uid), updated);
      qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
        prev?.map((m) => (m.uid === uid ? updated : m)),
      );
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

export function useDeleteMeeting() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (uid: string) => {
      const path = uidToPath(qc, uid);
      if (!path) throw new Error(`meeting not found: uid=${uid}`);
      await deleteMeeting(adapter, path);
      markMeetingSelfWrite(watcher, path);
      return uid;
    },
    onSuccess: (uid) => {
      qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
        prev?.filter((m) => m.uid !== uid),
      );
      qc.removeQueries({ queryKey: meetingKey(uid) });
      qc.invalidateQueries({ queryKey: deletedMeetingsKey });
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

export function useRestoreMeeting() {
  const { adapter } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trashId: string) => restoreMeeting(adapter, trashId),
    onSuccess: (restored, trashId) => {
      qc.setQueryData<Meeting[]>(deletedMeetingsKey, (prev) =>
        prev?.filter((m) => m.id !== trashId),
      );
      qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
        prev ? [restored, ...prev] : [restored],
      );
      qc.setQueryData(meetingKey(restored.uid), restored);
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

export function usePurgeMeeting() {
  const { adapter } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (trashId: string) => purgeMeeting(adapter, trashId),
    onSuccess: (_void, trashId) => {
      qc.setQueryData<Meeting[]>(deletedMeetingsKey, (prev) =>
        prev?.filter((m) => m.id !== trashId),
      );
    },
  });
}
