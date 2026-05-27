import type { Meeting } from "../api/meetings";

// 복사 버튼이 붙이는 본문 — 현재 탭 기준. 제목/일시/참석 헤더는 모든 탭 공통.
export type MeetingMarkdownSection = "body" | "transcript" | "summary";

export interface MeetingMarkdownInput {
  title: Meeting["title"] | null;
  date: Meeting["date"];
  time: Meeting["time"];
  attendees: Meeting["attendees"] | string | null;
  body?: string | null;
  transcript?: string | null;
  summary?: Meeting["summary"] | null;
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

export function meetingToMarkdown(
  meeting: MeetingMarkdownInput,
  section: MeetingMarkdownSection = "summary",
): string {
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

  // 현재 탭 내용을 헤더 뒤에 그대로 박음. 본문/음성기록은 raw 텍스트, 요약은 이미
  // `### 논의 사항 / 결정 사항 / 액션 아이템` 마크다운 구조 (V0.7.3 부터 텍스트 통째).
  const content =
    section === "body"
      ? meeting.body
      : section === "transcript"
        ? meeting.transcript
        : meeting.summary;
  const trimmed = isNonEmpty(content) ? content.trim() : null;
  if (trimmed) parts.push(trimmed);

  return parts.join("\n\n") + "\n";
}
