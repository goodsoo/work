import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRoutine,
  emptyRoutineTrash,
  isActiveOn,
  isArchivedOn,
  listRoutines,
  listTrashedRoutines,
  purgeRoutine,
  readRoutine,
  restoreRoutine,
  routinePath,
  sortRoutines,
  toggleRoutineDay,
  trashRoutine,
  updateRoutine,
  type CreateRoutineInput,
  type Routine,
  type TrashedRoutine,
  type UpdateRoutineInput,
} from "../api/routines";
import { useVault } from "../lib/vault/useVault";

const routinesKey = ["routines"] as const;
const routineKey = (name: string) => ["routine", name] as const;
const routineTrashKey = ["routines", "trash"] as const;

export function useRoutines() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: routinesKey,
    queryFn: () => listRoutines(adapter),
    enabled: isReady,
  });
}

// 그날 활성 routine list — 캘린더 사이드바 등 표시용. listRoutines 캐시 위에서
// derive 만 (별도 fetch X) → invalidate 1번이 둘 다 갱신.
export function useActiveRoutines(dateIso: string): Routine[] {
  const all = useRoutines();
  if (!all.data) return [];
  return sortRoutines(
    all.data.filter((r) => isActiveOn(r.frontmatter, dateIso)),
  );
}

// 종료일 지난 routine — "지난 루틴" 영역 표시용. useActiveRoutines 와 같은 derive 패턴.
export function useArchivedRoutines(dateIso: string): Routine[] {
  const all = useRoutines();
  if (!all.data) return [];
  return sortRoutines(
    all.data.filter((r) => isArchivedOn(r.frontmatter, dateIso)),
  );
}

export function useRoutine(name: string | null) {
  const { adapter, isReady } = useVault();
  const list = useRoutines();
  return useQuery({
    queryKey: name ? routineKey(name) : ["routine", null],
    queryFn: async () => {
      if (!name) return null;
      const r = await readRoutine(adapter, name);
      if (!r) throw new Error(`routine not found: ${name}`);
      return r;
    },
    enabled: isReady && !!name && list.isSuccess,
    retry: 2,
  });
}

export function useCreateRoutine() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRoutineInput) => {
      const r = await createRoutine(adapter, input);
      watcher.markSelfWrite(r.filePath);
      return r;
    },
    onSuccess: (created) => {
      qc.setQueryData<Routine[]>(routinesKey, (prev) =>
        prev ? sortRoutines([...prev, created]) : [created],
      );
    },
  });
}

export function useUpdateRoutine() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      patch,
    }: {
      name: string;
      patch: UpdateRoutineInput;
    }) => {
      const r = await updateRoutine(adapter, name, patch);
      watcher.markSelfWrite(r.filePath);
      return { prev: name, next: r };
    },
    onSuccess: ({ prev, next }) => {
      qc.setQueryData<Routine[]>(routinesKey, (list) =>
        list ? sortRoutines(list.map((r) => (r.name === prev ? next : r))) : list,
      );
      qc.setQueryData(routineKey(next.name), next);
      if (prev !== next.name) {
        qc.removeQueries({ queryKey: routineKey(prev) });
      }
    },
  });
}

// 삭제 = 휴지통 이동 (soft delete). 메모/포트폴리오와 같은 패턴.
// 복원 가능하므로 invalidate 시 trash list 도 함께 갱신.
export function useDeleteRoutine() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const trashPath = await trashRoutine(adapter, name);
      watcher.markSelfWrite(routinePath(name));
      watcher.markSelfWrite(trashPath);
      return name;
    },
    onSuccess: (name) => {
      qc.setQueryData<Routine[]>(routinesKey, (prev) =>
        prev?.filter((r) => r.name !== name),
      );
      qc.removeQueries({ queryKey: routineKey(name) });
      qc.invalidateQueries({ queryKey: routineTrashKey });
    },
  });
}

export function useTrashedRoutines() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: routineTrashKey,
    queryFn: () => listTrashedRoutines(adapter),
    enabled: isReady,
  });
}

export function useRestoreRoutine() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trashPath: string) => {
      const restoredPath = await restoreRoutine(adapter, trashPath);
      watcher.markSelfWrite(trashPath);
      watcher.markSelfWrite(restoredPath);
      return { trashPath, restoredPath };
    },
    onSuccess: ({ trashPath }) => {
      qc.setQueryData<TrashedRoutine[]>(routineTrashKey, (prev) =>
        prev?.filter((t) => t.trashPath !== trashPath),
      );
      qc.invalidateQueries({ queryKey: routinesKey });
    },
  });
}

export function usePurgeRoutine() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trashPath: string) => {
      await purgeRoutine(adapter, trashPath);
      watcher.markSelfWrite(trashPath);
      return trashPath;
    },
    onSuccess: (trashPath) => {
      qc.setQueryData<TrashedRoutine[]>(routineTrashKey, (prev) =>
        prev?.filter((t) => t.trashPath !== trashPath),
      );
    },
  });
}

export function useEmptyRoutineTrash() {
  const { adapter } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await emptyRoutineTrash(adapter);
    },
    onSuccess: () => {
      qc.setQueryData<TrashedRoutine[]>(routineTrashKey, []);
    },
  });
}

export function useToggleRoutineDay() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      date,
      done,
    }: {
      name: string;
      date: string;
      done: boolean;
    }) => {
      const r = await toggleRoutineDay(adapter, name, date, done);
      watcher.markSelfWrite(r.filePath);
      return r;
    },
    onMutate: async ({ name, date, done }) => {
      await qc.cancelQueries({ queryKey: routineKey(name) });
      await qc.cancelQueries({ queryKey: routinesKey });
      const prevDetail = qc.getQueryData<Routine | null>(routineKey(name));
      const prevList = qc.getQueryData<Routine[]>(routinesKey);
      const apply = (r: Routine | null | undefined) => {
        if (!r) return r;
        const log = new Set(r.log);
        if (done) log.add(date);
        else log.delete(date);
        return { ...r, log };
      };
      if (prevDetail) qc.setQueryData(routineKey(name), apply(prevDetail));
      qc.setQueryData<Routine[]>(routinesKey, (prev) =>
        prev?.map((r) => (r.name === name ? (apply(r) as Routine) : r)),
      );
      return { prevDetail, prevList };
    },
    onError: (_e, vars, ctx) => {
      if (ctx?.prevDetail !== undefined) {
        qc.setQueryData(routineKey(vars.name), ctx.prevDetail);
      }
      if (ctx?.prevList) qc.setQueryData(routinesKey, ctx.prevList);
    },
    onSuccess: (updated) => {
      qc.setQueryData(routineKey(updated.name), updated);
      qc.setQueryData<Routine[]>(routinesKey, (prev) =>
        prev?.map((r) => (r.name === updated.name ? updated : r)),
      );
    },
  });
}
