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
export async function createCalendar(summary: string): Promise<GcalCalendar> {
  return gcalRequest<GcalCalendar>("POST", "/calendars", { summary });
}

// 캘린더 메타 조회. 전용 캘린더가 Google 에서 삭제됐는지(404) 확인용.
export async function getCalendar(calendarId: string): Promise<GcalCalendar> {
  return gcalRequest<GcalCalendar>("GET", `/calendars/${encodeURIComponent(calendarId)}`);
}

export interface EventsListResponse {
  items: GcalApiEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

// events.list — 증분(syncToken) 또는 full. showDeleted=true 로 cancelled 포함.
// syncToken 만료 시 Google 이 410 → transport 가 GcalError(Http 410) 로 던짐.
export async function listEvents(
  calendarId: string,
  opts: { syncToken?: string | null; pageToken?: string } = {},
): Promise<EventsListResponse> {
  const params = new URLSearchParams({ showDeleted: "true", maxResults: "2500" });
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
