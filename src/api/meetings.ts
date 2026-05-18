import type { VaultAdapter } from "../lib/vault/adapter";
import {
  fileToMeeting,
  generateMeetingPath,
  meetingToRaw,
  patchMeetingContent,
  patchMeetingSummary,
  patchMeetingTranscript,
  restoreFromTrash,
  scanMeetings,
  scanTrash,
  trashFile,
  type Meeting,
  type MeetingMeta,
} from "../lib/vault/scan";
import { patchFrontmatter } from "../lib/vault/parser";

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
    unmapped: "",
  };
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
    unmapped: "",
  }));
}

export async function listDeletedMeetings(
  adapter: VaultAdapter,
): Promise<Meeting[]> {
  const trashed = await scanTrash(adapter);
  // 회의록만 (날짜 prefix 있는 파일)
  const meetings: Meeting[] = [];
  for (const { id, deletedAt } of trashed) {
    // .trash/{stamp}-{원본base}.md → 원본 base 가 meetings/* 형식인지 추정
    const base = id.replace(/^\.trash\//, "").replace(
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-/,
      "",
    );
    if (!base.match(/^\d{4}-\d{2}-\d{2}-/) || base.match(/^\d{4}-\d{2}-\d{2}\.md$/)) {
      continue; // 일기는 별도
    }
    try {
      const raw = await adapter.read(id);
      const meta = await adapter.readMeta(id);
      const m = fileToMeeting(id, raw, meta.mtime);
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
  if (!(await adapter.exists(id))) return null;
  const raw = await adapter.read(id);
  const meta = await adapter.readMeta(id);
  return fileToMeeting(id, raw, meta.mtime);
}

export async function createMeeting(
  adapter: VaultAdapter,
  input: MeetingInsert,
): Promise<Meeting> {
  const date = input.date ?? new Date().toISOString().slice(0, 10);
  const title = input.title ?? "회의록";
  const path = await generateMeetingPath(adapter, date, title);
  const meeting = buildMeeting({ ...input, date, title }, path);
  const raw = meetingToRaw(meeting);
  const meta = await adapter.write(path, raw);
  return { ...meeting, mtime: meta.mtime };
}

export async function updateMeeting(
  adapter: VaultAdapter,
  id: string,
  patch: MeetingUpdate,
): Promise<Meeting> {
  if (!(await adapter.exists(id))) {
    throw new Error(`meeting not found: ${id}`);
  }
  let raw = await adapter.read(id);
  const meta = await adapter.readMeta(id);

  // Frontmatter patches (title/date/time/attendees/tags)
  const fmPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) fmPatch.title = patch.title ?? "";
  if (patch.date !== undefined) fmPatch.date = patch.date;
  if (patch.time !== undefined) fmPatch.time = patch.time;
  if (patch.attendees !== undefined) {
    fmPatch.attendees = normalizeAttendees(patch.attendees);
  }
  if (patch.tags !== undefined) fmPatch.tags = patch.tags;
  if (Object.keys(fmPatch).length > 0) {
    raw = patchFrontmatter(raw, fmPatch);
  }

  // Body section patches
  if (patch.content !== undefined) {
    raw = patchMeetingContent(raw, patch.content ?? "");
  }
  if (patch.transcript !== undefined) {
    raw = patchMeetingTranscript(raw, patch.transcript ?? "");
  }
  if (
    patch.discussion_items !== undefined ||
    patch.decisions !== undefined ||
    patch.action_items !== undefined
  ) {
    // 현재 상태 읽어서 부분 update
    const current = fileToMeeting(id, raw, meta.mtime);
    raw = patchMeetingSummary(raw, {
      discussion_items: patch.discussion_items ?? current.discussion_items,
      decisions: patch.decisions ?? current.decisions,
      action_items: patch.action_items ?? current.action_items,
    });
  }

  const newMeta = await adapter.write(id, raw, meta.mtime);
  return fileToMeeting(id, raw, newMeta.mtime);
}

// Soft delete: .trash/ 로 이동
export async function deleteMeeting(
  adapter: VaultAdapter,
  id: string,
): Promise<void> {
  await trashFile(adapter, id);
}

export async function restoreMeeting(
  adapter: VaultAdapter,
  trashId: string,
): Promise<Meeting> {
  const restoredPath = await restoreFromTrash(adapter, trashId);
  const m = await getMeeting(adapter, restoredPath);
  if (!m) throw new Error(`restore failed: ${trashId}`);
  return m;
}

// 영구 삭제 (휴지통에서만)
export async function purgeMeeting(
  adapter: VaultAdapter,
  trashId: string,
): Promise<void> {
  await adapter.delete(trashId);
}
