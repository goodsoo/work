import { useEffect, useState } from "react";
import { CalendarDays, CalendarPlus, Link2, Link2Off } from "lucide-react";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { Spinner } from "../common/Spinner";
import { useToast } from "../Toast";
import {
  gcalAuthStart,
  gcalAuthStatus,
  gcalDisconnect,
  GcalError,
  type AuthStatus,
} from "../../lib/gcal/transport";
import { loadSyncState, updateSyncState } from "../../lib/gcal/stateStore";
import { createCalendar } from "../../lib/gcal/api";

const DEDICATED_CALENDAR_NAME = "goodsoob";

// Google Calendar 연동 설정. 연동/해제 + 전용 캘린더 부트스트랩.
// (일정 push·폴링 동기화·재인증 CTA 는 T6/T7 에서 확장.)
export function GcalSection() {
  const toast = useToast();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [s, state] = await Promise.all([gcalAuthStatus(), loadSyncState()]);
      setStatus(s);
      setCalendarId(state.calendarId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    void refresh();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  async function handleConnect() {
    setError(null);
    setBusy(true);
    try {
      await gcalAuthStart();
      await updateSyncState((s) => ({ ...s, authState: "linked" }));
      await refresh();
      toast.show("Google 캘린더를 연동했습니다.", { kind: "info" });
    } catch (err) {
      const msg =
        err instanceof GcalError && err.kind === "NotConfigured"
          ? "GCAL_CLIENT_SECRET 환경변수가 없습니다. 빌드/실행 환경에 설정하고 다시 시도하세요."
          : err instanceof Error
            ? err.message
            : String(err);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    setBusy(true);
    try {
      await gcalDisconnect();
      await updateSyncState((s) => ({ ...s, authState: "disconnected" }));
      await refresh();
      toast.show("Google 캘린더 연동을 해제했습니다.", { kind: "info" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateCalendar() {
    setError(null);
    setCreating(true);
    try {
      const cal = await createCalendar(DEDICATED_CALENDAR_NAME);
      const next = await updateSyncState((s) => ({
        ...s,
        calendarId: cal.id,
        authState: "linked",
      }));
      setCalendarId(next.calendarId);
      toast.show(`전용 "${DEDICATED_CALENDAR_NAME}" 캘린더를 만들었습니다.`, { kind: "info" });
    } catch (err) {
      const msg =
        err instanceof GcalError && err.needsReauth
          ? "인증이 만료됐습니다. 연동을 다시 하세요."
          : err instanceof Error
            ? err.message
            : String(err);
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  const linked = status?.linked ?? false;
  const configured = status?.configured ?? false;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div
          className="flex items-center gap-3 rounded-lg px-3 py-3"
          style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}
        >
          <CalendarDays className="h-5 w-5 shrink-0" style={{ color: "var(--text-secondary)" }} />
          <div className="min-w-0 flex-1">
            <Text variant="body" weight="semibold" as="div">
              Google 캘린더
            </Text>
            <Text variant="caption" color="muted" as="div">
              {loading
                ? "상태 확인 중…"
                : linked
                  ? "연동됨. 개인 캘린더는 건드리지 않고 전용 캘린더만 동기화합니다."
                  : "연동하면 goodsoob 일정을 Google 캘린더에서 함께 봅니다."}
            </Text>
          </div>
          {!loading &&
            (linked ? (
              <Button
                variant="ghost"
                onClick={handleDisconnect}
                disabled={busy}
                leftIcon={busy ? <Spinner size="sm" /> : <Link2Off className="h-4 w-4" />}
                className="shrink-0 rounded-lg px-3 py-2"
                style={{ color: "var(--text-secondary)" }}
              >
                연동 해제
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleConnect}
                disabled={busy}
                leftIcon={busy ? <Spinner size="md" /> : <Link2 className="h-4 w-4" />}
                className="shrink-0 rounded-lg px-3 py-2 disabled:opacity-50"
              >
                {busy ? "연동 중…" : "Google 연동"}
              </Button>
            ))}
        </div>

        {!loading && !configured && (
          <Text
            variant="caption"
            as="div"
            className="rounded px-3 py-2"
            style={{
              color: "var(--accent-red)",
              background: "var(--bg-base)",
              border: "1px solid var(--accent-red)",
            }}
          >
            client secret 이 설정되지 않았습니다. 빌드/실행 환경에 GCAL_CLIENT_SECRET
            환경변수를 설정하세요.
          </Text>
        )}
      </section>

      {/* 전용 캘린더 부트스트랩 — 연동됐을 때만 노출. */}
      {!loading && linked && (
        <section className="space-y-2">
          <Text
            variant="caption"
            color="muted"
            as="h3"
            weight="semibold"
            className="uppercase tracking-wide"
          >
            전용 캘린더
          </Text>
          {calendarId ? (
            <div
              className="rounded-lg px-3 py-2"
              style={{ background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}
            >
              <Text variant="body" as="div">
                "{DEDICATED_CALENDAR_NAME}" 캘린더 연결됨
              </Text>
              <Text variant="caption" color="muted" as="div" className="mt-0.5 break-all" style={{ fontFamily: "var(--font-mono, monospace)" }}>
                {calendarId}
              </Text>
            </div>
          ) : (
            <div className="space-y-2">
              <Text variant="caption" color="secondary" as="p">
                goodsoob 일정을 올릴 전용 캘린더를 새로 만듭니다. 개인 일정이 든 캘린더는
                건드리지 않습니다.
              </Text>
              <Button
                variant="primary"
                onClick={handleCreateCalendar}
                disabled={creating}
                leftIcon={creating ? <Spinner size="md" /> : <CalendarPlus className="h-4 w-4" />}
                className="rounded-lg px-3 py-2 disabled:opacity-50"
              >
                {creating ? "만드는 중…" : `"${DEDICATED_CALENDAR_NAME}" 캘린더 만들기`}
              </Button>
            </div>
          )}
        </section>
      )}

      {error && (
        <Text
          variant="body"
          as="div"
          className="rounded px-3 py-2"
          style={{
            color: "var(--accent-red)",
            background: "var(--bg-base)",
            border: "1px solid var(--accent-red)",
          }}
        >
          {error}
        </Text>
      )}
    </div>
  );
}
