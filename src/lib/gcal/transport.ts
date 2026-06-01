import { invoke } from "@tauri-apps/api/core";

// Rust gcal command 들의 TS 바인딩. 모든 Calendar API 는 gcalRequest 를 거친다
// (bearer 토큰은 Rust 안에서만 — JS 노출 X). Rust GcalError(tagged) 를 typed
// GcalError 로 변환해, executor 가 404(캘린더 삭제)·410(syncToken 만료)·
// AuthExpired(재인증) 를 분기할 수 있게 한다.

export type GcalErrorKind =
  | "NotConfigured"
  | "NotLinked"
  | "AuthExpired"
  | "Http"
  | "Network"
  | "Internal";

export class GcalError extends Error {
  kind: GcalErrorKind;
  httpStatus: number | null;
  body: string | null;

  constructor(kind: GcalErrorKind, message: string, httpStatus: number | null = null, body: string | null = null) {
    super(message);
    this.name = "GcalError";
    this.kind = kind;
    this.httpStatus = httpStatus;
    this.body = body;
  }

  // 재인증이 필요한 상태 (refresh 만료/폐기 또는 미연동) — 폴링 중단 + CTA.
  get needsReauth(): boolean {
    return this.kind === "AuthExpired" || this.kind === "NotLinked";
  }
}

// Rust 의 #[serde(tag="kind", content="detail")] 직렬화를 typed 에러로.
//  - NotConfigured/Network/Internal: detail = string
//  - Http: detail = { status, body }
//  - NotLinked/AuthExpired: detail 없음
export function parseGcalError(raw: unknown): GcalError {
  if (raw instanceof GcalError) return raw;
  if (typeof raw === "string") return new GcalError("Internal", raw);
  if (!raw || typeof raw !== "object") {
    return new GcalError("Internal", "알 수 없는 오류가 발생했습니다.");
  }
  const o = raw as { kind?: unknown; detail?: unknown };
  const kind = (typeof o.kind === "string" ? o.kind : "Internal") as GcalErrorKind;
  switch (kind) {
    case "Http": {
      const d = (o.detail ?? {}) as { status?: unknown; body?: unknown };
      const status = typeof d.status === "number" ? d.status : null;
      const body = typeof d.body === "string" ? d.body : null;
      return new GcalError("Http", `Calendar API ${status ?? "?"} 오류`, status, body);
    }
    case "NotLinked":
      return new GcalError("NotLinked", "Google 캘린더가 연동되지 않았습니다.");
    case "AuthExpired":
      return new GcalError("AuthExpired", "Google 인증이 만료됐습니다. 다시 연동하세요.");
    case "NotConfigured":
    case "Network":
    case "Internal":
    default:
      return new GcalError(kind, typeof o.detail === "string" ? o.detail : "오류가 발생했습니다.");
  }
}

export interface AuthStatus {
  linked: boolean;
  configured: boolean;
}

// OAuth 시작 — 브라우저 열림 → 동의 → loopback 캡처 → 토큰 저장까지 await.
export async function gcalAuthStart(): Promise<void> {
  try {
    await invoke("gcal_auth_start");
  } catch (e) {
    throw parseGcalError(e);
  }
}

export async function gcalAuthStatus(): Promise<AuthStatus> {
  return invoke<AuthStatus>("gcal_auth_status");
}

export async function gcalDisconnect(): Promise<void> {
  await invoke("gcal_disconnect");
}

// Calendar API 단일 진입점. path 는 /calendars/... 처럼 v3 베이스 뒤를 줌.
// body 는 insert/update 시 JSON, GET/DELETE 는 생략. 401 재시도는 Rust 가 처리.
export async function gcalRequest<T = unknown>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  try {
    return await invoke<T>("gcal_request", { method, path, body: body ?? null });
  } catch (e) {
    throw parseGcalError(e);
  }
}
