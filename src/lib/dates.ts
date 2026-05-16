import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

/** "yyyy-MM-dd" in local time. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Convert ISO date (yyyy-MM-dd) to local Date at midnight. */
export function parseIsoDate(iso: string): Date {
  return parseISO(iso + "T00:00:00");
}

/** Add n days to ISO date string and return new ISO string. */
export function addDaysIso(iso: string, days: number): string {
  return todayIso(addDays(parseIsoDate(iso), days));
}

/** Range of ISO date strings, inclusive. */
export function isoDateRange(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  const start = parseIsoDate(fromIso);
  const end = parseIsoDate(toIso);
  const days = differenceInCalendarDays(end, start);
  for (let i = 0; i <= days; i++) out.push(todayIso(addDays(start, i)));
  return out;
}

/** "5월 6일 화요일" — 올해가 아니면 "2027년 5월 6일 화요일" */
export function formatDateLong(iso: string, reference = new Date()): string {
  const d = parseIsoDate(iso);
  if (d.getFullYear() !== reference.getFullYear()) {
    return format(d, "yyyy년 M월 d일 EEEE", { locale: ko });
  }
  return format(d, "M월 d일 EEEE", { locale: ko });
}

/** "5/6" */
export function formatDateShort(iso: string): string {
  return format(parseIsoDate(iso), "M/d");
}

/** "5/6 화" */
export function formatDateShortWithDay(iso: string): string {
  return format(parseIsoDate(iso), "M/d EEE", { locale: ko });
}

/** Relative human label: 오늘 / 어제 / 내일 / N일 후 / N일 전 / "5/6" */
export function relativeDateLabel(
  iso: string,
  reference = new Date(),
): string {
  const target = parseIsoDate(iso);
  const refIso = todayIso(reference);
  const ref = parseIsoDate(refIso);
  const diff = differenceInCalendarDays(target, ref);
  if (diff === 0) return "오늘";
  if (diff === -1) return "어제";
  if (diff === 1) return "내일";
  if (diff > 1 && diff <= 6) return `${diff}일 후`;
  if (diff < -1 && diff >= -6) return `${-diff}일 전`;
  return formatDateShort(iso);
}

/** Whether the ISO date is today. */
export function isToday(iso: string, reference = new Date()): boolean {
  return iso === todayIso(reference);
}

/** Whether ISO date is in the past (strictly before today). */
export function isPast(iso: string, reference = new Date()): boolean {
  const target = parseIsoDate(iso);
  const ref = parseIsoDate(todayIso(reference));
  return differenceInCalendarDays(target, ref) < 0;
}
