import type { VaultAdapter } from "../lib/vault/adapter";

// 빠른 캡처(포스트잇) — vault root 단일 파일. 날짜·노트 어디에도 안 묶인 freeform 메모.
// 폴더 스캔(notes/·journal/·tasks/) 밖이라 메모장 등 목록엔 노출되지 않고, 표준 마크다운
// 파일로 깔끔히 읽힌다.
const SCRATCH_PATH = "scratchpad.md";

export async function readScratch(adapter: VaultAdapter): Promise<string> {
  if (!(await adapter.exists(SCRATCH_PATH))) return "";
  return adapter.read(SCRATCH_PATH);
}

// 빈 내용도 그대로 저장(포스트잇은 비워도 파일 유지 — last-write-wins, v1 충돌검사 없음).
export async function writeScratch(
  adapter: VaultAdapter,
  content: string,
): Promise<string> {
  await adapter.write(SCRATCH_PATH, content);
  return SCRATCH_PATH;
}
