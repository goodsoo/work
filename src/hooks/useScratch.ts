import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { readScratch, writeScratch } from "../api/scratch";
import { useVault } from "../lib/vault/useVault";

const scratchKey = ["scratch"] as const;

export function useScratch() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: scratchKey,
    queryFn: () => readScratch(adapter),
    enabled: isReady,
  });
}

export function useSaveScratch() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const path = await writeScratch(adapter, content);
      // 우리 write 가 watcher 를 깨워 쿼리를 되감지 않도록(입력 중 클로버 방지).
      watcher.markSelfWrite(path);
      return content;
    },
    onSuccess: (content) => {
      qc.setQueryData<string>(scratchKey, content);
    },
  });
}
