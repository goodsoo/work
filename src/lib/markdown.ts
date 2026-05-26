import type { Meeting } from "../api/meetings";

export interface MeetingMarkdownInput {
  title: Meeting["title"] | null;
  date: Meeting["date"];
  time: Meeting["time"];
  attendees: Meeting["attendees"] | string | null;
  summary: Meeting["summary"] | null;
}

const isNonEmpty = (s: string | null | undefined): s is string =>
  typeof s === "string" && s.trim().length > 0;

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function formatMeetingDate(date: string | null | undefined): string | null {
  if (!isNonEmpty(date)) return null;
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date.trim();
  const [, y, mo, d] = m;
  const parsed = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(parsed.getTime())) return `${y}.${mo}.${d}`;
  return `${y}.${mo}.${d} (${WEEKDAYS[parsed.getDay()]})`;
}

export function meetingToMarkdown(meeting: MeetingMarkdownInput): string {
  const parts: string[] = [];

  const title = isNonEmpty(meeting.title) ? meeting.title.trim() : "메모";
  parts.push(`## ${title}`);

  const meta: string[] = [];
  const dateLabel = formatMeetingDate(meeting.date);
  if (dateLabel) {
    const time = isNonEmpty(meeting.time) ? meeting.time.trim() : null;
    meta.push(`일시: ${time ? `${dateLabel} ${time}` : dateLabel}`);
  } else if (isNonEmpty(meeting.time)) {
    meta.push(`일시: ${meeting.time.trim()}`);
  }
  const attendeesStr = Array.isArray(meeting.attendees)
    ? meeting.attendees.join(", ")
    : meeting.attendees ?? "";
  if (isNonEmpty(attendeesStr)) meta.push(`참석: ${attendeesStr.trim()}`);
  if (meta.length > 0) parts.push(meta.join("\n"));

  // V0.7.3 — summary 가 마크다운 텍스트 통째. 외부 출력 시 그대로 박음 (이미
  // `### 논의 사항 / 결정 사항 / 액션 아이템` 같은 헤더 구조를 가짐).
  const summary = isNonEmpty(meeting.summary) ? meeting.summary.trim() : null;
  if (summary) parts.push(summary);

  return parts.join("\n\n") + "\n";
}
