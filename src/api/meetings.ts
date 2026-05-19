import type { VaultAdapter } from "../lib/vault/adapter";
import {
  buildSummaryBody,
  computeRenamedMeetingPath,
  fileToMeeting,
  freshStamp,
  generateMeetingPath,
  isMeetingSidecar,
  meetingMainPath,
  meetingToMainRaw,
  meetingToSummaryRaw,
  meetingToTranscriptRaw,
  patchMeetingFrontmatter,
  patchMeetingMainBody,
  renameMeetingFiles,
  restoreFromTrash,
  scanMeetings,
  scanTrash,
  summaryPath,
  transcriptPath,
  trashFileWithStamp,
  type Meeting,
  type MeetingMeta,
} from "../lib/vault/scan";

export type { Meeting, MeetingMeta };

// V0.5.3 호환 입력 타입 (Insert/Update 형태)
export interface MeetingInsert {
  title?: string | null;
  date?: string | null;
  time?: string | null;
  attendees?: string[] | string | null;
  content?: string | null;
  transcript?: string | null;
  discussion_items?: string[] | null;
  decisions?: string[] | null;
  action_items?: string[] | null;
  tags?: string[] | null;
}

export type MeetingUpdate = MeetingInsert;

function normalizeAttendees(v: MeetingInsert["attendees"]): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function buildMeeting(input: MeetingInsert, id: string): Meeting {
  const now = new Date().toISOString();
  return {
    id,
    title: input.title ?? "",
    date: input.date ?? null,
    time: input.time ?? null,
    attendees: normalizeAttendees(input.attendees),
    tags: input.tags ?? [],
    mtime: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    content: input.content ?? "",
    transcript: input.transcript ?? "",
    discussion_items: input.discussion_items ?? [],
    decisions: input.decisions ?? [],
    action_items: input.action_items ?? [],
  };
}

// 한 회의 sidecar 까지 read 해서 합쳐 반환. sidecar 없으면 그 필드는 빈 값.
async function readFullMeeting(
  adapter: VaultAdapter,
  id: string,
): Promise<Meeting | null> {
  if (!(await adapter.exists(id))) return null;
  const mainRaw = await adapter.read(id);
  const meta = await adapter.readMeta(id);
  const tPath = transcriptPath(id);
  const sPath = summaryPath(id);
  const transcriptRaw = (await adapter.exists(tPath))
    ? await adapter.read(tPath)
    : "";
  const summaryRaw = (await adapter.exists(sPath))
    ? await adapter.read(sPath)
    : "";
  return fileToMeeting(id, mainRaw, transcriptRaw, summaryRaw, meta.mtime);
}

export async function listMeetings(adapter: VaultAdapter): Promise<Meeting[]> {
  const metas = await scanMeetings(adapter);
  // V0.5.3 호환: Meeting 전체 객체 (본문 포함). 다만 본문은 lazy 가 더 효율적.
  // 일단 meta 만 반환하고 본문은 빈 string. UI 가 useMeeting(id) 로 본문 fetch.
  return metas.map((m): Meeting => ({
    ...m,
    content: "",
    transcript: "",
    discussion_items: [],
    decisions: [],
    action_items: [],
  }));
}

export async function listDeletedMeetings(
  adapter: VaultAdapter,
): Promise<Meeting[]> {
  const trashed = await scanTrash(adapter);
  // 메모 메인 파일만 (sidecar 는 메인과 같은 stamp 로 함께 trash 되어 있지만 보여줄 필요 X)
  const meetings: Meeting[] = [];
  for (const { id, deletedAt } of trashed) {
    if (isMeetingSidecar(id)) continue; // sidecar 는 별도로 보여주지 않음
    const base = id.replace(/^\.trash\//, "").replace(
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-/,
      "",
    );
    if (!base.match(/^\d{4}-\d{2}-\d{2}-/) || base.match(/^\d{4}-\d{2}-\d{2}\.md$/)) {
      continue; // 일기 등 다른 종류 skip
    }
    try {
      const raw = await adapter.read(id);
      const meta = await adapter.readMeta(id);
      // trash 안 sidecar 도 같은 stamp 로 같이 들어있을 거라 함께 read 시도
      const tInTrash = id.replace(/\.md$/, ".transcript.md");
      const sInTrash = id.replace(/\.md$/, ".summary.md");
      const transcriptRaw = (await adapter.exists(tInTrash))
        ? await adapter.read(tInTrash)
        : "";
      const summaryRaw = (await adapter.exists(sInTrash))
        ? await adapter.read(sInTrash)
        : "";
      const m = fileToMeeting(id, raw, transcriptRaw, summaryRaw, meta.mtime);
      meetings.push({ ...m, mtime: deletedAt || meta.mtime });
    } catch {
      // skip
    }
  }
  meetings.sort((a, b) => b.mtime - a.mtime);
  return meetings;
}

export async function getMeeting(
  adapter: VaultAdapter,
  id: string,
): Promise<Meeting | null> {
  return readFullMeeting(adapter, id);
}

export async function createMeeting(
  adapter: VaultAdapter,
  input: MeetingInsert,
): Promise<Meeting> {
  const date = input.date ?? new Date().toISOString().slice(0, 10);
  const title = input.title ?? "";
  const path = await generateMeetingPath(adapter, date, title);
  const meeting = buildMeeting({ ...input, date, title }, path);

  const mainRaw = meetingToMainRaw(meeting);
  const mainMeta = await adapter.write(path, mainRaw);

  // sidecar 는 내용 있을 때만 생성 (빈 파일 회피)
  const tRaw = meetingToTranscriptRaw(meeting);
  if (tRaw.length > 0) {
    await adapter.write(transcriptPath(path), tRaw);
  }
  const sRaw = meetingToSummaryRaw(meeting);
  if (sRaw.length > 0) {
    await adapter.write(summaryPath(path), sRaw);
  }

  return { ...meeting, mtime: mainMeta.mtime };
}

export async function updateMeeting(
  adapter: VaultAdapter,
  id: string,
  patch: MeetingUpdate,
): Promise<Meeting> {
  if (!(await adapter.exists(id))) {
    throw new Error(`meeting not found: ${id}`);
  }

  // Title/date 변경 시 파일명 rename (메인 + sidecar 묶음).
  // rename 후 currentId 가 새 path — 이후 모든 patch 는 currentId 기준.
  let currentId = id;
  if (patch.title !== undefined || patch.date !== undefined) {
    const current = await readFullMeeting(adapter, id);
    if (current) {
      const nextTitle = patch.title !== undefined
        ? (patch.title ?? "")
        : current.title;
      const nextDate = patch.date !== undefined
        ? (patch.date ?? "")
        : (current.date ?? "");
      if (nextDate) {
        const newPath = await computeRenamedMeetingPath(
          adapter,
          id,
          nextDate,
          nextTitle,
        );
        if (newPath !== id) {
          await renameMeetingFiles(adapter, id, newPath);
          currentId = newPath;
        }
      }
    }
  }

  // 메인 파일 — frontmatter / content
  const fmPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) fmPatch.title = patch.title ?? "";
  if (patch.date !== undefined) fmPatch.date = patch.date;
  if (patch.time !== undefined) fmPatch.time = patch.time;
  if (patch.attendees !== undefined) {
    fmPatch.attendees = normalizeAttendees(patch.attendees);
  }
  if (patch.tags !== undefined) fmPatch.tags = patch.tags;

  const touchesMain =
    Object.keys(fmPatch).length > 0 || patch.content !== undefined;

  if (touchesMain) {
    let raw = await adapter.read(currentId);
    const mainMeta = await adapter.readMeta(currentId);
    if (Object.keys(fmPatch).length > 0) {
      raw = patchMeetingFrontmatter(raw, fmPatch);
    }
    if (patch.content !== undefined) {
      raw = patchMeetingMainBody(raw, patch.content ?? "");
    }
    await adapter.write(currentId, raw, mainMeta.mtime);
  }

  // Transcript sidecar
  if (patch.transcript !== undefined) {
    const tPath = transcriptPath(currentId);
    const next = patch.transcript ?? "";
    if (next.length === 0) {
      if (await adapter.exists(tPath)) {
        await adapter.delete(tPath);
      }
    } else {
      const exists = await adapter.exists(tPath);
      const prevMtime = exists ? (await adapter.readMeta(tPath)).mtime : undefined;
      await adapter.write(tPath, `${next}\n`, prevMtime);
    }
  }

  // Summary sidecar
  if (
    patch.discussion_items !== undefined ||
    patch.decisions !== undefined ||
    patch.action_items !== undefined
  ) {
    const sPath = summaryPath(currentId);
    // 현재 상태 read (sidecar 가 있으면 그 H2 list 보존)
    const current = (await readFullMeeting(adapter, currentId)) ?? buildMeeting({}, currentId);
    const merged = {
      discussion_items: patch.discussion_items ?? current.discussion_items,
      decisions: patch.decisions ?? current.decisions,
      action_items: patch.action_items ?? current.action_items,
    };
    const isEmpty =
      merged.discussion_items.length === 0 &&
      merged.decisions.length === 0 &&
      merged.action_items.length === 0;

    if (isEmpty) {
      if (await adapter.exists(sPath)) {
        await adapter.delete(sPath);
      }
    } else {
      const exists = await adapter.exists(sPath);
      const prevMtime = exists ? (await adapter.readMeta(sPath)).mtime : undefined;
      await adapter.write(sPath, `${buildSummaryBody(merged)}\n`, prevMtime);
    }
  }

  const updated = await readFullMeeting(adapter, currentId);
  if (!updated) throw new Error(`meeting disappeared after update: ${currentId}`);
  return updated;
}

// Soft delete: 메인 + sidecar 다 같은 stamp 로 .trash/ 이동
export async function deleteMeeting(
  adapter: VaultAdapter,
  id: string,
): Promise<void> {
  const stamp = freshStamp();
  await trashFileWithStamp(adapter, id, stamp);
  const tPath = transcriptPath(id);
  if (await adapter.exists(tPath)) {
    await trashFileWithStamp(adapter, tPath, stamp);
  }
  const sPath = summaryPath(id);
  if (await adapter.exists(sPath)) {
    await trashFileWithStamp(adapter, sPath, stamp);
  }
}

export async function restoreMeeting(
  adapter: VaultAdapter,
  trashId: string,
): Promise<Meeting> {
  // 메인 파일 복원
  const restoredPath = await restoreFromTrash(adapter, trashId);
  // 같은 stamp 의 sidecar 도 복원 시도
  const stampMatch = trashId.match(
    /^\.trash\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-(.+)\.md$/,
  );
  if (stampMatch) {
    const [, stamp, base] = stampMatch;
    for (const suffix of ["transcript", "summary"]) {
      const sidecarTrash = `.trash/${stamp}-${base}.${suffix}.md`;
      if (await adapter.exists(sidecarTrash)) {
        await restoreFromTrash(adapter, sidecarTrash);
      }
    }
  }
  const m = await readFullMeeting(adapter, restoredPath);
  if (!m) throw new Error(`restore failed: ${trashId}`);
  return m;
}

// 영구 삭제 (휴지통에서만) — 메인 + 같은 stamp sidecar 도 함께 삭제
export async function purgeMeeting(
  adapter: VaultAdapter,
  trashId: string,
): Promise<void> {
  await adapter.delete(trashId);
  const stampMatch = trashId.match(
    /^\.trash\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-(.+)\.md$/,
  );
  if (stampMatch) {
    const [, stamp, base] = stampMatch;
    for (const suffix of ["transcript", "summary"]) {
      const sidecarTrash = `.trash/${stamp}-${base}.${suffix}.md`;
      if (await adapter.exists(sidecarTrash)) {
        await adapter.delete(sidecarTrash);
      }
    }
  }
}

// re-export — watcher / 외부 호환
export { meetingMainPath, isMeetingSidecar };
