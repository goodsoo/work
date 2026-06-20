import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  type ScheduleEvent,
  type ScheduleInsert,
  type ScheduleUpdate,
} from "../api/schedule";
import { useVault } from "../lib/vault/useVault";

const scheduleKey = ["schedule"] as const;

export function useSchedule() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: scheduleKey,
    queryFn: () => listEvents(adapter),
    enabled: isReady,
  });
}

export function useCreateEvent() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleInsert) => {
      const created = await createEvent(adapter, input);
      watcher.markSelfWrite(created._source.file);
      return created;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: scheduleKey });
    },
  });
}

export function useUpdateEvent() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ScheduleUpdate }) => {
      const updated = await updateEvent(adapter, id, patch);
      watcher.markSelfWrite(updated._source.file);
      return updated;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: scheduleKey });
      const prev = qc.getQueryData<ScheduleEvent[]>(scheduleKey);
      qc.setQueryData<ScheduleEvent[]>(scheduleKey, (curr) =>
        curr?.map((e) => (e.id === id ? ({ ...e, ...patch } as ScheduleEvent) : e)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(scheduleKey, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: scheduleKey });
    },
  });
}

export function useDeleteEvent() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const file = id.replace(/#L\d+$/, "");
      await deleteEvent(adapter, id);
      watcher.markSelfWrite(file);
    },
    onSuccess: (_void, id) => {
      qc.setQueryData<ScheduleEvent[]>(scheduleKey, (prev) =>
        prev?.filter((e) => e.id !== id),
      );
    },
  });
}
