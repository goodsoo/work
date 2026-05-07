import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteJournal,
  listJournals,
  upsertJournal,
  type Journal,
} from "../api/journals";

const journalsKey = ["journals"] as const;

export function useJournals() {
  return useQuery({
    queryKey: journalsKey,
    queryFn: listJournals,
  });
}

export function useUpsertJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, content }: { date: string; content: string }) =>
      upsertJournal(date, content),
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJournal(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<Journal[]>(journalsKey, (prev) =>
        prev?.filter((j) => j.id !== id),
      );
    },
  });
}
