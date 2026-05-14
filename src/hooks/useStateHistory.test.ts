import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStateHistory } from "./useStateHistory";

type Doc = { title: string; body: string };
const EMPTY: Doc = { title: "", body: "" };
const REAL: Doc = { title: "회의록", body: "본문 있음" };

describe("useStateHistory reKey transition", () => {
  // Regression: MeetingForm calls useStateHistory before TanStack data arrives.
  // First render: initial=EMPTY, reKey=undefined. Second render: initial=REAL, reKey=id.
  // The undefined→id transition must reset value to the real doc, otherwise the
  // form silently shows empty fields and a single keystroke writes NULLs to DB.
  it("resets value when reKey transitions from undefined to a defined id", () => {
    const { result, rerender } = renderHook(
      ({ initial, reKey }: { initial: Doc; reKey: unknown }) =>
        useStateHistory<Doc>({ initial, reKey }),
      { initialProps: { initial: EMPTY, reKey: undefined as unknown } },
    );

    expect(result.current.value).toEqual(EMPTY);

    rerender({ initial: REAL, reKey: "meeting-abc" });

    expect(result.current.value).toEqual(REAL);
  });

  it("does not reset when reKey identity is stable across re-renders", () => {
    const { result, rerender } = renderHook(
      ({ initial, reKey }: { initial: Doc; reKey: unknown }) =>
        useStateHistory<Doc>({ initial, reKey }),
      { initialProps: { initial: REAL, reKey: "meeting-abc" } },
    );

    result.current.set({ title: "edited", body: "edited body" });
    rerender({ initial: REAL, reKey: "meeting-abc" });

    expect(result.current.value).toEqual({ title: "edited", body: "edited body" });
  });
});
