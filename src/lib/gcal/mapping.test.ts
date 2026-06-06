import { describe, expect, it } from "vitest";
import {
  DEFAULT_DURATION_MIN,
  fieldsToGcalEvent,
  gcalEventToRemote,
  isRecurringEvent,
  type GcalApiEvent,
} from "./mapping";

describe("isRecurringEvent", () => {
  it("recurrence(RRULE) 있으면 반복", () => {
    const ev: GcalApiEvent = { id: "e1", recurrence: ["RRULE:FREQ=WEEKLY"] };
    expect(isRecurringEvent(ev)).toBe(true);
  });
  it("recurringEventId(인스턴스/예외) 있으면 반복", () => {
    const ev: GcalApiEvent = { id: "e1_20260601", recurringEventId: "e1" };
    expect(isRecurringEvent(ev)).toBe(true);
  });
  it("단일 이벤트는 반복 아님", () => {
    const ev: GcalApiEvent = { id: "e1", summary: "회의", start: { dateTime: "2026-06-01T09:00:00+09:00" } };
    expect(isRecurringEvent(ev)).toBe(false);
  });
  it("빈 recurrence 배열은 반복 아님", () => {
    expect(isRecurringEvent({ id: "e1", recurrence: [] })).toBe(false);
  });
});

describe("gcalEventToRemote", () => {
  it("시점 이벤트 (dateTime) → date + time (wall-clock 그대로)", () => {
    const ev: GcalApiEvent = {
      id: "ev1",
      status: "confirmed",
      summary: "회의",
      start: { dateTime: "2026-05-29T14:00:00+09:00" },
      end: { dateTime: "2026-05-29T14:30:00+09:00" },
      updated: "2026-05-29T05:00:00Z",
    };
    const r = gcalEventToRemote(ev);
    expect(r).toMatchObject({
      eventId: "ev1",
      cancelled: false,
      fields: { title: "회의", date: "2026-05-29", endDate: null, time: "14:00" },
      updated: "2026-05-29T05:00:00Z",
    });
  });

  it("종일 이벤트 (date) → date, time null", () => {
    const ev: GcalApiEvent = {
      id: "ev2",
      status: "confirmed",
      summary: "휴가",
      start: { date: "2026-06-01" },
      end: { date: "2026-06-02" },
    };
    const r = gcalEventToRemote(ev);
    expect(r.fields).toEqual({ title: "휴가", date: "2026-06-01", endDate: null, time: null });
  });

  it("cancelled 이벤트 → cancelled true, 필드 빈 값", () => {
    const ev: GcalApiEvent = { id: "ev3", status: "cancelled" };
    const r = gcalEventToRemote(ev);
    expect(r.cancelled).toBe(true);
    expect(r.eventId).toBe("ev3");
  });

  it("summary 없으면 빈 제목", () => {
    const ev: GcalApiEvent = { id: "ev4", status: "confirmed", start: { date: "2026-06-01" } };
    expect(gcalEventToRemote(ev).fields.title).toBe("");
  });

  it("#6 다일 종일 pull → endDate = end.date − 1 (exclusive→inclusive)", () => {
    const ev: GcalApiEvent = {
      id: "ev5",
      status: "confirmed",
      summary: "출장",
      start: { date: "2026-06-10" },
      end: { date: "2026-06-13" }, // exclusive → 포함 종료일은 6/12
    };
    const r = gcalEventToRemote(ev);
    expect(r.fields.date).toBe("2026-06-10");
    expect(r.fields.endDate).toBe("2026-06-12");
  });

  it("단일 종일(end = start+1) pull → endDate null (다일 아님)", () => {
    const ev: GcalApiEvent = {
      id: "ev6",
      status: "confirmed",
      summary: "하루",
      start: { date: "2026-06-10" },
      end: { date: "2026-06-11" },
    };
    expect(gcalEventToRemote(ev).fields.endDate).toBeNull();
  });
});

describe("fieldsToGcalEvent", () => {
  it("시점 → start=due_time, end=+30분", () => {
    const body = fieldsToGcalEvent({ title: "발표", date: "2026-05-29", endDate: null, time: "14:00" }, "Asia/Seoul");
    expect(DEFAULT_DURATION_MIN).toBe(30);
    expect(body.start.dateTime).toBe("2026-05-29T14:00:00");
    expect(body.start.timeZone).toBe("Asia/Seoul");
    expect(body.end.dateTime).toBe("2026-05-29T14:30:00");
  });

  it("시점, 30분이 자정 넘기면 end date 롤오버", () => {
    const body = fieldsToGcalEvent({ title: "심야", date: "2026-05-29", endDate: null, time: "23:50" });
    expect(body.start.dateTime).toBe("2026-05-29T23:50:00");
    expect(body.end.dateTime).toBe("2026-05-30T00:20:00");
  });

  it("시각 없음 → 종일, end.date 는 exclusive (다음날)", () => {
    const body = fieldsToGcalEvent({ title: "휴가", date: "2026-06-01", endDate: null, time: null });
    expect(body.start.date).toBe("2026-06-01");
    expect(body.end.date).toBe("2026-06-02");
    expect(body.start.dateTime).toBeUndefined();
  });

  it("월말 종일 → end 가 다음달 1일", () => {
    const body = fieldsToGcalEvent({ title: "월말", date: "2026-05-31", endDate: null, time: null });
    expect(body.end.date).toBe("2026-06-01");
  });

  it("date 없으면 throw (zero-info 이벤트 생성 불가)", () => {
    expect(() => fieldsToGcalEvent({ title: "x", date: null, endDate: null, time: null })).toThrow();
  });

  it("#6 다일 일정 push → 종일 이벤트, end.date = 종료일 + 1 (exclusive)", () => {
    const body = fieldsToGcalEvent({
      title: "출장",
      date: "2026-06-10",
      endDate: "2026-06-12",
      time: null,
    });
    expect(body.start.date).toBe("2026-06-10");
    expect(body.end.date).toBe("2026-06-13"); // 12 + 1
    expect(body.start.dateTime).toBeUndefined();
  });

  it("다일 일정은 시각이 있어도 종일로 push (다일=종일 취급)", () => {
    const body = fieldsToGcalEvent({
      title: "출장",
      date: "2026-06-10",
      endDate: "2026-06-12",
      time: "14:00",
    });
    expect(body.start.date).toBe("2026-06-10");
    expect(body.end.date).toBe("2026-06-13");
    expect(body.start.dateTime).toBeUndefined();
  });

  it("#6 다일 push → pull 라운드트립으로 endDate 보존", () => {
    const original = { title: "출장", date: "2026-06-10", endDate: "2026-06-12", time: null };
    const body = fieldsToGcalEvent(original);
    const r = gcalEventToRemote({
      id: "ev1",
      status: "confirmed",
      summary: body.summary,
      start: body.start,
      end: body.end,
      updated: "2026-06-10T05:00:00Z",
    });
    expect(r.fields).toEqual(original);
  });

  it("round-trip: insert body → gcalEventToRemote 가 같은 필드 복원", () => {
    const original = { title: "회의", date: "2026-05-29", endDate: null, time: "14:00" };
    const body = fieldsToGcalEvent(original, "Asia/Seoul");
    const r = gcalEventToRemote({
      id: "ev1",
      status: "confirmed",
      summary: body.summary,
      start: body.start,
      end: body.end,
      updated: "2026-05-29T05:00:00Z",
    });
    expect(r.fields).toEqual(original);
  });
});
