import { describe, expect, it } from "vitest";
import {
  buildTodoLine,
  createTodo,
  GCAL_TAG_PREFIX,
  listTodos,
  makeTodoId,
  updateTask,
} from "./tasks";
import { extractTasks } from "../lib/vault/tasks";
import { createMemoryAdapter } from "../lib/vault/adapter";

function makeAdapter() {
  const a = createMemoryAdapter();
  a.setRoot("/vault");
  return a;
}

describe("GCAL_TAG_PREFIX", () => {
  it("`gcal-` 로 고정 (eventId 가 곧 앵커)", () => {
    expect(GCAL_TAG_PREFIX).toBe("gcal-");
  });
});

describe("gcal_event_id surface (todoFromItem)", () => {
  it("#gcal-<id> 태그가 있으면 listTodos 결과에 gcal_event_id 로 노출", async () => {
    const a = makeAdapter();
    // Google event ID 형태 (base32hex: a-v, 0-9, `_`)
    await a.write("inbox.md", "# Inbox\n- [ ] 발표 --- 2026-05-22 14:00 #schedule #gcal-abc123def_45\n");
    const tasks = await listTodos(a);
    const task = tasks.find((t) => t.title === "발표");
    expect(task).toBeDefined();
    expect(task!.gcal_event_id).toBe("abc123def_45");
    expect(task!.category).toBe("schedule");
  });

  it("태그 없는 일정 task 는 gcal_event_id = null (멤버십 제외)", async () => {
    const a = makeAdapter();
    await a.write("inbox.md", "# Inbox\n- [ ] 회의 --- 2026-05-22 #schedule\n");
    const tasks = await listTodos(a);
    const task = tasks.find((t) => t.title === "회의");
    expect(task!.gcal_event_id).toBeNull();
  });
});

describe("buildTodoLine — 다일 일정 end_date 직렬화 (#5)", () => {
  it("end_date > due_date 면 `<start>..<end>` 범위 토큰", () => {
    const line = buildTodoLine({
      title: "워크샵",
      due_date: "2026-06-10",
      end_date: "2026-06-12",
    });
    expect(line).toContain("--- 2026-06-10..2026-06-12");
  });

  it("end_date 없거나 시작일과 같으면 단일 날짜 (회귀 없음)", () => {
    expect(buildTodoLine({ title: "x", due_date: "2026-06-10" })).toContain(
      "--- 2026-06-10",
    );
    expect(
      buildTodoLine({ title: "x", due_date: "2026-06-10" }),
    ).not.toContain("..");
    expect(
      buildTodoLine({ title: "x", due_date: "2026-06-10", end_date: "2026-06-10" }),
    ).not.toContain("..");
  });

  it("라인 → extractTasks 라운드트립으로 end_date 보존", () => {
    const line = buildTodoLine({
      title: "출장",
      due_date: "2026-06-10",
      end_date: "2026-06-12",
    });
    const items = extractTasks("inbox.md", `${line}\n`);
    expect(items[0].text).toBe("출장");
    expect(items[0].due).toBe("2026-06-10");
    expect(items[0].end).toBe("2026-06-12");
  });

  it("updateTask 로 end_date 추가/제거가 디스크에 반영 (#5)", async () => {
    const a = makeAdapter();
    await a.write("inbox.md", "# Inbox\n- [ ] 출장 --- 2026-06-10 #schedule\n");
    let tasks = await listTodos(a);
    const id = tasks.find((t) => t.title === "출장")!.id;

    const after = await updateTask(a, id, { end_date: "2026-06-12" });
    expect(after.end_date).toBe("2026-06-12");
    expect(after.due_date).toBe("2026-06-10");

    // 다시 읽어도 보존.
    tasks = await listTodos(a);
    expect(tasks.find((t) => t.title === "출장")!.end_date).toBe("2026-06-12");

    // 제거.
    const cleared = await updateTask(a, after.id, { end_date: null });
    expect(cleared.end_date).toBeNull();
  });
});

describe("buildTodoLine — gcal_event_id 직렬화", () => {
  it("gcal_event_id 가 있으면 #gcal-<id> 태그를 박는다", () => {
    const line = buildTodoLine({ title: "발표", category: "schedule", gcal_event_id: "evt99" });
    expect(line).toContain("#gcal-evt99");
    expect(line).toContain("#schedule");
  });

  it("extra_tags 에 gcal- prefix 가 있어도 중복으로 박지 않음", () => {
    const line = buildTodoLine({
      title: "발표",
      gcal_event_id: "evt99",
      extra_tags: ["gcal-evt99", "urgent"],
    });
    const matches = line.match(/#gcal-/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(line).toContain("#urgent");
  });

  it("gcal_event_id 없으면 태그 안 박음", () => {
    const line = buildTodoLine({ title: "발표", category: "schedule" });
    expect(line).not.toContain("#gcal-");
  });
});

describe("[REGRESSION][CRIT] updateTask round-trip — #gcal- 보존", () => {
  it("제목만 수정해도 #gcal- 태그가 살아남는다 (좀비 매핑 손실 가드)", async () => {
    const a = makeAdapter();
    await a.write(
      "inbox.md",
      "# Inbox\n- [ ] 발표 --- 2026-05-22 14:00 #schedule #gcal-keepme\n",
    );
    const id = makeTodoId("inbox.md", 1);
    const after = await updateTask(a, id, { title: "발표 수정됨" });
    expect(after.title).toBe("발표 수정됨");
    expect(after.gcal_event_id).toBe("keepme");
    const raw = await a.read("inbox.md");
    expect(raw).toContain("#gcal-keepme");
  });

  it("done toggle 후에도 #gcal- 보존", async () => {
    const a = makeAdapter();
    await a.write("inbox.md", "# Inbox\n- [ ] 발표 #schedule #gcal-keepme\n");
    const id = makeTodoId("inbox.md", 1);
    // done 단독 patch 는 toggleTask 경로 (라인 텍스트 통째 보존)
    await updateTask(a, id, { done: true });
    const raw = await a.read("inbox.md");
    expect(raw).toContain("#gcal-keepme");
    expect(raw).toContain("- [x]");
  });

  it("gcal_event_id 를 null 로 patch 하면 태그 제거 (orphan 회귀)", async () => {
    const a = makeAdapter();
    await a.write("inbox.md", "# Inbox\n- [ ] 발표 #schedule #gcal-keepme\n");
    const id = makeTodoId("inbox.md", 1);
    const after = await updateTask(a, id, { gcal_event_id: null });
    expect(after.gcal_event_id).toBeNull();
    const raw = await a.read("inbox.md");
    expect(raw).not.toContain("#gcal-");
  });

  it("gcal_event_id 를 새로 patch 하면 태그 부착 (push 후 앵커 기록)", async () => {
    const a = makeAdapter();
    await a.write("inbox.md", "# Inbox\n- [ ] 새 일정 --- 2026-05-22 #schedule\n");
    const id = makeTodoId("inbox.md", 1);
    const after = await updateTask(a, id, { gcal_event_id: "fresh01" });
    expect(after.gcal_event_id).toBe("fresh01");
    const raw = await a.read("inbox.md");
    expect(raw).toContain("#gcal-fresh01");
    // 기존 필드 보존
    expect(raw).toContain("#schedule");
    expect(after.due_date).toBe("2026-05-22");
  });
});

describe("createTodo — gcal_event_id", () => {
  it("gcal_event_id 를 넣으면 새 라인에 태그가 박힌다", async () => {
    const a = makeAdapter();
    const task = await createTodo(a, {
      title: "연동된 일정",
      category: "schedule",
      gcal_event_id: "created99",
    });
    expect(task.gcal_event_id).toBe("created99");
    const raw = await a.read("inbox.md");
    expect(raw).toContain("#gcal-created99");
  });

  it("gcal_event_id 없이 만들면 null + 태그 없음 (기존 동작 회귀)", async () => {
    const a = makeAdapter();
    const task = await createTodo(a, { title: "로컬 일정", category: "schedule" });
    expect(task.gcal_event_id).toBeNull();
    const raw = await a.read("inbox.md");
    expect(raw).not.toContain("#gcal-");
    // round-trip 으로 parser 도 일치
    const items = extractTasks("inbox.md", raw);
    expect(items.find((i) => i.text === "로컬 일정")).toBeDefined();
  });
});
