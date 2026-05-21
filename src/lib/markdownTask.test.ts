import { describe, it, expect } from "vitest";

import { toggleTaskCheckboxAt } from "./markdownTask";

describe("toggleTaskCheckboxAt", () => {
  it("toggles unchecked → checked", () => {
    const src = "- [ ] task";
    expect(toggleTaskCheckboxAt(src, 0)).toBe("- [x] task");
  });

  it("toggles checked → unchecked", () => {
    const src = "- [x] done";
    expect(toggleTaskCheckboxAt(src, 0)).toBe("- [ ] done");
  });

  it("respects capital X (treats as checked, writes lowercase x)", () => {
    const src = "- [X] done";
    expect(toggleTaskCheckboxAt(src, 0)).toBe("- [ ] done");
  });

  it("only toggles the marker at the given offset, not later ones", () => {
    const src = "- [ ] first\n- [ ] second\n- [ ] third";
    const offsetOfSecond = src.indexOf("- [ ] second");
    const out = toggleTaskCheckboxAt(src, offsetOfSecond);
    expect(out).toBe("- [ ] first\n- [x] second\n- [ ] third");
  });

  it("preserves leading indent (nested task)", () => {
    const src = "  - [ ] nested";
    expect(toggleTaskCheckboxAt(src, 0)).toBe("  - [x] nested");
  });

  it("preserves bullet style (* and +)", () => {
    expect(toggleTaskCheckboxAt("* [ ] a", 0)).toBe("* [x] a");
    expect(toggleTaskCheckboxAt("+ [x] b", 0)).toBe("+ [ ] b");
  });

  it("no-op when offset doesn't point to a task marker", () => {
    const src = "plain paragraph";
    expect(toggleTaskCheckboxAt(src, 0)).toBe(src);
  });

  it("no-op for out-of-range offset", () => {
    const src = "- [ ] task";
    expect(toggleTaskCheckboxAt(src, -1)).toBe(src);
    expect(toggleTaskCheckboxAt(src, 9999)).toBe(src);
  });

  it("does not corrupt content after the marker", () => {
    const src = "- [ ] task with **bold** and `code`";
    expect(toggleTaskCheckboxAt(src, 0)).toBe(
      "- [x] task with **bold** and `code`",
    );
  });
});
