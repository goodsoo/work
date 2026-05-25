import { describe, expect, it } from "vitest";
import { scopedKey } from "./scopedStorage";

describe("scopedKey", () => {
  it("vault id 가 있으면 :id 를 suffix 로 붙임", () => {
    expect(scopedKey("goodsoob:meetingSort", "abc-123")).toBe(
      "goodsoob:meetingSort:abc-123",
    );
  });

  it("vault id 가 null 이면 base key 그대로", () => {
    expect(scopedKey("goodsoob:meetingSort", null)).toBe("goodsoob:meetingSort");
  });
});
