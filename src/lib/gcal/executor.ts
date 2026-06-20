import type { VaultAdapter } from "../vault/adapter";
import { listTodos, updateTask, createTodo, type Task } from "../../api/tasks";
import {
  deleteEvent,
  insertEvent,
  listEvents,
  updateEvent,
} from "./api";
import type { GcalApiEvent } from "./mapping";
import { fieldsToGcalEvent, gcalEventToRemote, isRecurringEvent } from "./mapping";
import { MAX_BULK_PUSH_MUTATIONS, mutatingPushCount, reconcile, scheduleHash } from "./reconcile";
import { addTombstone, isGuarded, reduceState, unlinkEvent } from "./state";
import { loadSyncState, updateSyncState } from "./stateStore";
import { GcalError } from "./transport";
import type {
  LocalSchedule,
  ReconcileAction,
  RemoteEvent,
  ScheduleFields,
} from "./types";

// 연동/전용 캘린더가 아직 없을 때 (설정에서 부트스트랩 필요).
export class GcalNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GcalNotReadyError";
  }
}

// 대량 push 가드 발동 — 기존 Google 일정을 임계치 이상 변경/삭제하려 해서 sync 를
// 중단했다. 적용 전에 던지므로 Google 엔 아무것도 안 나간다 (token 도 advance 안 함).
export class GcalBulkChangeError extends Error {
  count: number;
  constructor(count: number) {
    super(
      `동기화를 중단했습니다. 기존 Google 일정 ${count}개를 한꺼번에 변경/삭제하려 했습니다. ` +
        `정상은 한 번에 1~2개입니다. 데이터 손상이 의심되니 로컬 일정을 확인한 뒤 다시 시도하세요.`,
    );
    this.name = "GcalBulkChangeError";
    this.count = count;
  }
}

// IANA 로컬 tz (예: "Asia/Seoul"). push(이벤트 생성) 시 dateTime 에 부착하고,
// fetchRemoteDelta 가 events.list 에 pin 해 import wall-clock 을 로컬과 일치시킨다.
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function taskToFields(t: Task): ScheduleFields {
  // 着수 2: task 에서 end_date(다일) 제거 — 다일은 일정(schedule.md) 전용. gcal
  // 재연결(着수 4)에서 schedule.md 이벤트의 범위를 직접 매핑한다.
  return { title: t.title, date: t.due_date, endDate: null, time: t.due_time };
}

// events.delete 는 이미 삭제된 이벤트에 410/404 를 줄 수 있다 — 멱등 삭제이므로 무시.
async function safeDeleteEvent(calendarId: string, eventId: string): Promise<void> {
  try {
    await deleteEvent(calendarId, eventId);
  } catch (e) {
    if (e instanceof GcalError && e.kind === "Http" && (e.httpStatus === 404 || e.httpStatus === 410)) {
      return; // 이미 없음 — 성공으로 취급.
    }
    throw e;
  }
}

// ─── 원격 delta fetch (syncToken 증분, 410 만료 시 full resync) ───────────────
interface RemoteFetch {
  events: RemoteEvent[];
  nextSyncToken: string | null;
}

async function fetchRemoteDelta(
  calendarId: string,
  syncToken: string | null,
  timeZone: string,
): Promise<RemoteFetch> {
  const items: GcalApiEvent[] = [];
  let nextSyncToken: string | null = null;
  let pageToken: string | undefined;
  try {
    do {
      const resp = await listEvents(calendarId, { syncToken, pageToken, timeZone });
      items.push(...resp.items);
      pageToken = resp.nextPageToken;
      if (resp.nextSyncToken) nextSyncToken = resp.nextSyncToken;
    } while (pageToken);
  } catch (e) {
    // syncToken 만료(410) → 토큰 버리고 full resync 1회 재귀.
    if (e instanceof GcalError && e.kind === "Http" && e.httpStatus === 410 && syncToken) {
      return fetchRemoteDelta(calendarId, null, timeZone);
    }
    throw e;
  }
  // 반복 일정(마스터·인스턴스)은 동기화 제외 → reconcile 에 안 넘김 (local-create 로
  // task 생성되거나 push-update 로 반복이 깨지는 footgun 차단). syncToken 은 정상 advance.
  const events = items.filter((ev) => !isRecurringEvent(ev)).map(gcalEventToRemote);
  return { events, nextSyncToken };
}

// ─── 액션 적용 ───────────────────────────────────────────────────────────────
interface ApplyCtx {
  adapter: VaultAdapter;
  calendarId: string;
  tz: string;
  // eventId → 현재 task (apply 직전 스캔 — taskId line drift 보호).
  taskByEvent: Map<string, Task>;
  // watcher 가 자기 write 를 외부 변경으로 오인하지 않게 기록 (T5).
  markSelfWrite?: (file: string) => void;
}

async function applyAction(ctx: ApplyCtx, action: ReconcileAction): Promise<void> {
  const { adapter, calendarId, tz, taskByEvent, markSelfWrite } = ctx;
  switch (action.kind) {
    case "push-update": {
      const ev = await updateEvent(
        calendarId,
        action.eventId,
        fieldsToGcalEvent(action.local.fields, tz),
      );
      await updateSyncState((s) =>
        reduceState(s, {
          kind: "snapshot-put",
          eventId: action.eventId,
          hash: scheduleHash(action.local.fields),
          updated: ev.updated ?? "",
        }),
      );
      break;
    }
    case "push-delete": {
      await safeDeleteEvent(calendarId, action.eventId);
      await updateSyncState((s) => reduceState(s, { kind: "tombstone-confirm", eventId: action.eventId }));
      break;
    }
    case "calendar-unlink": {
      // 날짜 제거 → 캘린더에서 빼고 #gcal 앵커 해제 (task 자체는 보존).
      await safeDeleteEvent(calendarId, action.eventId);
      const task = taskByEvent.get(action.eventId);
      if (task) {
        const updated = await updateTask(adapter, task.id, { gcal_event_id: null });
        markSelfWrite?.(updated._source.file);
      }
      await updateSyncState((s) => unlinkEvent(s, action.eventId, nowIso()));
      break;
    }
    case "local-create": {
      // 폰/웹에서 직접 추가된 원격 이벤트 → 로컬 일정 task 생성 + 앵커.
      const created = await createTodo(adapter, {
        title: action.fields.title,
        due_date: action.fields.date,
        due_time: action.fields.time,
        gcal_event_id: action.eventId,
      });
      markSelfWrite?.(created._source.file);
      await updateSyncState((s) =>
        reduceState(s, {
          kind: "snapshot-put",
          eventId: action.eventId,
          hash: scheduleHash(action.fields),
          updated: action.updated,
        }),
      );
      break;
    }
    case "local-upsert": {
      const task = taskByEvent.get(action.eventId);
      if (task) {
        const updated = await updateTask(adapter, task.id, {
          title: action.fields.title,
          due_date: action.fields.date,
          due_time: action.fields.time,
        });
        markSelfWrite?.(updated._source.file);
      }
      await updateSyncState((s) =>
        reduceState(s, {
          kind: "snapshot-put",
          eventId: action.eventId,
          hash: scheduleHash(action.fields),
          updated: action.updated,
        }),
      );
      break;
    }
    case "local-trash": {
      // 원격 삭제됨 → 로컬도 휴지통行 (hard-delete 아님, #gcal 앵커는 유지).
      const task = taskByEvent.get(action.eventId);
      if (task) {
        const updated = await updateTask(adapter, task.id, { deleted: true });
        markSelfWrite?.(updated._source.file);
      }
      await updateSyncState((s) => reduceState(s, { kind: "snapshot-delete", eventId: action.eventId }));
      break;
    }
    case "snapshot-put":
    case "snapshot-delete":
    case "tombstone-confirm":
    case "tombstone-gc":
      await updateSyncState((s) => reduceState(s, action));
      break;
    case "orphan":
      // 로컬 짝 없고 묘비도 없음 (수동 태그 제거 등). 원격 그대로 둠 — 1인 도구라 로깅만.
      console.warn(`[gcal] orphan event (로컬 짝·묘비 없음): ${action.eventId}`);
      break;
  }
}

// ─── sync 오케스트레이션 ─────────────────────────────────────────────────────
export interface SyncResult {
  pushed: number; // 새로 만든 이벤트 (auto push-create)
  applied: number; // reconcile 액션 수행 수
  errors: number; // 격리된 액션 실패 수
}

// 한 번의 전체 동기화. 트리거(포커스/수동)는 useGcalSync 가, 직렬화 락도 거기서.
// 여기선 멱등 reconcile 을 1회 실행한다 — 중복 호출돼도 결과 동일.
export async function runSync(
  adapter: VaultAdapter,
  opts: { markSelfWrite?: (file: string) => void } = {},
): Promise<SyncResult> {
  const state0 = await loadSyncState();
  if (state0.authState !== "linked" || !state0.calendarId) {
    throw new GcalNotReadyError("Google 캘린더 연동 또는 전용 캘린더가 없습니다.");
  }
  const calendarId = state0.calendarId;
  const tz = localTimeZone();
  const result: SyncResult = { pushed: 0, applied: 0, errors: 0 };

  // 1) task 스캔.
  let tasks = await listTodos(adapter);

  // 2) auto push-create: 날짜 있는 활성(미완료·미취소·미삭제) + 미앵커 → 새 이벤트.
  for (const t of tasks) {
    if (t.gcal_event_id || !t.due_date) continue;
    if (t.deleted || t.cancelled || t.done) continue;
    try {
      const fields = taskToFields(t);
      const ev = await insertEvent(calendarId, fieldsToGcalEvent(fields, tz));
      const updated = await updateTask(adapter, t.id, { gcal_event_id: ev.id });
      opts.markSelfWrite?.(updated._source.file);
      await updateSyncState((s) =>
        reduceState(s, {
          kind: "snapshot-put",
          eventId: ev.id,
          hash: scheduleHash(fields),
          updated: ev.updated ?? "",
        }),
      );
      result.pushed++;
    } catch (e) {
      if (e instanceof GcalError && e.needsReauth) throw e; // 인증 만료 → 전체 중단
      result.errors++;
      console.warn(`[gcal] push-create 실패 ("${t.title}"):`, e);
    }
  }

  // push-create 가 태그를 박았으니 재스캔 (앵커 최신화).
  if (result.pushed > 0) tasks = await listTodos(adapter);

  // 3) 휴지통行 앵커 → 묘비 (스냅샷이 아직 있을 때만 — 없으면 이미 원격 처리됨).
  let state = await loadSyncState();
  const toTomb = tasks.filter(
    (t) =>
      t.deleted &&
      t.gcal_event_id &&
      state.snapshots[t.gcal_event_id] &&
      !isGuarded(state, t.gcal_event_id),
  );
  if (toTomb.length) {
    state = await updateSyncState((s) => {
      let next = s;
      for (const t of toTomb) next = addTombstone(next, t.gcal_event_id!, nowIso());
      return next;
    });
  }

  // (제거됨) tz import fix 자동 full-pull 복구는 위험해 폐기. snapshot 과 로컬이
  // 불일치한 상태(복구 시 흔함)에서 full pull 이 "로컬이 바뀜 → push-update" 로 흘러
  // 손상된 로컬 시각을 Google 에 역push 해 실제 캘린더를 망가뜨렸다. 이미 어긋난
  // 데이터 복구는 reconcile(양방향)이 아니라 명시적 pull-only 경로로만 해야 한다.

  // 4) 원격 delta (410 → full resync). 인증 만료는 상위로 던져 CTA.
  const remote = await fetchRemoteDelta(calendarId, state.syncToken, tz);

  // 5) locals: 앵커 + 미삭제 (done/cancelled 포함 → 캘린더에 그대로 유지).
  const locals: LocalSchedule[] = tasks
    .filter((t) => t.gcal_event_id && !t.deleted)
    .map((t) => ({
      taskId: t.id,
      eventId: t.gcal_event_id!,
      fields: taskToFields(t),
      updatedAt: t.updated_at,
    }));

  // 6) reconcile (순수).
  const actions = reconcile({
    locals,
    remoteDelta: remote.events,
    snapshots: state.snapshots,
    tombstones: state.tombstones,
  });

  // 6.5) 대량 push 가드 (#2). 기존 Google 이벤트를 임계치 이상 덮어쓰/삭제하려 하면
  // 적용 전에 중단 — 데이터 손상·버그(타임존 일괄 시프트 등)가 실 캘린더에 닿는 것을
  // 막는 최후 방어선. push-create(신규)는 제외. 던지면 token 미advance → 다음 sync 가
  // 같은 delta 로 다시 와 사용자가 로컬을 고치면 자동 정상화.
  const bulk = mutatingPushCount(actions);
  if (bulk > MAX_BULK_PUSH_MUTATIONS) {
    // allowBulkPushOnce = 사용자가 명시 승인한 일회성 대량 push (대량 복구용). 소비하고
    // 진행. 없으면 가드 발동 — 적용 전 중단(Google 미변경, token 미advance).
    if (state.allowBulkPushOnce) {
      state = await updateSyncState((s) => ({ ...s, allowBulkPushOnce: false }));
    } else {
      throw new GcalBulkChangeError(bulk);
    }
  }

  // 7) apply. eventId→task 맵으로 line drift 보호 + 액션별 격리.
  const taskByEvent = new Map<string, Task>();
  for (const t of tasks) if (t.gcal_event_id) taskByEvent.set(t.gcal_event_id, t);
  const ctx: ApplyCtx = { adapter, calendarId, tz, taskByEvent, markSelfWrite: opts.markSelfWrite };
  for (const action of actions) {
    try {
      await applyAction(ctx, action);
      result.applied++;
    } catch (e) {
      if (e instanceof GcalError && e.needsReauth) throw e;
      result.errors++;
      console.warn(`[gcal] 액션 실패 (${action.kind} / ${action.eventId}):`, e);
    }
  }

  // 8) syncToken + lastSyncAt 영속. 실패가 있었으면 토큰을 advance 하지 않는다 —
  //    소비된 delta 가 다음 sync 에서 다시 와 retry 되도록 (reconcile 멱등).
  await updateSyncState((s) => ({
    ...s,
    syncToken: result.errors === 0 ? remote.nextSyncToken ?? s.syncToken : s.syncToken,
    lastSyncAt: nowIso(),
  }));

  return result;
}
