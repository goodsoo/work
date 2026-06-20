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

const INBOX = "tasks/inbox.md";

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
    await a.write(INBOX, "# 미분류\n- [ ] 발표 --- 2026-05-22 14:00 #gcal-abc123def_45\n");
    const tasks = await listTodos(a);
    const task = tasks.find((t) => t.title === "발표");
    expect(task).toBeDefined();
    expect(task!.gcal_event_id).toBe("abc123def_45");
  });

  it("태그 없는 task 는 gcal_event_id = null (멤버십 제외)", async () => {
    const a = makeAdapter();
    await a.write(INBOX, "# 미분류\n- [ ] 회의 --- 2026-05-22\n");
    const tasks = await listTodos(a);
    const task = tasks.find((t) => t.title === "회의");
    expect(task!.gcal_event_id).toBeNull();
  });
});

describe("buildTodoLine — 단일 날짜만 (다일은 일정 전용)", () => {
  it("due_date 는 단일 날짜로 직렬화 (범위 토큰 없음)", () => {
    const line = buildTodoLine({ title: "보고서", due_date: "2026-06-10" });
    expect(line).toContain("--- 2026-06-10");
    expect(line).not.toContain("..");
  });

  it("카테고리 태그를 박지 않는다 (모델 분리)", () => {
    const line = buildTodoLine({ title: "x", due_date: "2026-06-10" });
    expect(line).not.toContain("#work");
    expect(line).not.toContain("#schedule");
    expect(line).not.toContain("#other");
  });

  it("라인 → extractTasks 라운드트립으로 텍스트·날짜 보존", () => {
    const line = buildTodoLine({ title: "보고서", due_date: "2026-06-10" });
    const items = extractTasks(INBOX, `${line}\n`);
    expect(items[0].text).toBe("보고서");
    expect(items[0].due).toBe("2026-06-10");
  });
});

describe("buildTodoLine — gcal_event_id 직렬화", () => {
  it("gcal_event_id 가 있으면 #gcal-<id> 태그를 박는다", () => {
    const line = buildTodoLine({ title: "발표", gcal_event_id: "evt99" });
    expect(line).toContain("#gcal-evt99");
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
    const line = buildTodoLine({ title: "발표" });
    expect(line).not.toContain("#gcal-");
  });
});

describe("[REGRESSION][CRIT] updateTask round-trip — #gcal- 보존", () => {
  it("제목만 수정해도 #gcal- 태그가 살아남는다 (좀비 매핑 손실 가드)", async () => {
    const a = makeAdapter();
    await a.write(
      INBOX,
      "# 미분류\n- [ ] 발표 --- 2026-05-22 14:00 #gcal-keepme\n",
    );
    const id = makeTodoId(INBOX, 1);
    const after = await updateTask(a, id, { title: "발표 수정됨" });
    expect(after.title).toBe("발표 수정됨");
    expect(after.gcal_event_id).toBe("keepme");
    const raw = await a.read(INBOX);
    expect(raw).toContain("#gcal-keepme");
  });

  it("done toggle 후에도 #gcal- 보존", async () => {
    const a = makeAdapter();
    await a.write(INBOX, "# 미분류\n- [ ] 발표 #gcal-keepme\n");
    const id = makeTodoId(INBOX, 1);
    // done 단독 patch 는 toggleTask 경로 (라인 텍스트 통째 보존)
    await updateTask(a, id, { done: true });
    const raw = await a.read(INBOX);
    expect(raw).toContain("#gcal-keepme");
    expect(raw).toContain("- [x]");
  });

  it("옛 카테고리 태그(#work/#schedule/#other)는 update 시 제거된다", async () => {
    const a = makeAdapter();
    await a.write(INBOX, "# 미분류\n- [ ] 발표 --- 2026-05-22 #schedule #gcal-keepme\n");
    const id = makeTodoId(INBOX, 1);
    const after = await updateTask(a, id, { title: "발표2" });
    expect(after.title).toBe("발표2");
    const raw = await a.read(INBOX);
    expect(raw).not.toContain("#schedule");
    expect(raw).toContain("#gcal-keepme"); // gcal 앵커는 보존
  });

  it("gcal_event_id 를 null 로 patch 하면 태그 제거 (orphan 회귀)", async () => {
    const a = makeAdapter();
    await a.write(INBOX, "# 미분류\n- [ ] 발표 #gcal-keepme\n");
    const id = makeTodoId(INBOX, 1);
    const after = await updateTask(a, id, { gcal_event_id: null });
    expect(after.gcal_event_id).toBeNull();
    const raw = await a.read(INBOX);
    expect(raw).not.toContain("#gcal-");
  });

  it("gcal_event_id 를 새로 patch 하면 태그 부착 (push 후 앵커 기록)", async () => {
    const a = makeAdapter();
    await a.write(INBOX, "# 미분류\n- [ ] 새 일정 --- 2026-05-22\n");
    const id = makeTodoId(INBOX, 1);
    const after = await updateTask(a, id, { gcal_event_id: "fresh01" });
    expect(after.gcal_event_id).toBe("fresh01");
    const raw = await a.read(INBOX);
    expect(raw).toContain("#gcal-fresh01");
    expect(after.due_date).toBe("2026-05-22");
  });
});

describe("createTodo", () => {
  it("기본은 tasks/inbox.md 에 추가", async () => {
    const a = makeAdapter();
    const task = await createTodo(a, { title: "미분류 할 일" });
    expect(task._source.file).toBe(INBOX);
    const raw = await a.read(INBOX);
    expect(raw).toContain("미분류 할 일");
  });

  it("target_file 을 주면 그 프로젝트 파일에 추가", async () => {
    const a = makeAdapter();
    const task = await createTodo(a, {
      title: "프로젝트 할 일",
      target_file: "tasks/프로젝트A.md",
    });
    expect(task._source.file).toBe("tasks/프로젝트A.md");
    const raw = await a.read("tasks/프로젝트A.md");
    expect(raw).toContain("프로젝트 할 일");
  });

  it("gcal_event_id 를 넣으면 새 라인에 태그가 박힌다", async () => {
    const a = makeAdapter();
    const task = await createTodo(a, {
      title: "연동된 일정",
      gcal_event_id: "created99",
    });
    expect(task.gcal_event_id).toBe("created99");
    const raw = await a.read(INBOX);
    expect(raw).toContain("#gcal-created99");
  });
});

describe("listTodos — tasks/ 폴더 전체 스캔", () => {
  it("여러 프로젝트 파일을 가로질러 수집 + source.file 이 프로젝트를 가리킴", async () => {
    const a = makeAdapter();
    await a.write("tasks/inbox.md", "# 미분류\n- [ ] A\n");
    await a.write("tasks/프로젝트X.md", "# 프로젝트X\n- [ ] B\n");
    const tasks = await listTodos(a);
    const a1 = tasks.find((t) => t.title === "A");
    const b1 = tasks.find((t) => t.title === "B");
    expect(a1!._source.file).toBe("tasks/inbox.md");
    expect(b1!._source.file).toBe("tasks/프로젝트X.md");
  });
});
