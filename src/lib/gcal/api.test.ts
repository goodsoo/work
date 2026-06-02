import { beforeEach, describe, expect, it, vi } from "vitest";

// gcalRequest 를 가로채 (method, path, body) 를 캡처 — 실제 Rust invoke 없이
// URL/바디 조립만 검증한다.
const calls: Array<{ method: string; path: string; body: unknown }> = [];
vi.mock("./transport", () => ({
  gcalRequest: vi.fn(async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body: body ?? null });
    return { items: [] };
  }),
}));

import { createCalendar, listEvents } from "./api";

beforeEach(() => {
  calls.length = 0;
});

describe("listEvents — timeZone pin (import wall-clock 가 로컬과 일치)", () => {
  // 회귀 가드: timeZone 누락 시 Google 이 캘린더 기본 tz(API 생성 캘린더는 UTC)로
  // dateTime 을 반환 → splitDateTime 이 UTC wall-clock 을 읽어 −9h(KST) 어긋났던 버그.
  it("timeZone 지정 시 events.list URL 에 timeZone 파라미터 포함", async () => {
    await listEvents("cal@group.calendar.google.com", { timeZone: "Asia/Seoul" });
    expect(calls[0].path).toContain("timeZone=Asia%2FSeoul");
  });

  it("syncToken 과 timeZone 병행 — 둘 다 URL 에 (증분 동기화도 tz pin 유지)", async () => {
    await listEvents("cal@group.calendar.google.com", {
      syncToken: "tok123",
      timeZone: "Asia/Seoul",
    });
    expect(calls[0].path).toContain("syncToken=tok123");
    expect(calls[0].path).toContain("timeZone=Asia%2FSeoul");
  });

  it("timeZone 없으면 URL 에 미포함 (옵션 누락 안전)", async () => {
    await listEvents("cal@group.calendar.google.com", {});
    expect(calls[0].path).not.toContain("timeZone=");
  });
});

describe("createCalendar — timeZone 보강 (캘린더 기본 tz 자체를 로컬로)", () => {
  it("timeZone 지정 시 생성 body 에 포함", async () => {
    await createCalendar("goodsoob", "Asia/Seoul");
    expect(calls[0].body).toMatchObject({ summary: "goodsoob", timeZone: "Asia/Seoul" });
  });

  it("timeZone 없으면 body 에 미포함 (기존 호출 호환)", async () => {
    await createCalendar("goodsoob");
    expect(calls[0].body).toEqual({ summary: "goodsoob" });
  });
});
