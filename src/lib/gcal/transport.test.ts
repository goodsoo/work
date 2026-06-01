import { describe, expect, it } from "vitest";
import { GcalError, parseGcalError } from "./transport";

describe("parseGcalError — Rust GcalError tagged union → typed", () => {
  it("Http → status/body 보존 (executor 가 404/410 분기)", () => {
    const e = parseGcalError({ kind: "Http", detail: { status: 404, body: "Not Found" } });
    expect(e.kind).toBe("Http");
    expect(e.httpStatus).toBe(404);
    expect(e.body).toBe("Not Found");
    expect(e.needsReauth).toBe(false);
  });

  it("410 (syncToken 만료) status 잡힘", () => {
    const e = parseGcalError({ kind: "Http", detail: { status: 410, body: "Sync token expired" } });
    expect(e.httpStatus).toBe(410);
  });

  it("AuthExpired → needsReauth true", () => {
    const e = parseGcalError({ kind: "AuthExpired" });
    expect(e.kind).toBe("AuthExpired");
    expect(e.needsReauth).toBe(true);
  });

  it("NotLinked → needsReauth true", () => {
    const e = parseGcalError({ kind: "NotLinked" });
    expect(e.needsReauth).toBe(true);
  });

  it("NotConfigured → detail 메시지 보존", () => {
    const e = parseGcalError({ kind: "NotConfigured", detail: "GCAL_CLIENT_SECRET 없음" });
    expect(e.kind).toBe("NotConfigured");
    expect(e.message).toContain("GCAL_CLIENT_SECRET");
  });

  it("Network → detail 메시지", () => {
    const e = parseGcalError({ kind: "Network", detail: "연결 실패" });
    expect(e.kind).toBe("Network");
    expect(e.message).toBe("연결 실패");
  });

  it("문자열 raw → Internal", () => {
    expect(parseGcalError("boom").kind).toBe("Internal");
  });

  it("이미 GcalError 면 그대로 통과", () => {
    const orig = new GcalError("Http", "x", 500, "b");
    expect(parseGcalError(orig)).toBe(orig);
  });

  it("null/이상한 값 → Internal (크래시 X)", () => {
    expect(parseGcalError(null).kind).toBe("Internal");
    expect(parseGcalError(42).kind).toBe("Internal");
  });
});
