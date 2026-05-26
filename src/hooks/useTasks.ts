import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTodo,
  deleteTask,
  listTodos,
  updateTask,
  type Task,
  type TaskInsert,
  type TodoUpdate,
} from "../api/tasks";
import { useVault } from "../lib/vault/useVault";

const todosKey = ["todos"] as const;

export function useTasks() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: todosKey,
    queryFn: () => listTodos(adapter),
    enabled: isReady,
  });
}

export function useCreateTask() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TaskInsert) => {
      const created = await createTodo(adapter, input);
      watcher.markSelfWrite(created._source.file);
      return created;
    },
    onSuccess: (created) => {
      qc.setQueryData<Task[]>(todosKey, (prev) =>
        prev ? [created, ...prev] : [created],
      );
    },
  });
}

export function useUpdateTask() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TodoUpdate }) => {
      const updated = await updateTask(adapter, id, patch);
      watcher.markSelfWrite(updated._source.file);
      return updated;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: todosKey });
      const prev = qc.getQueryData<Task[]>(todosKey);
      qc.setQueryData<Task[]>(todosKey, (curr) =>
        curr?.map((t) => (t.id === id ? ({ ...t, ...patch } as Task) : t)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(todosKey, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: todosKey });
    },
  });
}

export function useDeleteTask() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const file = id.replace(/#L\d+$/, "");
      await deleteTask(adapter, id);
      watcher.markSelfWrite(file);
    },
    onSuccess: (_void, id) => {
      qc.setQueryData<Task[]>(todosKey, (prev) =>
        prev?.filter((t) => t.id !== id),
      );
    },
  });
}
