import { describe, it, expect } from "vitest";
import { extractTasks } from "./tasks";

describe("extractTasks", () => {
  it("기본 - [ ] 체크박스 추출", () => {
    const raw = "- [ ] 단순 task\n";
    const items = extractTasks("inbox.md", raw);
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("단순 task");
    expect(items[0].done).toBe(false);
    expect(items[0].source).toEqual({ file: "inbox.md", line: 0 });
  });

  it("[담당자] 같은 bracket 도 본문 일부 — assignee 추출 폐기 (UI 기능 없음)", () => {
    const raw = "- [ ] [홍길동] 보고서 작성\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].text).toBe("[홍길동] 보고서 작성");
  });

  it("— M/D → due (현재 연도)", () => {
    const raw = "- [ ] 보고서 — 5/22\n";
    const items = extractTasks("inbox.md", raw);
    const year = new Date().getFullYear();
    expect(items[0].due).toBe(`${year}-05-22`);
    expect(items[0].text).toBe("보고서");
  });

  it("— ISO date 형식 인식", () => {
    const raw = "- [ ] 회의 — 2026-05-22\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].due).toBe("2026-05-22");
  });

  it("— HH:MM 시간 → time", () => {
    const raw = "- [ ] 발표 — 14:00\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].time).toBe("14:00");
  });

  it("--- (triple hyphen) 도 em dash 와 동일 매칭 (키보드 친화)", () => {
    const raw = "- [ ] 보고서 --- 5/22 14:00\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].text).toBe("보고서");
    expect(items[0].due).toMatch(/-05-22$/);
    expect(items[0].time).toBe("14:00");
  });

  it("--- 뒤 date/time 매칭 실패 시 split 무효 → 본문 보존", () => {
    // 외부 편집 / 사용자 실수로 --- 뒤 패턴 망가진 케이스. parser 가
    // graceful 해야 본문 손실 X.
    const raw = "- [ ] 보고서 --- 망가진뒤\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].text).toBe("보고서 --- 망가진뒤");
    expect(items[0].due).toBeUndefined();
    expect(items[0].time).toBeUndefined();
  });

  it("자연어 날짜 (내일, 월) → due 매칭 + title 에서 제거", () => {
    const raw = "- [ ] 회의 --- 내일\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].text).toBe("회의");
    expect(items[0].due).toBeDefined();
  });

  it("자연어 시간 (오후 2시) → time 매칭", () => {
    const raw = "- [ ] 발표 --- 오후 2시\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].text).toBe("발표");
    expect(items[0].time).toBe("14:00");
  });

  it("M/D + 한글 시간 (6/07 18시) → due + time 분리 매칭 (date-like time false positive 차단)", () => {
    const raw = "- [ ] 보고서 --- 6/07 18시\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].text).toBe("보고서");
    expect(items[0].due).toMatch(/-06-07$/);
    expect(items[0].time).toBe("18:00");
  });

  it("#tag 다수 추출", () => {
    const raw = "- [ ] 보고서 #work #urgent\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].tags).toContain("work");
    expect(items[0].tags).toContain("urgent");
    expect(items[0].text).toBe("보고서");
  });

  it("- [x] → done=true", () => {
    const raw = "- [x] 완료한 항목\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].done).toBe(true);
  });

  it("복합: bracket + due + time + tags (bracket 는 본문 일부)", () => {
    const raw = "- [ ] [홍길동] 보고서 작성 — 5/22 14:00 #meeting #event\n";
    const items = extractTasks("notes/foo.md", raw);
    const t = items[0];
    expect(t.text).toBe("[홍길동] 보고서 작성");
    expect(t.due).toMatch(/-05-22$/);
    expect(t.time).toBe("14:00");
    expect(t.tags).toContain("meeting");
    expect(t.tags).toContain("event");
  });

  it("코드블록 안의 체크박스는 무시", () => {
    const raw = "```\n- [ ] 코드 안\n```\n- [ ] 진짜\n";
    const items = extractTasks("inbox.md", raw);
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("진짜");
  });

  it("다일 범위 `<start>..<end>` → due=시작, end=종료 (#5)", () => {
    const raw = "- [ ] 워크샵 --- 2026-06-10..2026-06-12\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].text).toBe("워크샵");
    expect(items[0].due).toBe("2026-06-10");
    expect(items[0].end).toBe("2026-06-12");
  });

  it("다일 범위 + 시각 → due/end/time 모두 분리", () => {
    const raw = "- [ ] 출장 --- 2026-06-10..2026-06-12 14:00\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].text).toBe("출장");
    expect(items[0].due).toBe("2026-06-10");
    expect(items[0].end).toBe("2026-06-12");
    expect(items[0].time).toBe("14:00");
  });

  it("`..` 없는 기존 단일-날짜 라인은 end 없이 단일로 (회귀 없음, #5)", () => {
    const raw = "- [ ] 회의 --- 2026-06-10\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].due).toBe("2026-06-10");
    expect(items[0].end).toBeUndefined();
  });

  it("end == start 범위는 단일 취급 (end undefined)", () => {
    const raw = "- [ ] 단일 --- 2026-06-10..2026-06-10\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].due).toBe("2026-06-10");
    expect(items[0].end).toBeUndefined();
  });

  it("역전 범위(end < start)는 start 만 살림", () => {
    const raw = "- [ ] 역전 --- 2026-06-12..2026-06-10\n";
    const items = extractTasks("inbox.md", raw);
    expect(items[0].due).toBe("2026-06-12");
    expect(items[0].end).toBeUndefined();
  });
});
