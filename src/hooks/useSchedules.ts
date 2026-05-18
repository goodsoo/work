import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  updateSchedule,
  type Schedule,
  type ScheduleInsert,
  type ScheduleUpdate,
} from "../api/schedules";
import { useVault } from "../lib/vault/useVault";

const schedulesKey = ["schedules"] as const;

export function useSchedules() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: schedulesKey,
    queryFn: () => listSchedules(adapter),
    enabled: isReady,
  });
}

export function useCreateSchedule() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleInsert) => {
      const created = await createSchedule(adapter, input);
      watcher.markSelfWrite("inbox.md");
      return created;
    },
    onSuccess: (created) => {
      qc.setQueryData<Schedule[]>(schedulesKey, (prev) => {
        const next = prev ? [...prev, created] : [created];
        next.sort((a, b) => a.start_time.localeCompare(b.start_time));
        return next;
      });
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

export function useUpdateSchedule() {
  const { adapter } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ScheduleUpdate }) =>
      updateSchedule(adapter, id, patch),
    onSuccess: (updated) => {
      qc.setQueryData<Schedule[]>(schedulesKey, (prev) =>
        prev?.map((s) => (s.id === updated.id ? updated : s)),
      );
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

export function useDeleteSchedule() {
  const { adapter } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSchedule(adapter, id),
    onSuccess: (_void, id) => {
      qc.setQueryData<Schedule[]>(schedulesKey, (prev) =>
        prev?.filter((s) => s.id !== id),
      );
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}
