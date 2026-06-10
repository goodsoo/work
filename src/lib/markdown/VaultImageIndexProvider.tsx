// vault 안 이미지 basename → 경로 인덱스를 앱 전역에 제공. MarkdownView 가 Obsidian
// `![[파일]]` 임베드를 렌더할 때 bare 파일명을 실제 vault 경로로 역추적하는 데 쓴다.
//
// useQuery 를 여기(provider) 에 두는 이유: MarkdownView 는 QueryClientProvider 없는
// 테스트(jsdom) 에서도 직접 렌더된다. 훅을 MarkdownView 에 박으면 그 테스트가 깨진다.
// provider 가 인덱스를 만들어 context 로 내려주고, MarkdownView 는 null-safe useContext
// 로만 소비 → provider 밖(테스트) 에서는 null → 임베드는 원본 텍스트로 통과.

import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { VaultContext } from "../vault/VaultProvider";
import { buildVaultImageIndex } from "./obsidianEmbed";

export const VaultImageIndexContext = createContext<Map<string, string> | null>(
  null,
);

export function VaultImageIndexProvider({ children }: { children: ReactNode }) {
  const ctx = useContext(VaultContext);
  const adapter = ctx?.adapter ?? null;
  const vaultRoot = ctx?.vaultRoot ?? null;

  const { data } = useQuery({
    queryKey: ["vaultImageIndex", vaultRoot],
    enabled: !!adapter && !!vaultRoot,
    staleTime: 30_000,
    queryFn: async () => {
      // vault 전체 (listRecursive 가 dotfile·.trash 자동 skip). 이미지는 노트와 같은
      // 폴더에 흩어져 있어 root 부터 훑는다. 소규모 vault 라 비용 무시 가능.
      const files = await adapter!.listRecursive("");
      return buildVaultImageIndex(files);
    },
  });

  return (
    <VaultImageIndexContext.Provider value={data ?? null}>
      {children}
    </VaultImageIndexContext.Provider>
  );
}
