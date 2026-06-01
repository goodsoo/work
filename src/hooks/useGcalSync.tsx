import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVault } from "../lib/vault/useVault";
import { GcalNotReadyError, runSync } from "../lib/gcal/executor";
import { loadSyncState } from "../lib/gcal/stateStore";
import { GcalError } from "../lib/gcal/transport";

const todosKey = ["todos"] as const;
// 포커스 연타 디바운스 — 창 왕복마다 매번 sync 돌지 않게.
const AUTO_MIN_INTERVAL_MS = 15_000;

export type GcalSyncStatus = "idle" | "syncing" | "error";

interface GcalSyncContextValue {
  status: GcalSyncStatus;
  lastSyncAt: string | null;
  error: string | null;
  needsReauth: boolean;
  // 연동 + 전용 캘린더 있음 (= sync UI 노출 조건).
  connected: boolean;
  calendarName: string | null;
  autoSyncEnabled: boolean;
  // 수동 트리거 ("지금 동기화") — 자동 동기화 토글과 무관하게 실행.
  syncNow: () => Promise<void>;
  // 상태 파일 재읽기 (설정에서 연동/해제/토글 후 즉시 반영용).
  refresh: () => Promise<void>;
}

const GcalSyncContext = createContext<GcalSyncContextValue | null>(null);

// 앱 전역 1개 마운트. 날짜 있는 모든 일정 task 를 전용 Google 캘린더와 양방향
// 동기화한다. 트리거 = 앱 포커스(자동, 토글 on 일 때) + 수동 "지금 동기화".
// 동기화 엔진(push-create·reconcile·apply)은 executor.runSync 가 수행.
export function GcalSyncProvider({ children }: { children: ReactNode }) {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  const [status, setStatus] = useState<GcalSyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [connected, setConnected] = useState(false);
  const [calendarName, setCalendarName] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  // 직렬화 락 — 겹친 트리거(포커스+수동 동시)가 같은 reconcile 을 2번 안 돌게.
  const runningRef = useRef(false);
  const lastRunRef = useRef(0);

  // 상태 파일 → connected/calendarName/autoSync 반영 (sync 안 돌리고 메타만).
  const refresh = useCallback(async () => {
    try {
      const s = await loadSyncState();
      setConnected(s.authState === "linked" && !!s.calendarId);
      setCalendarName(s.calendarName);
      setAutoSyncEnabled(s.autoSyncEnabled);
    } catch {
      setConnected(false);
    }
  }, []);

  const doSync = useCallback(
    async (manual: boolean) => {
      if (runningRef.current) return;
      const now = Date.now();
      if (!manual && now - lastRunRef.current < AUTO_MIN_INTERVAL_MS) return;

      // 락은 어떤 await 보다 먼저 동기적으로 획득한다. loadSyncState await 사이에
      // 두 번째 트리거가 끼어들면 둘 다 락 체크를 통과해 sync 가 겹치고, push-create
      // 가 아직 #gcal 태그 안 박힌 같은 task 를 양쪽에서 insert → 이벤트 중복 생성
      // (StrictMode 2회 마운트 / HMR 리로드가 대표 케이스).
      runningRef.current = true;
      lastRunRef.current = now;
      try {
        const state = await loadSyncState();
        // 칩에 쓸 메타 최신화 (sync 여부와 무관).
        const isConnected = state.authState === "linked" && !!state.calendarId;
        setConnected(isConnected);
        setCalendarName(state.calendarName);
        setAutoSyncEnabled(state.autoSyncEnabled);
        // 게이트: 연동 + 전용 캘린더 + (자동이면) autoSync on. 미충족이면 조용히 종료.
        if (!isConnected) return;
        if (!manual && !state.autoSyncEnabled) return;

        setStatus("syncing");
        await runSync(adapter, { markSelfWrite: (f) => watcher.markSelfWrite(f) });
        setLastSyncAt(new Date().toISOString());
        setError(null);
        setNeedsReauth(false);
        setStatus("idle");
        // pull 로 바뀐 task 가 사이드바/목록에 반영되도록.
        void qc.invalidateQueries({ queryKey: todosKey });
      } catch (e) {
        if (e instanceof GcalNotReadyError) {
          setStatus("idle");
          return;
        }
        setNeedsReauth(e instanceof GcalError && e.needsReauth);
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      } finally {
        runningRef.current = false;
      }
    },
    [adapter, watcher, qc],
  );

  // 마운트 + vault 전환(adapter 변경) 시 1회 + 윈도우 포커스마다 자동 동기화.
  // doSync 는 adapter 가 바뀌면 새로 만들어지므로 vault 전환 시 이 effect 가 재실행된다.
  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    // vault 전환 시 디바운스·이전 vault 의 상태를 리셋 → 새 vault 가 즉시 동기화되고
    // 옛 vault 의 lastSyncAt/에러가 잘못 남지 않게.
    lastRunRef.current = 0;
    setError(null);
    setNeedsReauth(false);
    setLastSyncAt(null);
    void doSync(false);
    const onFocus = () => void doSync(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [doSync]);
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  const syncNow = useCallback(() => doSync(true), [doSync]);

  return (
    <GcalSyncContext.Provider
      value={{
        status,
        lastSyncAt,
        error,
        needsReauth,
        connected,
        calendarName,
        autoSyncEnabled,
        syncNow,
        refresh,
      }}
    >
      {children}
    </GcalSyncContext.Provider>
  );
}

export function useGcalSync(): GcalSyncContextValue {
  const ctx = useContext(GcalSyncContext);
  if (!ctx) {
    throw new Error("useGcalSync 는 GcalSyncProvider 안에서만 사용할 수 있습니다.");
  }
  return ctx;
}
