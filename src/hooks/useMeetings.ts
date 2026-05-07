import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMeeting,
  deleteMeeting,
  getMeeting,
  listMeetings,
  updateMeeting,
  type Meeting,
  type MeetingInsert,
  type MeetingUpdate,
} from "../api/meetings";

const meetingsKey = ["meetings"] as const;
const meetingKey = (id: string) => ["meetings", id] as const;

export function useMeetings() {
  return useQuery({
    queryKey: meetingsKey,
    queryFn: listMeetings,
  });
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: id ? meetingKey(id) : ["meetings", "none"],
    queryFn: () => getMeeting(id!),
    enabled: !!id,
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<MeetingInsert, "user_id">) => createMeeting(input),
    onSuccess: (created) => {
      qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
        prev ? [created, ...prev] : [created]
      );
      qc.setQueryData(meetingKey(created.id), created);
    },
  });
}

export function useUpdateMeeting(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: MeetingUpdate) => updateMeeting(id, patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: meetingKey(id) });
      const prevDetail = qc.getQueryData<Meeting>(meetingKey(id));
      const prevList = qc.getQueryData<Meeting[]>(meetingsKey);
      if (prevDetail) {
        qc.setQueryData(meetingKey(id), { ...prevDetail, ...patch } as Meeting);
      }
      qc.setQueryData<Meeting[]>(meetingsKey, (curr) =>
        curr?.map((m) => (m.id === id ? ({ ...m, ...patch } as Meeting) : m)),
      );
      return { prevDetail, prevList };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevDetail) qc.setQueryData(meetingKey(id), ctx.prevDetail);
      if (ctx?.prevList) qc.setQueryData(meetingsKey, ctx.prevList);
    },
    onSuccess: (updated) => {
      qc.setQueryData(meetingKey(id), updated);
      qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
        prev?.map((m) => (m.id === id ? updated : m))
      );
    },
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMeeting(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
        prev?.filter((m) => m.id !== id)
      );
      qc.removeQueries({ queryKey: meetingKey(id) });
    },
  });
}
