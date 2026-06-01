import { describe, expect, it } from "vitest";
import { findAllMatches } from "./findMatches";

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
