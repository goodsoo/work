import { describe, it, expect } from "vitest";
import { joinAbs } from "./adapter";

describe("joinAbs — path traversal 가드", () => {
  it("진짜 traversal 세그먼트(..)는 차단", () => {
    expect(() => joinAbs("/vault", "../leak")).toThrow(/traversal/);
    expect(() => joinAbs("/vault", "work/../leak")).toThrow(/traversal/);
    expect(() => joinAbs("/vault", "..")).toThrow(/traversal/);
  });

  it("절대경로는 차단", () => {
    expect(() => joinAbs("/vault", "/etc/passwd")).toThrow(/relative/);
  });

  it("파일명에 들어간 substring '..' 는 정상 통과 (오탐 회귀 방지)", () => {
    // 제목이 마침표로 끝나는 노트 → `있다.` + `.md` = `있다..md`. 옛 substring
    // 가드가 이걸 traversal 로 오탐해 scanMeetings 가 노트를 통째 skip(사라짐) 시켰음.
    expect(joinAbs("/vault", "notes/글쓰기/학원 등록했는데 전여친이 있다..md")).toBe(
      "/vault/notes/글쓰기/학원 등록했는데 전여친이 있다..md",
    );
    expect(joinAbs("/vault", "notes/2,3년차 돌아간다면.. (커뮤글).md")).toBe(
      "/vault/notes/2,3년차 돌아간다면.. (커뮤글).md",
    );
    expect(joinAbs("/vault", "a..b.md")).toBe("/vault/a..b.md");
  });

  it("root 끝 슬래시 정규화 + 빈 rel = root", () => {
    expect(joinAbs("/vault/", "notes/a.md")).toBe("/vault/notes/a.md");
    expect(joinAbs("/vault", "")).toBe("/vault");
    expect(joinAbs("/vault", "./notes/a.md")).toBe("/vault/notes/a.md");
  });
});
