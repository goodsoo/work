import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMeeting,
  deleteMeeting,
  getMeeting,
  listDeletedMeetings,
  listMeetings,
  purgeMeeting,
  restoreMeeting,
  updateMeeting,
  type Meeting,
  type MeetingInsert,
  type MeetingUpdate,
} from "../api/meetings";

const meetingsKey = ["meetings"] as const;
const deletedMeetingsKey = ["meetings", "deleted"] as const;
const meetingKey = (id: string) => ["meetings", id] as const;

export function useMeetings() {
  return useQuery({
    queryKey: meetingsKey,
    queryFn: listMeetings,
  });
}

export function useDeletedMeetings() {
  return useQuery({
    queryKey: deletedMeetingsKey,
    queryFn: listDeletedMeetings,
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

// Soft delete: 활성 리스트에서 제거, 휴지통 invalidate (다음 조회 시 fetch).
export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMeeting(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
        prev?.filter((m) => m.id !== id)
      );
      qc.removeQueries({ queryKey: meetingKey(id) });
      qc.invalidateQueries({ queryKey: deletedMeetingsKey });
    },
  });
}

export function useRestoreMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreMeeting(id),
    onSuccess: (restored) => {
      qc.setQueryData<Meeting[]>(deletedMeetingsKey, (prev) =>
        prev?.filter((m) => m.id !== restored.id)
      );
      qc.setQueryData<Meeting[]>(meetingsKey, (prev) =>
        prev ? [restored, ...prev] : [restored]
      );
      qc.setQueryData(meetingKey(restored.id), restored);
    },
  });
}

// 영구 삭제 (휴지통에서만).
export function usePurgeMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purgeMeeting(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<Meeting[]>(deletedMeetingsKey, (prev) =>
        prev?.filter((m) => m.id !== id)
      );
      qc.removeQueries({ queryKey: meetingKey(id) });
    },
  });
}
