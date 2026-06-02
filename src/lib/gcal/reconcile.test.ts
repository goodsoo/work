import { describe, expect, it } from "vitest";
import {
  compareUpdated,
  MAX_BULK_PUSH_MUTATIONS,
  mutatingPushCount,
  reconcile,
  scheduleHash,
} from "./reconcile";
import type {
  LocalSchedule,
  ReconcileAction,
  ReconcileInput,
  RemoteEvent,
  ScheduleFields,
  SyncSnapshot,
  Tombstone,
} from "./types";

function fields(title: string, date: string | null, time: string | null = null): ScheduleFields {
  return { title, date, time };
}

function local(eventId: string, f: ScheduleFields, updatedAt = "2026-05-29T10:00:00Z"): LocalSchedule {
  return { taskId: `inbox.md#L1`, eventId, fields: f, updatedAt };
}

function remote(
  eventId: string,
  f: ScheduleFields,
  updated = "2026-05-29T10:00:00Z",
  cancelled = false,
): RemoteEvent {
  return { eventId, cancelled, fields: f, updated };
}

function snap(f: ScheduleFields, updated = "2026-05-29T10:00:00Z"): SyncSnapshot {
  return { hash: scheduleHash(f), updated };
}

function run(input: Partial<ReconcileInput>) {
  return reconcile({
    locals: input.locals ?? [],
    remoteDelta: input.remoteDelta ?? [],
    snapshots: input.snapshots ?? {},
    tombstones: input.tombstones ?? [],
  });
}

describe("scheduleHash", () => {
  it("같은 필드 → 같은 해시, 다른 필드 → 다른 해시", () => {
    const a = fields("회의", "2026-05-29", "14:00");
    expect(scheduleHash(a)).toBe(scheduleHash({ ...a }));
    expect(scheduleHash(a)).not.toBe(scheduleHash(fields("회의", "2026-05-29", "15:00")));
    expect(scheduleHash(a)).not.toBe(scheduleHash(fields("회의수정", "2026-05-29", "14:00")));
  });

  it("title 앞뒤 공백 무시 (trim)", () => {
    expect(scheduleHash(fields("회의 ", "2026-05-29"))).toBe(scheduleHash(fields("회의", "2026-05-29")));
  });
});

describe("compareUpdated", () => {
  it("나중 시각이 양수", () => {
    expect(compareUpdated("2026-05-29T11:00:00Z", "2026-05-29T10:00:00Z")).toBeGreaterThan(0);
    expect(compareUpdated("2026-05-29T09:00:00Z", "2026-05-29T10:00:00Z")).toBeLessThan(0);
  });
  it("파싱 실패는 동률(0)", () => {
    expect(compareUpdated("bogus", "2026-05-29T10:00:00Z")).toBe(0);
  });
});

describe("reconcile — push (로컬→원격)", () => {
  it("로컬만 변경 (원격 delta 없음) → push-update local-only", () => {
    const f0 = fields("회의", "2026-05-29", "14:00");
    const f1 = fields("회의 수정", "2026-05-29", "14:00");
    const actions = run({
      locals: [local("ev1", f1)],
      snapshots: { ev1: snap(f0) },
    });
    expect(actions).toContainEqual({ kind: "push-update", eventId: "ev1", local: local("ev1", f1), reason: "local-only" });
  });

  it("로컬 무변경 (hash == snapshot) → 아무 액션 없음", () => {
    const f0 = fields("회의", "2026-05-29", "14:00");
    const actions = run({
      locals: [local("ev1", f0)],
      snapshots: { ev1: snap(f0) },
    });
    expect(actions).toHaveLength(0);
  });
});

describe("reconcile — pull (원격→로컬)", () => {
  it("원격만 변경 → local-upsert remote-only + snapshot-put", () => {
    const f0 = fields("회의", "2026-05-29", "14:00");
    const f1 = fields("회의", "2026-05-29", "15:00");
    const actions = run({
      locals: [local("ev1", f0)],
      remoteDelta: [remote("ev1", f1, "2026-05-29T12:00:00Z")],
      snapshots: { ev1: snap(f0, "2026-05-29T10:00:00Z") },
    });
    expect(actions.find((a) => a.kind === "local-upsert")).toMatchObject({
      kind: "local-upsert",
      eventId: "ev1",
      reason: "remote-only",
      fields: f1,
    });
    expect(actions.find((a) => a.kind === "snapshot-put")).toMatchObject({ eventId: "ev1", updated: "2026-05-29T12:00:00Z" });
  });

  it("신규 원격 이벤트 (스냅샷 없음, 로컬 없음) → local-create + snapshot-put", () => {
    const f = fields("폰에서 추가", "2026-06-01", "09:00");
    const actions = run({ remoteDelta: [remote("evNew", f, "2026-06-01T08:00:00Z")] });
    expect(actions.find((a) => a.kind === "local-create")).toMatchObject({ kind: "local-create", eventId: "evNew", fields: f });
    expect(actions.find((a) => a.kind === "snapshot-put")).toBeDefined();
  });

  it("원격 cancelled (로컬 보유) → local-trash + snapshot-delete (hard-delete 아님)", () => {
    const f = fields("회의", "2026-05-29", "14:00");
    const actions = run({
      locals: [local("ev1", f)],
      remoteDelta: [remote("ev1", fields("", null, null), "2026-05-29T13:00:00Z", true)],
      snapshots: { ev1: snap(f) },
    });
    expect(actions).toContainEqual({ kind: "local-trash", eventId: "ev1", taskId: "inbox.md#L1" });
    expect(actions).toContainEqual({ kind: "snapshot-delete", eventId: "ev1" });
    // 절대 재생성 안 함
    expect(actions.find((a) => a.kind === "local-create")).toBeUndefined();
  });
});

describe("reconcile — 충돌 LWW", () => {
  it("양쪽 변경, 로컬이 더 나중 → push-update conflict-lww", () => {
    const f0 = fields("회의", "2026-05-29", "14:00");
    const fLocal = fields("로컬 수정", "2026-05-29", "14:00");
    const fRemote = fields("원격 수정", "2026-05-29", "14:00");
    const actions = run({
      locals: [local("ev1", fLocal, "2026-05-29T15:00:00Z")],
      remoteDelta: [remote("ev1", fRemote, "2026-05-29T12:00:00Z")],
      snapshots: { ev1: snap(f0, "2026-05-29T10:00:00Z") },
    });
    expect(actions.find((a) => a.kind === "push-update")).toMatchObject({ reason: "conflict-lww" });
    expect(actions.find((a) => a.kind === "local-upsert")).toBeUndefined();
  });

  it("양쪽 변경, 원격이 더 나중 → local-upsert conflict-lww", () => {
    const f0 = fields("회의", "2026-05-29", "14:00");
    const fLocal = fields("로컬 수정", "2026-05-29", "14:00");
    const fRemote = fields("원격 수정", "2026-05-29", "14:00");
    const actions = run({
      locals: [local("ev1", fLocal, "2026-05-29T11:00:00Z")],
      remoteDelta: [remote("ev1", fRemote, "2026-05-29T16:00:00Z")],
      snapshots: { ev1: snap(f0, "2026-05-29T10:00:00Z") },
    });
    expect(actions.find((a) => a.kind === "local-upsert")).toMatchObject({ reason: "conflict-lww", fields: fRemote });
    expect(actions.find((a) => a.kind === "push-update")).toBeUndefined();
  });
});

describe("[CRIT] reconcile — 좀비 부활 가드 (tombstone)", () => {
  it("미확정 묘비 + 원격 아직 살아있음 → push-delete, 절대 재생성 X", () => {
    const f = fields("삭제할 일정", "2026-05-29", "14:00");
    const tomb: Tombstone = { eventId: "ev1", deletedAt: "2026-05-29T09:00:00Z", pushConfirmed: false };
    const actions = run({
      // 원격이 delta 에서 여전히 confirmed (살아있음) — 가드 없으면 여기서 부활
      remoteDelta: [remote("ev1", f, "2026-05-29T08:00:00Z")],
      snapshots: { ev1: snap(f) },
      tombstones: [tomb],
    });
    expect(actions).toContainEqual({ kind: "push-delete", eventId: "ev1" });
    expect(actions).toContainEqual({ kind: "tombstone-confirm", eventId: "ev1" });
    expect(actions).toContainEqual({ kind: "snapshot-delete", eventId: "ev1" });
    // 핵심: 좀비 부활 0건
    expect(actions.find((a) => a.kind === "local-create")).toBeUndefined();
    expect(actions.find((a) => a.kind === "local-upsert")).toBeUndefined();
  });

  it("확정 묘비 + 원격 cancelled 확인 → tombstone-gc + snapshot-delete", () => {
    const tomb: Tombstone = { eventId: "ev1", deletedAt: "2026-05-29T09:00:00Z", pushConfirmed: true };
    const actions = run({
      remoteDelta: [remote("ev1", fields("", null, null), "2026-05-29T13:00:00Z", true)],
      snapshots: { ev1: snap(fields("x", "2026-05-29")) },
      tombstones: [tomb],
    });
    expect(actions).toContainEqual({ kind: "tombstone-gc", eventId: "ev1" });
    expect(actions).toContainEqual({ kind: "snapshot-delete", eventId: "ev1" });
  });

  it("확정 묘비 + 원격 아직 확인 안 됨 (delta 에 없음) → 묘비 보존, GC 안 함", () => {
    const tomb: Tombstone = { eventId: "ev1", deletedAt: "2026-05-29T09:00:00Z", pushConfirmed: true };
    const actions = run({ tombstones: [tomb] });
    expect(actions.find((a) => a.kind === "tombstone-gc")).toBeUndefined();
    expect(actions.find((a) => a.kind === "push-delete")).toBeUndefined();
  });
});

describe("reconcile — 고아 / 엣지", () => {
  it("로컬 사라짐 + 스냅샷 있음 + 묘비 없음 (수동 태그 제거) → orphan, 재생성 X", () => {
    const f = fields("회의", "2026-05-29", "14:00");
    const actions = run({
      remoteDelta: [remote("ev1", f, "2026-05-29T12:00:00Z")],
      snapshots: { ev1: snap(f) },
    });
    expect(actions).toContainEqual({ kind: "orphan", eventId: "ev1" });
    expect(actions.find((a) => a.kind === "local-create")).toBeUndefined();
  });

  it("로컬·원격 모두 없고 스냅샷만 (stale) → orphan", () => {
    const actions = run({ snapshots: { ev1: snap(fields("x", "2026-05-29")) } });
    expect(actions).toContainEqual({ kind: "orphan", eventId: "ev1" });
  });

  it("원격 cancelled + 로컬 이미 없음 → snapshot-delete 만", () => {
    const actions = run({
      remoteDelta: [remote("ev1", fields("", null, null), "2026-05-29T13:00:00Z", true)],
      snapshots: { ev1: snap(fields("x", "2026-05-29")) },
    });
    expect(actions).toContainEqual({ kind: "snapshot-delete", eventId: "ev1" });
    expect(actions.find((a) => a.kind === "local-trash")).toBeUndefined();
  });

  it("로컬 변경 + 원격 delta 에 같은 hash 에코 → local-only push (이중 처리 X)", () => {
    const f0 = fields("회의", "2026-05-29", "14:00");
    const f1 = fields("회의 수정", "2026-05-29", "14:00");
    const actions = run({
      locals: [local("ev1", f1)],
      // 원격 delta 에 있지만 hash 는 snapshot 과 동일 (우리 push 의 에코)
      remoteDelta: [remote("ev1", f0, "2026-05-29T10:00:00Z")],
      snapshots: { ev1: snap(f0) },
    });
    expect(actions.find((a) => a.kind === "push-update")).toMatchObject({ reason: "local-only" });
    expect(actions.find((a) => a.kind === "local-upsert")).toBeUndefined();
  });
});

describe("reconcile — calendar-unlink (날짜 제거 = 캘린더에서 제거)", () => {
  it("앵커 있는 로컬에서 날짜 제거 (원격 delta 없음) → calendar-unlink (push-update 아님)", () => {
    const actions = run({
      locals: [local("ev1", fields("회의", null, null))],
      snapshots: { ev1: snap(fields("회의", "2026-05-29", "14:00")) },
    });
    expect(actions).toContainEqual({ kind: "calendar-unlink", eventId: "ev1", taskId: "inbox.md#L1" });
    // 날짜 없는 일정을 push-update 하면 mapping 이 throw → 절대 emit 되면 안 됨.
    expect(actions.find((a) => a.kind === "push-update")).toBeUndefined();
  });

  it("날짜 제거 + 원격은 아직 살아있음 → calendar-unlink (원격 변경 무시하고 제거 우선)", () => {
    const actions = run({
      locals: [local("ev1", fields("회의", null, null))],
      remoteDelta: [remote("ev1", fields("회의", "2026-05-29", "14:00"), "2026-05-29T12:00:00Z")],
      snapshots: { ev1: snap(fields("회의", "2026-05-29", "14:00")) },
    });
    expect(actions).toContainEqual({ kind: "calendar-unlink", eventId: "ev1", taskId: "inbox.md#L1" });
    expect(actions.find((a) => a.kind === "local-upsert")).toBeUndefined();
    expect(actions.find((a) => a.kind === "push-update")).toBeUndefined();
  });

  it("묘비가 있으면 날짜 제거보다 묘비 분기 우선 (calendar-unlink 안 함)", () => {
    const actions = run({
      locals: [local("ev1", fields("회의", null, null))],
      tombstones: [{ eventId: "ev1", deletedAt: "2026-05-29T09:00:00Z", pushConfirmed: false }],
    });
    expect(actions.find((a) => a.kind === "calendar-unlink")).toBeUndefined();
    expect(actions).toContainEqual({ kind: "push-delete", eventId: "ev1" });
  });
});

describe("mutatingPushCount / 대량 push 가드 (#2)", () => {
  it("push-update·push-delete 만 센다 (push-create 제외)", () => {
    const actions: ReconcileAction[] = [
      { kind: "push-update", eventId: "a", local: {} as never, reason: "local-only" },
      { kind: "push-delete", eventId: "b" },
      { kind: "local-create", eventId: "c", fields: {} as never, updated: "" },
      { kind: "snapshot-put", eventId: "d", hash: "h", updated: "" },
    ];
    expect(mutatingPushCount(actions)).toBe(2);
  });
  it("임계치는 1인 도구 정상 사용(1~2개)보다 충분히 큼", () => {
    expect(MAX_BULK_PUSH_MUTATIONS).toBeGreaterThanOrEqual(8);
  });
  it("이번 사고(19개 일괄 push)는 임계치 초과 → 가드 발동", () => {
    const actions: ReconcileAction[] = Array.from({ length: 19 }, (_, i) => ({
      kind: "push-update" as const,
      eventId: `ev${i}`,
      local: {} as never,
      reason: "local-only" as const,
    }));
    expect(mutatingPushCount(actions) > MAX_BULK_PUSH_MUTATIONS).toBe(true);
  });
});
