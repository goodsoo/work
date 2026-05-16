// Supabase PostgrestError 등은 Error 인스턴스가 아니지만 message 필드를 가짐.
// 그냥 String(e) 하면 "[object Object]" 되니까 이 헬퍼로 일관 추출.
export function formatError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const msg = (e as { message: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return String(e);
}
