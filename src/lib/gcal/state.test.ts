import { describe, expect, it } from "vitest";
import {
  addTombstone,
  isGuarded,
  parseSyncState,
  reduceState,
  serializeSyncState,
} from "./state";
import { emptySyncState, type SyncState } from "./types";

function sample(): SyncState {
  return {
    syncToken: "tok123",
    calendarId: "cal@group.calendar.google.com",
    lastSyncAt: "2026-05-29T10:00:00Z",
    authState: "linked",
    snapshots: { ev1: { hash: "abc", updated: "2026-05-29T09:00:00Z" } },
    tombstones: [{ eventId: "ev9", deletedAt: "2026-05-29T08:00:00Z", pushConfirmed: false }],
  };
}

describe("serialize / parse round-trip", () => {
  it("전체 상태 round-trip", () => {
    const s = sample();
    expect(parseSyncState(serializeSyncState(s))).toEqual(s);
  });

  it("손상된 JSON → empty state (묘비 유실보다 안전 복구 우선)", () => {
    expect(parseSyncState("{ not json")).toEqual(emptySyncState());
  });

  it("누락 필드 → default, 유효 묘비는 보존", () => {
    const parsed = parseSyncState(JSON.stringify({ tombstones: [{ eventId: "evX" }] }));
    expect(parsed.tombstones).toEqual([{ eventId: "evX", deletedAt: "", pushConfirmed: false }]);
    expect(parsed.authState).toBe("disconnected");
    expect(parsed.syncToken).toBeNull();
  });

  it("깨진 스냅샷 엔트리는 버리고 정상만 남김", () => {
    const parsed = parseSyncState(
      JSON.stringify({ snapshots: { good: { hash: "h", updated: "u" }, bad: { hash: 1 } } }),
    );
    expect(parsed.snapshots).toEqual({ good: { hash: "h", updated: "u" } });
  });
});

describe("addTombstone / isGuarded", () => {
  it("묘비 추가 + 가드 확인", () => {
    const s = addTombstone(emptySyncState(), "ev1", "2026-05-29T09:00:00Z");
    expect(isGuarded(s, "ev1")).toBe(true);
    expect(s.tombstones[0]).toEqual({ eventId: "ev1", deletedAt: "2026-05-29T09:00:00Z", pushConfirmed: false });
  });

  it("같은 eventId 중복 추가 안 함 (idempotent)", () => {
    let s = addTombstone(emptySyncState(), "ev1", "t1");
    s = addTombstone(s, "ev1", "t2");
    expect(s.tombstones).toHaveLength(1);
  });
});

describe("reduceState", () => {
  it("snapshot-put → 추가/갱신", () => {
    const s = reduceState(emptySyncState(), { kind: "snapshot-put", eventId: "ev1", hash: "h", updated: "u" });
    expect(s.snapshots.ev1).toEqual({ hash: "h", updated: "u" });
  });

  it("snapshot-delete → 제거", () => {
    const s = reduceState(sample(), { kind: "snapshot-delete", eventId: "ev1" });
    expect(s.snapshots.ev1).toBeUndefined();
  });

  it("tombstone-confirm → pushConfirmed true", () => {
    const s = reduceState(sample(), { kind: "tombstone-confirm", eventId: "ev9" });
    expect(s.tombstones.find((t) => t.eventId === "ev9")!.pushConfirmed).toBe(true);
  });

  it("tombstone-gc → 묘비 제거", () => {
    const s = reduceState(sample(), { kind: "tombstone-gc", eventId: "ev9" });
    expect(s.tombstones.find((t) => t.eventId === "ev9")).toBeUndefined();
  });

  it("I/O 액션 (push-delete 등) → 상태 그대로", () => {
    const before = sample();
    const after = reduceState(before, { kind: "push-delete", eventId: "ev9" });
    expect(after).toEqual(before);
  });
});
