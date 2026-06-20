import type { VaultAdapter } from "../lib/vault/adapter";
import {
  extractEvents,
  buildEventLine,
  SCHEDULE_PATH,
  type ParsedEvent,
} from "../lib/vault/schedule";

// 일정 = vault 루트의 단일 파일. 체크박스 없는 날짜-우선 이벤트 리스트.
// tasks/ 와 나란히 루트에 둠 (할 일 프로젝트 파일들과 한 단계 위에서 정렬).
export { SCHEDULE_PATH };

export interface ScheduleEvent {
  id: string; // `${file}#L${line}`
  text: string;
  start: string; // ISO YYYY-MM-DD
  end: string | null; // 다일 종료일(포함). null = 단일일.
  time: string | null; // HH:MM
  _source: { file: string; line: number };
}

export interface ScheduleInsert {
  text: string;
  start: string;
  end?: string | null;
  time?: string | null;
}

export interface ScheduleUpdate {
  text?: string;
  start?: string;
  end?: string | null;
  time?: string | null;
}

export function makeEventId(file: string, line: number): string {
  return `${file}#L${line}`;
}

export function parseEventId(id: string): { file: string; line: number } {
  const m = id.match(/^(.+)#L(\d+)$/);
  if (!m) throw new Error(`invalid event id: ${id}`);
  return { file: m[1], line: Number(m[2]) };
}

function eventFromParsed(p: ParsedEvent): ScheduleEvent {
  return {
    id: makeEventId(p.source.file, p.source.line),
    text: p.text,
    start: p.start,
    end: p.end ?? null,
    time: p.time ?? null,
    _source: p.source,
  };
}

export async function listEvents(
  adapter: VaultAdapter,
): Promise<ScheduleEvent[]> {
  if (!(await adapter.exists(SCHEDULE_PATH))) return [];
  let raw: string;
  try {
    raw = await adapter.read(SCHEDULE_PATH);
  } catch {
    return [];
  }
  const events = extractEvents(SCHEDULE_PATH, raw).map(eventFromParsed);
  // 시작일 오름차순, 같으면 시각순(종일 먼저), 그다음 텍스트.
  events.sort(
    (a, b) =>
      a.start.localeCompare(b.start) ||
      byTime(a.time, b.time) ||
      a.text.localeCompare(b.text),
  );
  return events;
}

function byTime(a: string | null, b: string | null): number {
  const ta = a ?? "";
  const tb = b ?? "";
  if (ta === tb) return 0;
  if (!ta) return -1;
  if (!tb) return 1;
  return ta < tb ? -1 : 1;
}

export async function createEvent(
  adapter: VaultAdapter,
  input: ScheduleInsert,
): Promise<ScheduleEvent> {
  const line = buildEventLine(input);
  const raw = (await adapter.exists(SCHEDULE_PATH))
    ? await adapter.read(SCHEDULE_PATH)
    : "# 일정\n";
  const trimmed = raw.replace(/\n+$/, "");
  const updated = `${trimmed}\n${line}\n`;
  await adapter.write(SCHEDULE_PATH, updated);
  const lineNum = updated.split("\n").length - 2;
  return {
    id: makeEventId(SCHEDULE_PATH, lineNum),
    text: input.text,
    start: input.start,
    end: input.end ?? null,
    time: input.time ?? null,
    _source: { file: SCHEDULE_PATH, line: lineNum },
  };
}

export async function updateEvent(
  adapter: VaultAdapter,
  id: string,
  patch: ScheduleUpdate,
): Promise<ScheduleEvent> {
  const { file, line } = parseEventId(id);
  const raw = await adapter.read(file);
  const meta = await adapter.readMeta(file);
  const events = extractEvents(file, raw);
  const existing = events.find((e) => e.source.line === line);
  if (!existing) {
    throw new Error(`event not found at line ${line} of ${file}`);
  }
  const merged = {
    text: patch.text ?? existing.text,
    start: patch.start ?? existing.start,
    end: patch.end !== undefined ? patch.end : (existing.end ?? null),
    time: patch.time !== undefined ? patch.time : (existing.time ?? null),
  };
  const lines = raw.split("\n");
  const indent = lines[line].match(/^(\s*)/)?.[1] ?? "";
  lines[line] = indent + buildEventLine(merged);
  const updated = lines.join("\n");
  const newMeta = await adapter.write(file, updated, meta.mtime);
  void newMeta;
  const after = extractEvents(file, updated).find((e) => e.source.line === line);
  if (!after) {
    throw new Error(`event disappeared after update at ${file}:${line}`);
  }
  return eventFromParsed(after);
}

export async function deleteEvent(
  adapter: VaultAdapter,
  id: string,
): Promise<void> {
  const { file, line } = parseEventId(id);
  const raw = await adapter.read(file);
  const meta = await adapter.readMeta(file);
  const lines = raw.split("\n");
  if (line >= lines.length) return;
  lines.splice(line, 1);
  await adapter.write(file, lines.join("\n"), meta.mtime);
}
