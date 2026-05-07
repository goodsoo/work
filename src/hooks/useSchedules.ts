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

const schedulesKey = ["schedules"] as const;

export function useSchedules() {
  return useQuery({
    queryKey: schedulesKey,
    queryFn: listSchedules,
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleInsert) => createSchedule(input),
    onSuccess: (created) => {
      qc.setQueryData<Schedule[]>(schedulesKey, (prev) => {
        const next = prev ? [...prev, created] : [created];
        next.sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
        return next;
      });
    },
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ScheduleUpdate }) =>
      updateSchedule(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData<Schedule[]>(schedulesKey, (prev) =>
        prev?.map((s) => (s.id === updated.id ? updated : s)),
      );
    },
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<Schedule[]>(schedulesKey, (prev) =>
        prev?.filter((s) => s.id !== id),
      );
    },
  });
}
