import { useEffect, useState } from "react";
import { CalendarDays, Link2, Link2Off } from "lucide-react";
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

// Google Calendar 연동 설정. 현재는 OAuth 핸드셰이크 검증용 최소 UI
// (연동/해제/상태) — 전용 캘린더 선택·동기화 상태·재인증 CTA 는 T6/T7 에서 확장.
export function GcalSection() {
  const toast = useToast();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setStatus(await gcalAuthStatus());
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
      await refresh();
      toast.show("Google 캘린더 연동을 해제했습니다.", { kind: "info" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
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
                  ? "연동됨. 일정이 지정한 Google 캘린더와 동기화됩니다."
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
