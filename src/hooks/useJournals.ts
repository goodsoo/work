import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteJournal,
  listJournals,
  upsertJournal,
  type Journal,
} from "../api/journals";
import { useVault } from "../lib/vault/useVault";

const journalsKey = ["journals"] as const;

export function useJournals() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: journalsKey,
    queryFn: () => listJournals(adapter),
    enabled: isReady,
  });
}

export function useUpsertJournal() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, content }: { date: string; content: string }) => {
      const saved = await upsertJournal(adapter, date, content);
      watcher.markSelfWrite(saved.id);
      return saved;
    },
    onSuccess: (saved) => {
      qc.setQueryData<Journal[]>(journalsKey, (prev) => {
        const next = (prev ?? []).filter((j) => j.id !== saved.id);
        next.unshift(saved);
        next.sort((a, b) => (a.date < b.date ? 1 : -1));
        return next;
      });
    },
  });
}

export function useDeleteJournal() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteJournal(adapter, id);
      watcher.markSelfWrite(id);
    },
    onSuccess: (_void, id) => {
      qc.setQueryData<Journal[]>(journalsKey, (prev) =>
        prev?.filter((j) => j.id !== id),
      );
    },
  });
}
