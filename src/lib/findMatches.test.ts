import { describe, expect, it } from "vitest";
import { findAllMatches, replaceAllInText } from "./findMatches";

describe("findAllMatches", () => {
  it("빈 검색어는 매치 없음", () => {
    expect(findAllMatches("hello world", "", false)).toEqual([]);
  });

  it("대소문자 무시 (기본)", () => {
    expect(findAllMatches("Foo foo FOO", "foo", false)).toEqual([0, 4, 8]);
  });

  it("대소문자 구분 모드", () => {
    expect(findAllMatches("Foo foo FOO", "foo", true)).toEqual([4]);
  });

  it("겹치는 매치도 모두 포함", () => {
    expect(findAllMatches("aaaa", "aa", false)).toEqual([0, 1, 2]);
  });

  it("한글 검색", () => {
    expect(findAllMatches("회의록 회의 회의실", "회의", false)).toEqual([0, 4, 7]);
  });

  it("매치 없으면 빈 배열", () => {
    expect(findAllMatches("hello", "xyz", false)).toEqual([]);
  });
});

describe("replaceAllInText", () => {
  it("빈 검색어는 원문 그대로", () => {
    expect(replaceAllInText("hello", "", "X", false)).toBe("hello");
  });

  it("모든 매치 치환 (대소문자 무시)", () => {
    expect(replaceAllInText("Foo foo FOO", "foo", "bar", false)).toBe(
      "bar bar bar",
    );
  });

  it("대소문자 구분 시 정확히 일치만", () => {
    expect(replaceAllInText("Foo foo FOO", "foo", "bar", true)).toBe(
      "Foo bar FOO",
    );
  });

  it("겹치는 매치는 데이터 유실 없이 비겹침으로 치환", () => {
    // "aaa" 의 "aa" 는 비겹침 1개만 → "aa" → "X", 끝의 "a" 보존.
    expect(replaceAllInText("aaa", "aa", "X", false)).toBe("Xa");
    expect(replaceAllInText("aaaa", "aa", "X", false)).toBe("XX");
  });

  it("offset 안 밀림 — 치환 길이 달라도 정상", () => {
    expect(replaceAllInText("a.b.c", ".", "---", false)).toBe("a---b---c");
  });

  it("한글 치환", () => {
    expect(replaceAllInText("회의록 회의 회의실", "회의", "미팅", false)).toBe(
      "미팅록 미팅 미팅실",
    );
  });

  it("매치 없으면 원문 그대로", () => {
    expect(replaceAllInText("hello", "xyz", "X", false)).toBe("hello");
  });

  it("빈 문자열로 치환 = 삭제", () => {
    expect(replaceAllInText("a-b-c", "-", "", false)).toBe("abc");
  });
});
