import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useStateHistory } from "./useStateHistory";

type Doc = { title: string; body: string };
const EMPTY: Doc = { title: "", body: "" };
const REAL: Doc = { title: "회의록", body: "본문 있음" };

describe("useStateHistory cacheKey transition", () => {
  // Regression: MeetingForm calls useStateHistory before TanStack data arrives.
  // First render: initial=EMPTY, cacheKey=undefined. Second render: initial=REAL,
  // cacheKey=id. The undefined→id transition must reset value to the real doc,
  // otherwise the form silently shows empty fields and a single keystroke writes
  // NULLs to DB.
  it("resets value when cacheKey transitions from undefined to a defined id", () => {
    const { result, rerender } = renderHook(
      ({ initial, cacheKey }: { initial: Doc; cacheKey: string | undefined }) =>
        useStateHistory<Doc>({ initial, cacheKey }),
      { initialProps: { initial: EMPTY, cacheKey: undefined as string | undefined } },
    );

    expect(result.current.value).toEqual(EMPTY);

    rerender({ initial: REAL, cacheKey: "meeting-undef-to-defined" });

    expect(result.current.value).toEqual(REAL);
  });

  it("does not reset when cacheKey identity is stable across re-renders", () => {
    const cacheKey = "meeting-stable";
    const { result, rerender } = renderHook(
      ({ initial }: { initial: Doc }) =>
        useStateHistory<Doc>({ initial, cacheKey }),
      { initialProps: { initial: REAL } },
    );

    act(() => {
      result.current.set({ title: "edited", body: "edited body" });
    });
    rerender({ initial: REAL });

    expect(result.current.value).toEqual({ title: "edited", body: "edited body" });
  });

  // The core P1 fix: switching cacheKey A → B → A must restore A's state
  // (value + history), so undo/redo on a previously edited memo still works
  // after navigating away and back.
  it("restores prior state when returning to a previously seen cacheKey", () => {
    const KEY_A = "memo-A-roundtrip";
    const KEY_B = "memo-B-roundtrip";
    const EDITED_A: Doc = { title: "A edited", body: "A body" };

    const { result, rerender } = renderHook(
      ({ cacheKey, initial }: { cacheKey: string; initial: Doc }) =>
        useStateHistory<Doc>({ cacheKey, initial }),
      { initialProps: { cacheKey: KEY_A, initial: REAL } },
    );

    // Edit on A — commits via internal timer; force it via flush.
    act(() => {
      result.current.set(EDITED_A);
      result.current.flush();
    });
    expect(result.current.value).toEqual(EDITED_A);
    expect(result.current.canUndo).toBe(true);

    // Switch to B with a different initial. State should reset to B's initial.
    rerender({ cacheKey: KEY_B, initial: EMPTY });
    expect(result.current.value).toEqual(EMPTY);
    expect(result.current.canUndo).toBe(false);

    // Return to A — should restore EDITED_A and its undo history.
    rerender({ cacheKey: KEY_A, initial: REAL });
    expect(result.current.value).toEqual(EDITED_A);
    expect(result.current.canUndo).toBe(true);
  });
});
