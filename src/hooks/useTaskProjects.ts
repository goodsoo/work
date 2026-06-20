import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listProjects,
  createProject,
  deleteProject,
  type TaskProject,
} from "../api/taskProjects";
import { useVault } from "../lib/vault/useVault";

const projectsKey = ["task-projects"] as const;

export function useTaskProjects() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: projectsKey,
    queryFn: () => listProjects(adapter),
    enabled: isReady,
  });
}

export function useCreateProject() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const created = await createProject(adapter, name);
      watcher.markSelfWrite(created.file);
      return created;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectsKey });
    },
  });
}

export function useDeleteProject() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project: TaskProject) => {
      await deleteProject(adapter, project.file);
      watcher.markSelfWrite(project.file);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectsKey });
      // 프로젝트 파일이 사라지면 그 안 task 도 목록에서 빠져야 함.
      void qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}
