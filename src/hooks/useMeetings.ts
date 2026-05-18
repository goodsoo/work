import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

// 한 회의는 메인 + 2 sidecar 파일이라 자기 write 마크도 셋 다.
function markMeetingSelfWrite(watcher: VaultWatcher, id: string): void {
  watcher.markSelfWrite(id);
  watcher.markSelfWrite(transcriptPath(id));
  watcher.markSelfWrite(summaryPath(id));
}

const meetingsKey = ["meetings"] as const;
const deletedMeetingsKey = ["meetings", "deleted"] as const;
const meetingKey = (id: string) => ["meetings", id] as const;

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

export function useMeeting(id: string | undefined) {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: id ? meetingKey(id) : ["meetings", "none"],
    queryFn: () => getMeeting(adapter, id!),
    enabled: !!id && isReady,
  });
}

export function useCreateMeeting() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MeetingInsert) => {
      const created = await createMeeting(adapter, input);
      markMeetingSelfWrite(watcher, created.id);
      return created;
    },
    onSuccess: (created) => {
      qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
        prev ? [created, ...prev] : [created],
      );
      qc.setQueryData(meetingKey(created.id), created);
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

export function useUpdateMeeting(id: string) {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: MeetingUpdate) => {
      // rename 가능성 — 양쪽 path 다 markSelfWrite 해서 watcher 가 자기 변경 무시.
      markMeetingSelfWrite(watcher, id);
      const updated = await updateMeeting(adapter, id, patch);
      if (updated.id !== id) {
        markMeetingSelfWrite(watcher, updated.id);
      }
      return updated;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: meetingKey(id) });
      const prevDetail = qc.getQueryData<Meeting>(meetingKey(id));
      const prevList = qc.getQueryData<Meeting[]>(meetingsKey);
      if (prevDetail) {
        qc.setQueryData(meetingKey(id), {
          ...prevDetail,
          ...patch,
        } as Meeting);
      }
      qc.setQueryData<Meeting[]>(meetingsKey, (curr) =>
        curr?.map((m) =>
          m.id === id ? ({ ...m, ...patch } as Meeting) : m,
        ),
      );
      return { prevDetail, prevList };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevDetail) qc.setQueryData(meetingKey(id), ctx.prevDetail);
      if (ctx?.prevList) qc.setQueryData(meetingsKey, ctx.prevList);
    },
    onSuccess: (updated) => {
      const newId = updated.id;
      if (newId !== id) {
        // 파일 rename — 옛 detail query 제거, 새 id 로 detail 셋. list 도 옛 id 항목을
        // 새 id 로 교체. URL hash 가 옛 id 였으면 새 id 로 갱신.
        qc.removeQueries({ queryKey: meetingKey(id) });
        qc.setQueryData(meetingKey(newId), updated);
        qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
          prev?.map((m) => (m.id === id ? updated : m)),
        );
        if (typeof window !== "undefined") {
          const currentHash = window.location.hash;
          if (currentHash.includes(encodeURIComponent(id)) || currentHash.includes(id)) {
            window.location.hash = `#meeting-${encodeURIComponent(newId)}`;
          }
        }
      } else {
        qc.setQueryData(meetingKey(id), updated);
        qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
          prev?.map((m) => (m.id === id ? updated : m)),
        );
      }
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

export function useDeleteMeeting() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteMeeting(adapter, id);
      markMeetingSelfWrite(watcher, id);
    },
    onSuccess: (_void, id) => {
      qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
        prev?.filter((m) => m.id !== id),
      );
      qc.removeQueries({ queryKey: meetingKey(id) });
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
      qc.setQueryData(meetingKey(restored.id), restored);
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
