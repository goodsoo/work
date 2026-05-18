import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTodo,
  deleteTodo,
  listTodos,
  updateTodo,
  type Todo,
  type TodoInsert,
  type TodoUpdate,
} from "../api/todos";
import { useVault } from "../lib/vault/useVault";

const todosKey = ["todos"] as const;

export function useTodos() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: todosKey,
    queryFn: () => listTodos(adapter),
    enabled: isReady,
  });
}

export function useCreateTodo() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TodoInsert) => {
      const created = await createTodo(adapter, input);
      watcher.markSelfWrite(created._source.file);
      return created;
    },
    onSuccess: (created) => {
      qc.setQueryData<Todo[]>(todosKey, (prev) =>
        prev ? [created, ...prev] : [created],
      );
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["journals"] });
    },
  });
}

export function useUpdateTodo() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TodoUpdate }) => {
      const updated = await updateTodo(adapter, id, patch);
      watcher.markSelfWrite(updated._source.file);
      return updated;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: todosKey });
      const prev = qc.getQueryData<Todo[]>(todosKey);
      qc.setQueryData<Todo[]>(todosKey, (curr) =>
        curr?.map((t) => (t.id === id ? ({ ...t, ...patch } as Todo) : t)),
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

export function useDeleteTodo() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const file = id.replace(/#L\d+$/, "");
      await deleteTodo(adapter, id);
      watcher.markSelfWrite(file);
    },
    onSuccess: (_void, id) => {
      qc.setQueryData<Todo[]>(todosKey, (prev) =>
        prev?.filter((t) => t.id !== id),
      );
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["journals"] });
    },
  });
}
