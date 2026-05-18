import { describe, it, expect } from "vitest";
import { extractTodos } from "./tasks";

describe("extractTodos", () => {
  it("기본 - [ ] 체크박스 추출", () => {
    const raw = "- [ ] 단순 todo\n";
    const items = extractTodos("inbox.md", raw);
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("단순 todo");
    expect(items[0].done).toBe(false);
    expect(items[0].source).toEqual({ file: "inbox.md", line: 0 });
  });

  it("[담당자] 접두 → assignee", () => {
    const raw = "- [ ] [홍길동] 보고서 작성\n";
    const items = extractTodos("inbox.md", raw);
    expect(items[0].assignee).toBe("홍길동");
    expect(items[0].text).toBe("보고서 작성");
  });

  it("— M/D → due (현재 연도)", () => {
    const raw = "- [ ] 보고서 — 5/22\n";
    const items = extractTodos("inbox.md", raw);
    const year = new Date().getFullYear();
    expect(items[0].due).toBe(`${year}-05-22`);
    expect(items[0].text).toBe("보고서");
  });

  it("— ISO date 형식 인식", () => {
    const raw = "- [ ] 회의 — 2026-05-22\n";
    const items = extractTodos("inbox.md", raw);
    expect(items[0].due).toBe("2026-05-22");
  });

  it("— HH:MM 시간 → time, isEvent=true", () => {
    const raw = "- [ ] 발표 — 14:00\n";
    const items = extractTodos("inbox.md", raw);
    expect(items[0].time).toBe("14:00");
    expect(items[0].isEvent).toBe(true);
  });

  it("#tag 다수 추출", () => {
    const raw = "- [ ] 보고서 #work #urgent\n";
    const items = extractTodos("inbox.md", raw);
    expect(items[0].tags).toContain("work");
    expect(items[0].tags).toContain("urgent");
    expect(items[0].text).toBe("보고서");
  });

  it("- [x] → done=true", () => {
    const raw = "- [x] 완료한 항목\n";
    const items = extractTodos("inbox.md", raw);
    expect(items[0].done).toBe(true);
  });

  it("복합: assignee + due + time + tags", () => {
    const raw = "- [ ] [홍길동] 보고서 작성 — 5/22 14:00 #meeting #event\n";
    const items = extractTodos("meetings/foo.md", raw);
    const t = items[0];
    expect(t.assignee).toBe("홍길동");
    expect(t.text).toBe("보고서 작성");
    expect(t.due).toMatch(/-05-22$/);
    expect(t.time).toBe("14:00");
    expect(t.tags).toContain("meeting");
    expect(t.tags).toContain("event");
    expect(t.isEvent).toBe(true);
  });

  it("코드블록 안의 체크박스는 무시", () => {
    const raw = "```\n- [ ] 코드 안\n```\n- [ ] 진짜\n";
    const items = extractTodos("inbox.md", raw);
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("진짜");
  });
});
