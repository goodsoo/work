import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

/** "월"/"화"/... or null if iso is invalid */
export function weekdayShort(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "EEE", { locale: ko });
}

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

/**
 * Loose date parser → ISO (yyyy-MM-dd) or null.
 *
 * 허용 형식:
 * - 자연어: "오늘", "내일", "어제", "모레", "그제"
 * - 슬래시/점/하이픈 구분: "5/19", "5.19", "5-19", "2026/5/19", "2026.05.19", "2026-5-19"
 * - 공백 구분: "5 19", "2026 5 19"
 * - 한글 단위: "5월 19일", "2026년 5월 19일"
 * - 압축형: "20260519", "260519" (yymmdd)
 * - 이미 ISO 면 그대로 normalize
 *
 * 연도 생략 시 reference 의 연도. 월/일 범위 벗어나면 null.
 */
export function parseLooseDate(
  raw: string,
  reference = new Date(),
): string | null {
  const s = raw.trim();
  if (!s) return null;

  // 자연어
  const refIso = todayIso(reference);
  if (s === "오늘" || s.toLowerCase() === "today") return refIso;
  if (s === "내일" || s.toLowerCase() === "tomorrow") return addDaysIso(refIso, 1);
  if (s === "어제" || s.toLowerCase() === "yesterday") return addDaysIso(refIso, -1);
  if (s === "모레") return addDaysIso(refIso, 2);
  if (s === "그제" || s === "그저께") return addDaysIso(refIso, -2);

  // 요일 단축: 오늘 포함 가장 최근 (과거 방향) 의 해당 요일.
  // Sun=0, Mon=1, ..., Sat=6 (Date.getDay 기준).
  const wdays = ["일", "월", "화", "수", "목", "금", "토"];
  const wIdx = wdays.indexOf(s);
  if (wIdx !== -1) {
    const todayIdx = reference.getDay();
    const diff = (todayIdx - wIdx + 7) % 7;
    return addDaysIso(refIso, -diff);
  }
  // "월요일" 같은 풀 한글도 동일 처리.
  if (/^[일월화수목금토]요일$/.test(s)) {
    const wIdx2 = wdays.indexOf(s.charAt(0));
    const todayIdx = reference.getDay();
    const diff = (todayIdx - wIdx2 + 7) % 7;
    return addDaysIso(refIso, -diff);
  }

  // 압축 yyyymmdd 또는 yymmdd
  if (/^\d{8}$/.test(s)) {
    const y = parseInt(s.slice(0, 4), 10);
    const m = parseInt(s.slice(4, 6), 10);
    const d = parseInt(s.slice(6, 8), 10);
    return composeIso(y, m, d);
  }
  if (/^\d{6}$/.test(s)) {
    const yy = parseInt(s.slice(0, 2), 10);
    const m = parseInt(s.slice(2, 4), 10);
    const d = parseInt(s.slice(4, 6), 10);
    return composeIso(2000 + yy, m, d);
  }

  // 한글 단위 또는 일반 구분자 — "년", "월", "일" 또는 공백/슬래시/점/하이픈
  const parts = s
    .replace(/년|월|일/g, " ")
    .split(/[\s/.\-]+/)
    .filter(Boolean);

  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    if (Number.isNaN(m) || Number.isNaN(d)) return null;
    return composeIso(reference.getFullYear(), m, d);
  }
  if (parts.length === 3) {
    const a = parseInt(parts[0], 10);
    const b = parseInt(parts[1], 10);
    const c = parseInt(parts[2], 10);
    if ([a, b, c].some(Number.isNaN)) return null;
    // 첫 토큰이 4자리거나 32 이상이면 연도
    const yearFirst = parts[0].length === 4 || a >= 32;
    const year = yearFirst ? (a < 100 ? 2000 + a : a) : c < 100 ? 2000 + c : c;
    const month = yearFirst ? b : a;
    const day = yearFirst ? c : b;
    return composeIso(year, month, day);
  }
  return null;
}

function composeIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // Date 가 invalid 날짜(2/30 등) overflow 하는지 확인
  const probe = new Date(year, month - 1, day);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Loose time parser → "HH:mm" or null.
 *
 * 허용 형식:
 * - "14:30", "2:30", "14시 30분", "14시", "2시 30분", "오전 9시", "오후 2시 30분"
 * - "오후 2시", "오전 9:30", "오후2", "오전 11"
 * - "2pm", "2:30 PM", "2 pm", "11am"
 * - 공백 분리: "14 30"
 * - 압축: "1430" (HHmm), "0930"
 *
 * 시 0-23, 분 0-59. AM/PM 적용 후 0-23 범위 검증.
 */
export function parseLooseTime(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // AM/PM / 오전/오후 추출
  let amPm: "am" | "pm" | null = null;
  let body = s;
  if (/오후|pm/i.test(body)) amPm = "pm";
  else if (/오전|am/i.test(body)) amPm = "am";
  body = body.replace(/오전|오후|am|pm|a\.m\.|p\.m\./gi, " ");
  body = body.replace(/시|분/g, " ");
  body = body.trim();

  let hour: number;
  let minute = 0;

  if (/^\d{1,2}:\d{1,2}$/.test(body)) {
    const [h, m] = body.split(":");
    hour = parseInt(h, 10);
    minute = parseInt(m, 10);
  } else if (/^\d{3,4}$/.test(body)) {
    if (body.length === 3) {
      hour = parseInt(body.slice(0, 1), 10);
      minute = parseInt(body.slice(1), 10);
    } else {
      hour = parseInt(body.slice(0, 2), 10);
      minute = parseInt(body.slice(2), 10);
    }
  } else {
    const parts = body.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      hour = parseInt(parts[0], 10);
    } else if (parts.length === 2) {
      hour = parseInt(parts[0], 10);
      minute = parseInt(parts[1], 10);
    } else {
      return null;
    }
  }

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (amPm === "pm" && hour < 12) hour += 12;
  if (amPm === "am" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
