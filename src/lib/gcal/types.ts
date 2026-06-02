// Google Calendar 양방향 연동 — 도메인 타입.
//
// reconcile 엔진은 이 정규화된 타입들 위에서만 동작한다 (Google API 원형·vault
// task 원형과 분리). 변환은 mapping.ts 가 담당. 이렇게 분리해야 reconcile 결정
// 로직을 OAuth·네트워크 없이 순수 함수로 단위 테스트할 수 있다.

// 일정의 동기화 대상 필드. 로컬 task 와 원격 event 를 같은 모양으로 정규화한다.
export interface ScheduleFields {
  title: string;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM. null = 종일(all-day) 이벤트.
}

// Google events.list 가 돌려준 이벤트 (정규화 후).
export interface RemoteEvent {
  eventId: string;
  // status === "cancelled" — Google 에서 삭제됨 (showDeleted=true 로 받음).
  cancelled: boolean;
  // cancelled 면 의미 없음 (Google 이 cancelled 이벤트엔 summary 등을 안 줄 수 있음).
  fields: ScheduleFields;
  updated: string; // RFC3339 updated 타임스탬프
}

// #gcal-<id> 앵커를 이미 가진, 휴지통行 아닌 로컬 일정 task.
// (태그 없는 신규 #schedule 는 reconcile 대상 아님 — 명시적 push 경로로만 올라감.)
export interface LocalSchedule {
  taskId: string; // file#Lline — mutation 용 (불안정 — 쓰기 직전 재해석 필요)
  eventId: string; // = gcal_event_id 앵커
  fields: ScheduleFields;
  updatedAt: string; // 로컬 변경 시각 (파일 mtime ISO). 양쪽 변경 시 LWW 타이브레이크.
}

// 마지막-sync 스냅샷 (변경 감지 baseline). eventId 기준.
export interface SyncSnapshot {
  hash: string; // 마지막 sync 시점 scheduleHash(fields)
  updated: string; // 마지막 sync 시점 remote.updated
}

// 로컬 삭제 묘비. 좀비 부활 차단의 권위.
export interface Tombstone {
  eventId: string;
  deletedAt: string;
  // Google events.delete 가 확정됐는지. false = 아직 push 안 됨 (가드 + push 예정).
  pushConfirmed: boolean;
}

// 기기 로컬 sync 상태 (appDataDir, vault 아님 — 다중 기기 커서 무효화 차단).
export interface SyncState {
  // Google events.list 증분 토큰. null = 다음 sync 가 full resync.
  syncToken: string | null;
  // 사용자가 고른 전용 캘린더.
  calendarId: string | null;
  // 전용 캘린더 표시 이름 (rename 시 갱신). UI 표시용 — 권위는 Google.
  calendarName: string | null;
  lastSyncAt: string | null;
  authState: "linked" | "disconnected";
  // 전역 자동 동기화(포커스 트리거) on/off. 수동 "지금 동기화" 는 이 값과 무관하게 동작.
  // 회사 outbound 차단 등에서 끌 수 있게. default true.
  autoSyncEnabled: boolean;
  // eventId → 스냅샷
  snapshots: Record<string, SyncSnapshot>;
  tombstones: Tombstone[];
  // tz import fix 일회성 복구 완료 플래그. tz pin 이전엔 import 시각이 UTC 로 읽혀
  // (−9h) 손상됐다 → fix 적용 후 첫 sync 가 syncToken 을 1회 버려 full pull 을 강제,
  // remote 의 올바른 시각으로 self-heal 한다. 미설정/false = 아직 복구 안 함.
  tzImportFixApplied?: boolean;
  // 이 상태가 속한 vault 의 path (저장 시 stamp). vault id 는 remove+재등록 시
  // 재발급돼 id-keyed 상태파일이 고아가 되는데, path 는 안정적이라 같은 path 의 고아
  // 상태를 현재 id 로 자동 입양(rename)하는 앵커로 쓴다. 미설정 = 옛 파일(입양 불가).
  vaultPath?: string | null;
  // 일회성 대량 push 승인. 대량 push 가드(MAX_BULK_PUSH_MUTATIONS 초과)를 다음 sync
  // 1회만 우회한다 — 사용자가 명시 승인한 대량 복구(예: tz 손상 일괄 재push)용. runSync
  // 가 소비 후 false 로 되돌린다. 기본 미설정(=가드 정상 작동).
  allowBulkPushOnce?: boolean;
}

export function emptySyncState(): SyncState {
  return {
    syncToken: null,
    calendarId: null,
    calendarName: null,
    lastSyncAt: null,
    authState: "disconnected",
    autoSyncEnabled: true,
    snapshots: {},
    tombstones: [],
    // 새 vault 는 손상 이력이 없으니 복구 불필요 → true 로 시작 (full pull 강제 안 함).
    tzImportFixApplied: true,
    vaultPath: null,
    allowBulkPushOnce: false,
  };
}

// ─── reconcile 결과 — 실행기(executor)가 수행할 액션 목록 ────────────────────
//
// reconcile 은 순수 함수 → 액션 목록만 만든다. 실제 gcal_request / updateTask 호출과
// push 결과 기반 snapshot 갱신은 executor 의 몫. push 계열은 응답을 받아야 새
// snapshot.updated 를 알 수 있어 여기선 미리 안 박는다 (executor 가 post-hoc).
export type ReconcileAction =
  // 로컬이 바뀜 → events.update. reason=conflict-lww 면 양쪽 변경에서 로컬 승.
  | { kind: "push-update"; eventId: string; local: LocalSchedule; reason: "local-only" | "conflict-lww" }
  // 묘비(미확정) → events.delete. 원격이 살아있어도 발사 (좀비 가드).
  | { kind: "push-delete"; eventId: string }
  // 원격에만 있는 신규 이벤트 (폰에서 직접 추가) → 로컬 일정 task 생성 + 태그.
  | { kind: "local-create"; eventId: string; fields: ScheduleFields; updated: string }
  // 원격이 바뀜 → 로컬 task 필드 반영. reason=conflict-lww 면 양쪽 변경에서 원격 승.
  | { kind: "local-upsert"; eventId: string; taskId: string; fields: ScheduleFields; updated: string; reason: "remote-only" | "conflict-lww" }
  // 원격 cancelled → 로컬 휴지통行 (hard-delete 아님).
  | { kind: "local-trash"; eventId: string; taskId: string }
  // 앵커 있던 일정의 날짜가 제거됨 → 캘린더에서만 제거 (task 는 보존).
  // Google 이벤트는 start(날짜) 필수라 날짜 없는 일정을 표현 못 한다 → 이벤트 삭제 +
  // #gcal 앵커 해제 + 삭제 echo 좀비 가드용 묘비. 휴지통行(local-trash)과 다르다.
  | { kind: "calendar-unlink"; eventId: string; taskId: string }
  // 스냅샷 기록/갱신 (pull 측은 지금 값 확정, push 측은 executor 가 post-hoc).
  | { kind: "snapshot-put"; eventId: string; hash: string; updated: string }
  | { kind: "snapshot-delete"; eventId: string }
  // 묘비 push 확정 (executor 가 push-delete 성공 후 set).
  | { kind: "tombstone-confirm"; eventId: string }
  // 묘비 GC (확정 + 원격 cancelled 확인됨).
  | { kind: "tombstone-gc"; eventId: string }
  // 고아 — 로컬에 짝 없고 묘비도 없음 (수동 태그 제거 등). 원격 그대로 둠, 로깅만.
  | { kind: "orphan"; eventId: string };

export interface ReconcileInput {
  // 현재 vault 의 #gcal 태그 보유 + 휴지통行 아닌 일정 전부.
  locals: LocalSchedule[];
  // events.list 증분(또는 첫 sync/410 시 full). cancelled 포함 (showDeleted=true).
  remoteDelta: RemoteEvent[];
  // 마지막-sync 스냅샷.
  snapshots: Record<string, SyncSnapshot>;
  tombstones: Tombstone[];
}
