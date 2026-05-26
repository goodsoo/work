// vault 별 localStorage key 네임스페이스. 활성 vault id 가 있을 때만 suffix 를 붙임.
// disconnected (null) 일 때는 base key 그대로 — VaultGate 가 막아서 사실 어차피 노출 안 됨.
//
// 마이그레이션 정책: 사용자가 "테스트 데이터" 라고 명시 — 기존 prefix 없는 키 (예: `goodsoob:meetingSort`)
// 는 잔재로 두고, 첫 vault 부터는 무조건 `goodsoob:meetingSort:<vaultId>` 키만 사용.

import { useVault } from "./useVault";

export function scopedKey(baseKey: string, vaultId: string | null): string {
  if (!vaultId) return baseKey;
  return `${baseKey}:${vaultId}`;
}

export function useScopedKey(baseKey: string): string {
  const { activeVaultId } = useVault();
  return scopedKey(baseKey, activeVaultId);
}
