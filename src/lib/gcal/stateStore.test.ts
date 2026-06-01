import { describe, expect, it } from "vitest";
import { stateFileName } from "./stateStore";

describe("stateFileName — vault별 상태 파일 스코핑", () => {
  it("vault id 있으면 gcal-sync-<id>.json", () => {
    expect(stateFileName("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "gcal-sync-550e8400-e29b-41d4-a716-446655440000.json",
    );
  });

  it("vault id 없으면(단일 vault legacy) gcal-sync.json", () => {
    expect(stateFileName(null)).toBe("gcal-sync.json");
  });

  it("파일명 비안전 문자는 sanitize", () => {
    expect(stateFileName("a/b c.d")).toBe("gcal-sync-a_b_c_d.json");
  });

  it("서로 다른 vault → 서로 다른 파일 (격리)", () => {
    expect(stateFileName("v1")).not.toBe(stateFileName("v2"));
  });
});
