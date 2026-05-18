import type { Meeting } from "../api/meetings";

export interface MeetingMarkdownInput {
  title: Meeting["title"] | null;
  date: Meeting["date"];
  time: Meeting["time"];
  attendees: Meeting["attendees"] | string | null;
  discussion_items: Meeting["discussion_items"] | null;
  decisions: Meeting["decisions"] | null;
  action_items: Meeting["action_items"] | null;
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

function nonEmptyList(items: string[] | null | undefined): string[] {
  return (items ?? []).map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
}

export function meetingToMarkdown(meeting: MeetingMarkdownInput): string {
  const parts: string[] = [];

  const title = isNonEmpty(meeting.title) ? meeting.title.trim() : "회의록";
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

  const discussion = nonEmptyList(meeting.discussion_items);
  if (discussion.length > 0) {
    parts.push(`### 논의 사항\n${discussion.map((s) => `- ${s}`).join("\n")}`);
  }

  const decisions = nonEmptyList(meeting.decisions);
  if (decisions.length > 0) {
    parts.push(`### 결정 사항\n${decisions.map((s) => `- ${s}`).join("\n")}`);
  }

  const actions = nonEmptyList(meeting.action_items);
  if (actions.length > 0) {
    parts.push(`### 액션 아이템\n${actions.map((s) => `- ${s}`).join("\n")}`);
  }

  return parts.join("\n\n") + "\n";
}
