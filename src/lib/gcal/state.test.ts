import { describe, expect, it } from "vitest";
import {
  addTombstone,
  findAdoptableOrphan,
  isGuarded,
  parseSyncState,
  reduceState,
  serializeSyncState,
  unlinkEvent,
} from "./state";
import { emptySyncState, type SyncState } from "./types";

function sample(): SyncState {
  return {
    syncToken: "tok123",
    calendarId: "cal@group.calendar.google.com",
    calendarName: "goodsoob",
    lastSyncAt: "2026-05-29T10:00:00Z",
    authState: "linked",
    autoSyncEnabled: true,
    snapshots: { ev1: { hash: "abc", updated: "2026-05-29T09:00:00Z" } },
    tombstones: [{ eventId: "ev9", deletedAt: "2026-05-29T08:00:00Z", pushConfirmed: false }],
    tzImportFixApplied: true,
    vaultPath: "/Users/me/Vault",
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

describe("unlinkEvent (날짜 제거 = 캘린더에서 제거)", () => {
  it("pushConfirmed:true 묘비 추가 + 스냅샷 청소", () => {
    const s = unlinkEvent(sample(), "ev1", "2026-05-29T11:00:00Z");
    expect(s.snapshots.ev1).toBeUndefined();
    const tomb = s.tombstones.find((t) => t.eventId === "ev1");
    expect(tomb).toEqual({ eventId: "ev1", deletedAt: "2026-05-29T11:00:00Z", pushConfirmed: true });
  });

  it("기존 묘비가 있으면 pushConfirmed 만 true 로 (중복 X)", () => {
    let s = addTombstone(emptySyncState(), "ev1", "t0");
    s = unlinkEvent(s, "ev1", "t1");
    expect(s.tombstones).toHaveLength(1);
    expect(s.tombstones[0].pushConfirmed).toBe(true);
  });
});

describe("parseSyncState — 신규 필드", () => {
  it("autoSyncEnabled 누락 → default true", () => {
    expect(parseSyncState(JSON.stringify({})).autoSyncEnabled).toBe(true);
  });
  it("autoSyncEnabled false 명시 → false", () => {
    expect(parseSyncState(JSON.stringify({ autoSyncEnabled: false })).autoSyncEnabled).toBe(false);
  });
  it("tzImportFixApplied 누락(구버전 파일) → false (첫 sync 가 1회 복구)", () => {
    expect(parseSyncState(JSON.stringify({})).tzImportFixApplied).toBe(false);
  });
  it("tzImportFixApplied true 명시 → true (재복구 안 함)", () => {
    expect(parseSyncState(JSON.stringify({ tzImportFixApplied: true })).tzImportFixApplied).toBe(true);
  });
  it("emptySyncState(신규 vault) → tzImportFixApplied true (손상 이력 없음)", () => {
    expect(emptySyncState().tzImportFixApplied).toBe(true);
  });
  it("vaultPath 누락 → null", () => {
    expect(parseSyncState(JSON.stringify({})).vaultPath).toBeNull();
  });
  it("vaultPath 보존", () => {
    expect(parseSyncState(JSON.stringify({ vaultPath: "/a/b" })).vaultPath).toBe("/a/b");
  });
  it("calendarName round-trip", () => {
    expect(parseSyncState(JSON.stringify({ calendarName: "내 캘린더" })).calendarName).toBe("내 캘린더");
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

describe("findAdoptableOrphan — vault id 변경 시 고아 상태 입양 대상 선택", () => {
  const target = "gcal-sync-NEWID.json";
  it("같은 vaultPath 의 고아 파일을 찾는다", () => {
    const cands = [
      { name: "gcal-sync-OLDID.json", vaultPath: "/Users/me/AGR" },
      { name: "gcal-sync-OTHER.json", vaultPath: "/Users/me/Other" },
    ];
    expect(findAdoptableOrphan(cands, "/Users/me/AGR", target)).toBe("gcal-sync-OLDID.json");
  });
  it("자기 자신(target)은 제외", () => {
    const cands = [{ name: target, vaultPath: "/Users/me/AGR" }];
    expect(findAdoptableOrphan(cands, "/Users/me/AGR", target)).toBeNull();
  });
  it("vaultPath stamp 없는 옛 파일은 입양 불가 (null)", () => {
    const cands = [{ name: "gcal-sync-OLDID.json", vaultPath: null }];
    expect(findAdoptableOrphan(cands, "/Users/me/AGR", target)).toBeNull();
  });
  it("path 불일치면 입양 안 함", () => {
    const cands = [{ name: "gcal-sync-OLDID.json", vaultPath: "/Users/me/Different" }];
    expect(findAdoptableOrphan(cands, "/Users/me/AGR", target)).toBeNull();
  });
  it("gcal-sync- 접두사 아닌 파일은 무시", () => {
    const cands = [{ name: "vaults.json", vaultPath: "/Users/me/AGR" }];
    expect(findAdoptableOrphan(cands, "/Users/me/AGR", target)).toBeNull();
  });
});
