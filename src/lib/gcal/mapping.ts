import type { RemoteEvent, ScheduleFields } from "./types";

// Google Calendar API 이벤트 (필요한 부분만).
export interface GcalApiEvent {
  id: string;
  status?: string; // "confirmed" | "tentative" | "cancelled"
  summary?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  updated?: string;
  // 반복 일정 마스터의 RRULE 등. 존재하면 반복 일정.
  recurrence?: string[];
  // 반복 일정의 개별 인스턴스/예외가 가리키는 마스터 eventId.
  recurringEventId?: string;
}

// 반복 일정(마스터 또는 인스턴스/예외)인지. Phase 1 은 반복 미지원 — 동기화에서
// 제외한다 (import X, 수정·삭제도 안 건드림). 단일 이벤트로 PUT 하면 Google 의 반복
// 규칙이 통째로 깨지는 footgun 을 구조적으로 차단.
export function isRecurringEvent(ev: GcalApiEvent): boolean {
  return (Array.isArray(ev.recurrence) && ev.recurrence.length > 0) ||
    typeof ev.recurringEventId === "string";
}

// (제거됨) id 의 `_` 로 반복을 판별하려던 isRecurringEventId 는 오판이었다. `_` 는
// 다른 캘린더에서 복사·가져온 단일 이벤트의 Google id 형식(iCalUID 인코딩)일 뿐 반복과
// 무관. 진짜 반복은 import 의 isRecurringEvent(API recurrence 필드)가 이미 걸러 vault 에
// 안 들어오므로, 로컬 앵커 task 는 구조적으로 반복이 아니다 → push 측 반복 가드 불필요.

// events.insert / events.update 요청 바디.
export interface GcalEventBody {
  summary: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
}

// RFC3339 dateTime 에서 wall-clock 그대로 추출. "2026-05-29T14:00:00+09:00" →
// {date:"2026-05-29", time:"14:00"}. 단일 시간대 1인 도구 전제 — 적힌 시각을 그대로
// 읽는다 (tz 정규화로 시각이 밀리는 footgun 회피). 다른 tz 이벤트는 Phase 2.
function splitDateTime(dt: string): { date: string; time: string | null } {
  const m = dt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return { date: dt.slice(0, 10), time: null };
  return { date: m[1], time: `${m[2]}:${m[3]}` };
}

// Google 이벤트 → 정규화된 RemoteEvent.
export function gcalEventToRemote(ev: GcalApiEvent): RemoteEvent {
  const cancelled = ev.status === "cancelled";
  const updated = ev.updated ?? "";
  if (cancelled) {
    return { eventId: ev.id, cancelled: true, fields: { title: "", date: null, time: null }, updated };
  }
  const title = ev.summary ?? "";
  let date: string | null = null;
  let time: string | null = null;
  if (ev.start?.date) {
    // 종일 이벤트.
    date = ev.start.date;
  } else if (ev.start?.dateTime) {
    const split = splitDateTime(ev.start.dateTime);
    date = split.date;
    time = split.time;
  }
  return { eventId: ev.id, cancelled: false, fields: { title, date, time }, updated };
}

// YYYY-MM-DD 에 일수 더하기 (UTC 산술 — tz 영향 0).
function addDays(date: string, days: number): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date;
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const next = new Date(base + days * 86_400_000);
  const y = next.getUTCFullYear();
  const mo = String(next.getUTCMonth() + 1).padStart(2, "0");
  const d = String(next.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

// HH:MM + 분 → {date, time} (자정 넘으면 date 롤오버). DST 무시 (1인 도구).
function addMinutes(date: string, time: string, mins: number): { date: string; time: string } {
  const m = time.match(/^(\d{2}):(\d{2})$/);
  if (!m) return { date, time };
  const total = Number(m[1]) * 60 + Number(m[2]) + mins;
  const dayRoll = Math.floor(total / (24 * 60));
  const within = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const endH = String(Math.floor(within / 60)).padStart(2, "0");
  const endMin = String(within % 60).padStart(2, "0");
  return { date: dayRoll > 0 ? addDays(date, dayRoll) : date, time: `${endH}:${endMin}` };
}

// 시점 이벤트 기본 길이 — Google events.insert 는 end 필수, zero-info 생성 불가.
export const DEFAULT_DURATION_MIN = 30;

// 정규화된 필드 → Google 요청 바디.
// - due_time 있음 → start=due_time, end=+30분 (시점 블록).
// - due_time 없음 → 종일 이벤트 (end.date 는 exclusive 라 다음날).
// timeZone 을 넘기면 start/end.dateTime 에 부착 (wall-clock 왕복 결정성 확보).
export function fieldsToGcalEvent(fields: ScheduleFields, timeZone?: string): GcalEventBody {
  if (!fields.date) {
    throw new Error("fieldsToGcalEvent: date 없는 일정은 Google 이벤트로 못 만듭니다");
  }
  if (fields.time) {
    const end = addMinutes(fields.date, fields.time, DEFAULT_DURATION_MIN);
    return {
      summary: fields.title,
      start: { dateTime: `${fields.date}T${fields.time}:00`, ...(timeZone ? { timeZone } : {}) },
      end: { dateTime: `${end.date}T${end.time}:00`, ...(timeZone ? { timeZone } : {}) },
    };
  }
  // 종일.
  return {
    summary: fields.title,
    start: { date: fields.date },
    end: { date: addDays(fields.date, 1) },
  };
}
