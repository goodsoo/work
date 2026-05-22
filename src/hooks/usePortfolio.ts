// V0.7 step 6 — portfolio hooks (TanStack Query).
// useMeetings 패턴 그대로. useGhSync 는 별도 (mutable run state 보유).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  ATTACHMENTS_DIR,
  PORTFOLIO_TRASH_DIR,
  PROJECTS_FILE,
  emptyPortfolioTrash,
  listTrashedPortfolioWorks,
  portfolioWorkPath,
  purgePortfolioWork,
  readPortfolioProjects,
  readPortfolioWork,
  restorePortfolioWork,
  scanPortfolio,
  syncPortfolio,
  writePortfolioProjects,
  type PortfolioProject,
  type PortfolioWork,
  type PortfolioWorkFrontmatter,
  type PortfolioWorkMeta,
  type SyncPortfolioOpts,
  type SyncPortfolioResult,
  type TrashedPortfolioWork,
} from "../api/portfolio";
import { useVault } from "../lib/vault/useVault";
import { patchFrontmatter } from "../lib/vault/parser";

const worksKey = ["portfolio"] as const;
const workKey = (slug: string) => ["portfolio", "work", slug] as const;
const projectsKey = ["portfolio-projects"] as const;
const trashKey = ["portfolio", "trash"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Works

export function usePortfolioWorks() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: worksKey,
    queryFn: () => scanPortfolio(adapter),
    enabled: isReady,
  });
}

export function usePortfolioWork(slug: string | undefined) {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: slug ? workKey(slug) : ["portfolio", "work", "none"],
    queryFn: () => readPortfolioWork(adapter, slug!),
    enabled: !!slug && isReady,
  });
}

// frontmatter 의 본인 수정 필드 patch (project / included / category / impact_summary).
// notes 본문 patch 는 별도 (body parse 필요).
export type PortfolioFrontmatterPatch = Partial<
  Pick<
    PortfolioWorkFrontmatter,
    "project" | "included" | "category" | "impact_summary" | "screenshots"
  >
>;

export function useUpdatePortfolioFrontmatter(slug: string) {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: PortfolioFrontmatterPatch) => {
      const path = portfolioWorkPath(slug);
      const raw = await adapter.read(path);
      const newRaw = patchFrontmatter(raw, patch as Record<string, unknown>);
      const meta = await adapter.write(path, newRaw);
      watcher.markSelfWrite(path);
      return readPortfolioWork(adapter, slug).then((w) =>
        w ? { ...w, mtime: meta.mtime } : null,
      );
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: workKey(slug) });
      const prevWork = qc.getQueryData<PortfolioWork>(workKey(slug));
      const prevList = qc.getQueryData<PortfolioWorkMeta[]>(worksKey);
      if (prevWork) {
        qc.setQueryData<PortfolioWork>(workKey(slug), {
          ...prevWork,
          frontmatter: { ...prevWork.frontmatter, ...patch },
        });
      }
      qc.setQueryData<PortfolioWorkMeta[]>(worksKey, (curr) =>
        curr?.map((w) =>
          w.prSlug === slug
            ? { ...w, frontmatter: { ...w.frontmatter, ...patch } }
            : w,
        ),
      );
      return { prevWork, prevList };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevWork) qc.setQueryData(workKey(slug), ctx.prevWork);
      if (ctx?.prevList) qc.setQueryData(worksKey, ctx.prevList);
    },
    onSuccess: (updated) => {
      if (updated) {
        qc.setQueryData(workKey(slug), updated);
      }
      qc.invalidateQueries({ queryKey: worksKey });
    },
  });
}

// 삭제 = portfolio/.trash/ 로 이동 (메모장 vault `.trash/` 와 별개 — portfolio 도메인 내부 휴지통).
// _attachments/{slug}/ 짝도 같은 stamp 로 portfolio/.trash/ 이동.
export function useDeletePortfolioWork() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      const cardPath = portfolioWorkPath(slug);
      await adapter.mkdir(PORTFOLIO_TRASH_DIR);
      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      // 카드 파일 이동
      await adapter.rename(
        cardPath,
        `${PORTFOLIO_TRASH_DIR}/${stamp}-${slug}.md`,
      );
      watcher.markSelfWrite(cardPath);
      // _attachments/{slug}/ 짝 이동 — best effort, 없으면 skip
      const attachDir = `${ATTACHMENTS_DIR}/${slug}`;
      try {
        if (await adapter.exists(attachDir)) {
          await adapter.rename(
            attachDir,
            `${PORTFOLIO_TRASH_DIR}/${stamp}-attachments-${slug}`,
          );
        }
      } catch {
        // 디렉토리 rename 실패 — Tauri/OS 의존, 매일 사용에서 발견하면 fix
      }
      return slug;
    },
    onSuccess: (slug) => {
      qc.setQueryData<PortfolioWorkMeta[]>(worksKey, (prev) =>
        prev?.filter((w) => w.prSlug !== slug),
      );
      qc.removeQueries({ queryKey: workKey(slug) });
      qc.invalidateQueries({ queryKey: trashKey });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Trash

export function useTrashedPortfolioWorks() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: trashKey,
    queryFn: () => listTrashedPortfolioWorks(adapter),
    enabled: isReady,
  });
}

// 복원 — trashPath → 원위치. 충돌 시 throw → 호출처에서 toast.
export function useRestorePortfolioWork() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trashPath: string) => {
      const restored = await restorePortfolioWork(adapter, trashPath);
      watcher.markSelfWrite(restored);
      return restored;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: worksKey });
      qc.invalidateQueries({ queryKey: trashKey });
    },
  });
}

// 영구 삭제 (휴지통에서만) — 카드 + attachments 폴더 안 파일 모두 삭제.
export function usePurgePortfolioWork() {
  const { adapter } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trashPath: string) => {
      await purgePortfolioWork(adapter, trashPath);
      return trashPath;
    },
    onSuccess: (trashPath) => {
      qc.setQueryData<TrashedPortfolioWork[]>(trashKey, (prev) =>
        prev?.filter((t) => t.trashPath !== trashPath),
      );
    },
  });
}

// 휴지통 비우기 — portfolio/.trash 안 카드 + attachments 모두 영구 삭제.
export function useEmptyPortfolioTrash() {
  const { adapter } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await emptyPortfolioTrash(adapter);
    },
    onSuccess: () => {
      qc.setQueryData<TrashedPortfolioWork[]>(trashKey, []);
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Projects

export function usePortfolioProjects() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: projectsKey,
    queryFn: () => readPortfolioProjects(adapter),
    enabled: isReady,
  });
}

export function useWritePortfolioProjects() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projects: PortfolioProject[]) => {
      await writePortfolioProjects(adapter, projects);
      watcher.markSelfWrite(PROJECTS_FILE);
      return projects;
    },
    onSuccess: (projects) => {
      qc.setQueryData(projectsKey, projects);
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useGhSync — local mutable run state. design 1B: 시작/완료/중단 상태 노출.

export interface GhSyncProgress {
  running: boolean;
  current: number;
  total: number;
  error: Error | null;
  lastResult: SyncPortfolioResult | null;
}

export function useGhSync() {
  const { adapter } = useVault();
  const qc = useQueryClient();
  const [state, setState] = useState<GhSyncProgress>({
    running: false,
    current: 0,
    total: 0,
    error: null,
    lastResult: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (opts: Pick<SyncPortfolioOpts, "since"> = {}) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setState((s) => ({
        ...s,
        running: true,
        current: 0,
        total: 0,
        error: null,
      }));
      try {
        const result = await syncPortfolio(adapter, {
          since: opts.since,
          signal: controller.signal,
          onProgress: (current, total) =>
            setState((s) => ({ ...s, current, total })),
        });
        setState({
          running: false,
          current: result.total,
          total: result.total,
          error: null,
          lastResult: result,
        });
        qc.invalidateQueries({ queryKey: worksKey });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState((s) => ({ ...s, running: false, error }));
        throw err;
      } finally {
        abortRef.current = null;
      }
    },
    [adapter, qc],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { state, run, cancel };
}
