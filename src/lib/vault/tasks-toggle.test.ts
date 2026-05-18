import { describe, it, expect } from "vitest";
import { toggleTodo, extractTodos } from "./tasks";

describe("toggleTodo", () => {
  it("- [ ] → - [x] (단순 토글)", () => {
    const raw = "- [ ] 할일\n";
    const result = toggleTodo(raw, 0, true);
    expect(result).toBe("- [x] 할일\n");
  });

  it("같은 텍스트 todo 가 2개 라인에 있어도 line 으로 구분", () => {
    const raw = "- [ ] 운동\n- [ ] 운동\n";
    const result = toggleTodo(raw, 1, true);
    expect(result).toBe("- [ ] 운동\n- [x] 운동\n");
    // 0번 라인은 그대로
    const items = extractTodos("x.md", result);
    expect(items[0].done).toBe(false);
    expect(items[1].done).toBe(true);
  });

  it("주변 텍스트 (assignee/due/tag) 보존", () => {
    const raw = "회의록\n\n- [ ] [홍] 보고서 — 5/22 #work\n끝\n";
    const result = toggleTodo(raw, 2, true);
    expect(result).toBe("회의록\n\n- [x] [홍] 보고서 — 5/22 #work\n끝\n");
  });
});
