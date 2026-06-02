import {
  emptySyncState,
  type ReconcileAction,
  type SyncSnapshot,
  type SyncState,
  type Tombstone,
} from "./types";

// 기기 로컬 sync 상태 직렬화. appDataDir 의 단일 JSON 파일 (vault 아님 → Obsidian
// 편집 대상 아님 → md/yaml 불필요, JSON 이 자연스럽고 견고). 실제 read/write 는
// Tauri fs 박막이 담당 (T2/T3). 여기선 순수 (de)serialize 로 단위 테스트 가능.

const STATE_VERSION = 1;

export function serializeSyncState(state: SyncState): string {
  return JSON.stringify({ version: STATE_VERSION, ...state }, null, 2);
}

// 손상/구버전/누락 필드에 관대 — 부분 파싱 실패가 전체 상태(특히 묘비) 유실로
// 이어지면 좀비 부활 위험. 못 읽는 필드만 default 로 떨어뜨린다.
export function parseSyncState(raw: string): SyncState {
  const base = emptySyncState();
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return base;
  }
  if (typeof obj !== "object" || obj === null) return base;
  const o = obj as Record<string, unknown>;

  const snapshots: Record<string, SyncSnapshot> = {};
  if (o.snapshots && typeof o.snapshots === "object") {
    for (const [eventId, v] of Object.entries(o.snapshots as Record<string, unknown>)) {
      if (v && typeof v === "object") {
        const s = v as Record<string, unknown>;
        if (typeof s.hash === "string" && typeof s.updated === "string") {
          snapshots[eventId] = { hash: s.hash, updated: s.updated };
        }
      }
    }
  }

  const tombstones: Tombstone[] = [];
  if (Array.isArray(o.tombstones)) {
    for (const v of o.tombstones) {
      if (v && typeof v === "object") {
        const t = v as Record<string, unknown>;
        if (typeof t.eventId === "string") {
          tombstones.push({
            eventId: t.eventId,
            deletedAt: typeof t.deletedAt === "string" ? t.deletedAt : "",
            pushConfirmed: t.pushConfirmed === true,
          });
        }
      }
    }
  }

  const authState = o.authState === "linked" ? "linked" : "disconnected";

  return {
    syncToken: typeof o.syncToken === "string" ? o.syncToken : null,
    calendarId: typeof o.calendarId === "string" ? o.calendarId : null,
    calendarName: typeof o.calendarName === "string" ? o.calendarName : null,
    lastSyncAt: typeof o.lastSyncAt === "string" ? o.lastSyncAt : null,
    authState,
    // 누락(구버전 상태 파일) 시 default true — 연동돼 있으면 자동 동기화가 기본.
    autoSyncEnabled: o.autoSyncEnabled === false ? false : true,
    // 기존 상태 파일엔 이 키가 없다(undefined) → false 로 떨어져 tz fix 후 첫 sync 가
    // 1회 full pull 복구를 돌린다. 이미 복구한 파일만 true 로 저장돼 재실행을 막는다.
    tzImportFixApplied: o.tzImportFixApplied === true,
    vaultPath: typeof o.vaultPath === "string" ? o.vaultPath : null,
    allowBulkPushOnce: o.allowBulkPushOnce === true,
    snapshots,
    tombstones,
  };
}

// 고아 상태파일 입양 대상 선택 (순수). vault id 가 remove+재등록으로 바뀌면 옛
// id-keyed 상태가 고아가 된다. 같은 vaultPath 를 stamp 한 다른 gcal-sync-*.json 을
// 찾아 현재 id 의 파일명으로 rename 하면 연결·snapshot·tombstone 이 살아난다.
// targetName(현재 id 파일) 자신과 stamp 없는 옛 파일은 제외. 여러 후보면 첫 매치.
export function findAdoptableOrphan(
  candidates: Array<{ name: string; vaultPath: string | null }>,
  activeVaultPath: string,
  targetName: string,
): string | null {
  for (const c of candidates) {
    if (c.name === targetName) continue;
    if (!c.name.startsWith("gcal-sync-") || !c.name.endsWith(".json")) continue;
    if (c.vaultPath && c.vaultPath === activeVaultPath) return c.name;
  }
  return null;
}

// ─── 묘비 CRUD (순수) ────────────────────────────────────────────────────────

// 로컬 일정이 휴지통行 할 때 호출. 같은 eventId 묘비 중복 방지 (idempotent).
export function addTombstone(state: SyncState, eventId: string, deletedAt: string): SyncState {
  if (state.tombstones.some((t) => t.eventId === eventId)) return state;
  return {
    ...state,
    tombstones: [...state.tombstones, { eventId, deletedAt, pushConfirmed: false }],
  };
}

export function isGuarded(state: SyncState, eventId: string): boolean {
  return state.tombstones.some((t) => t.eventId === eventId);
}

// 캘린더에서 제거(날짜 삭제)된 일정. executor 가 이미 events.delete 를 마쳤으므로
// pushConfirmed:true 묘비 + 스냅샷 청소. 다음 delta 에서 cancelled 에코가 오면
// reconcile 의 tombstone-gc 가 정리한다. addTombstone(pushConfirmed:false)과 달리
// "다시 push-delete" 를 유발하지 않는다 (이미 삭제 완료).
export function unlinkEvent(state: SyncState, eventId: string, deletedAt: string): SyncState {
  const exists = state.tombstones.some((t) => t.eventId === eventId);
  const tombstones = exists
    ? state.tombstones.map((t) => (t.eventId === eventId ? { ...t, pushConfirmed: true } : t))
    : [...state.tombstones, { eventId, deletedAt, pushConfirmed: true }];
  const snapshots = { ...state.snapshots };
  delete snapshots[eventId];
  return { ...state, tombstones, snapshots };
}

// ─── 액션 → 상태 reduce (순수) ───────────────────────────────────────────────
//
// reconcile 이 만든 액션 중 **상태 변경**(스냅샷·묘비) 계열만 적용. push-*/local-*
// 같은 I/O 는 executor 가 수행 — 단, tombstone-confirm 은 executor 가 events.delete
// 성공을 확인한 뒤에 부른다(여기선 그 시점에 호출되는 전제). 한 액션씩 적용해
// executor 가 I/O 성공/실패에 맞춰 순서를 제어할 수 있게 한다.
export function reduceState(state: SyncState, action: ReconcileAction): SyncState {
  switch (action.kind) {
    case "snapshot-put":
      return {
        ...state,
        snapshots: { ...state.snapshots, [action.eventId]: { hash: action.hash, updated: action.updated } },
      };
    case "snapshot-delete": {
      const next = { ...state.snapshots };
      delete next[action.eventId];
      return { ...state, snapshots: next };
    }
    case "tombstone-confirm":
      return {
        ...state,
        tombstones: state.tombstones.map((t) =>
          t.eventId === action.eventId ? { ...t, pushConfirmed: true } : t,
        ),
      };
    case "tombstone-gc":
      return {
        ...state,
        tombstones: state.tombstones.filter((t) => t.eventId !== action.eventId),
      };
    // I/O 계열은 상태 직접 변경 없음 (executor 가 결과로 snapshot-put 등을 별도 적용).
    default:
      return state;
  }
}
