import { gcalRequest } from "./transport";
import type { GcalApiEvent, GcalEventBody } from "./mapping";

// Calendar API v3 얇은 래퍼. 모든 호출은 Rust gcal_request 경유 (transport.ts).
// path 의 calendarId/eventId 는 @·. 등 특수문자 포함 가능 → encodeURIComponent.

export interface GcalCalendar {
  id: string;
  summary?: string;
}

// 전용 캘린더 생성 (calendar.app.created scope 로 만든 secondary calendar).
// 개인 캘린더와 분리 — 빈 캘린더로 시작해 초기 dedup 문제 회피.
// timeZone 미지정 시 Google 기본값이 UTC 라, events.list 응답의 dateTime 이 UTC
// offset 으로 와서 import 시각이 로컬 기준 −9h(KST) 어긋난다. 생성 시 로컬 tz 를
// 박아 캘린더 기본 tz 자체를 맞춘다 (events.list 의 timeZone pin 과 이중 방어).
export async function createCalendar(
  summary: string,
  timeZone?: string,
): Promise<GcalCalendar> {
  return gcalRequest<GcalCalendar>("POST", "/calendars", {
    summary,
    ...(timeZone ? { timeZone } : {}),
  });
}

// 전용 캘린더 이름 변경 (summary patch). calendar.app.created scope 로 만든
// 캘린더만 대상 — 개인 캘린더는 구조적으로 못 건드림.
export async function patchCalendar(calendarId: string, summary: string): Promise<GcalCalendar> {
  return gcalRequest<GcalCalendar>(
    "PATCH",
    `/calendars/${encodeURIComponent(calendarId)}`,
    { summary },
  );
}

export interface EventsListResponse {
  items: GcalApiEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

// events.list — 증분(syncToken) 또는 full. showDeleted=true 로 cancelled 포함.
// syncToken 만료 시 Google 이 410 → transport 가 GcalError(Http 410) 로 던짐.
// timeZone: 응답 dateTime 을 이 tz offset 으로 강제. 누락 시 캘린더 기본 tz(API
// 생성 캘린더는 UTC) 라 import 시각이 −9h(KST) 어긋난다. 로컬 tz 를 pin 해야
// splitDateTime 이 읽는 wall-clock 이 실제 로컬 시각과 일치한다. (syncToken 과
// 병행 허용 — Google 의 nextSyncToken 금지 파라미터 목록에 timeZone 없음.)
export async function listEvents(
  calendarId: string,
  opts: { syncToken?: string | null; pageToken?: string; timeZone?: string } = {},
): Promise<EventsListResponse> {
  const params = new URLSearchParams({ showDeleted: "true", maxResults: "2500" });
  if (opts.timeZone) params.set("timeZone", opts.timeZone);
  if (opts.syncToken) params.set("syncToken", opts.syncToken);
  else params.set("timeMin", "2020-01-01T00:00:00Z"); // full sync 시 과거 범위 가드
  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  return gcalRequest<EventsListResponse>(
    "GET",
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
  );
}

export async function insertEvent(
  calendarId: string,
  body: GcalEventBody,
): Promise<GcalApiEvent> {
  return gcalRequest<GcalApiEvent>(
    "POST",
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    body,
  );
}

export async function updateEvent(
  calendarId: string,
  eventId: string,
  body: GcalEventBody,
): Promise<GcalApiEvent> {
  return gcalRequest<GcalApiEvent>(
    "PUT",
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    body,
  );
}

// events.delete — 204 No Content. 이미 삭제된 이벤트는 410/404 가능 (호출부가 무시).
export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  await gcalRequest<null>(
    "DELETE",
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
  );
}
