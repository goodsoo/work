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

const todosKey = ["todos"] as const;

export function useTodos() {
  return useQuery({
    queryKey: todosKey,
    queryFn: listTodos,
  });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TodoInsert) => createTodo(input),
    onSuccess: (created) => {
      qc.setQueryData<Todo[]>(todosKey, (prev) =>
        prev ? [created, ...prev] : [created],
      );
    },
  });
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TodoUpdate }) =>
      updateTodo(id, patch),
    // optimistic update — done toggle 즉각 반응
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: todosKey });
      const prev = qc.getQueryData<Todo[]>(todosKey);
      qc.setQueryData<Todo[]>(todosKey, (curr) =>
        curr?.map((t) => (t.id === id ? { ...t, ...patch } as Todo : t)),
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTodo(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<Todo[]>(todosKey, (prev) =>
        prev?.filter((t) => t.id !== id),
      );
    },
  });
}
