// V0.7 step 6 — portfolio hooks (TanStack Query).
// useMeetings 패턴 그대로. useGhSync 는 별도 (mutable run state 보유).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ATTACHMENTS_DIR,
  BUILTIN_CATEGORIES,
  CATEGORIES_FILE,
  PORTFOLIO_DIR,
  PORTFOLIO_TRASH_DIR,
  createManualPortfolioWork,
  createPortfolioFolder,
  deletePortfolioFolder,
  emptyPortfolioTrash,
  listManualFolders,
  listTrashedPortfolioWorks,
  mergeCategoryDefs,
  moveManualCard,
  portfolioWorkPath,
  purgePortfolioWork,
  readPortfolioCategories,
  readSyncState,
  readPortfolioWork,
  renamePortfolioFolder,
  restorePortfolioWork,
  scanPortfolio,
  syncPortfolio,
  writePortfolioCategories,
  type CreateManualPortfolioInput,
  type PortfolioCategoryDef,
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
const foldersKey = ["portfolio-folders"] as const;
const categoriesKey = ["portfolio-categories"] as const;
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
    "included" | "category" | "impact_summary" | "screenshots"
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

// 수동 카드 생성 — PR 무관 (오프라인 업무, 회의 발표 등). legacy schema 로 저장.
export function useCreateManualPortfolioWork() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateManualPortfolioInput) => {
      const work = await createManualPortfolioWork(adapter, input);
      watcher.markSelfWrite(work.filePath);
      return work;
    },
    onSuccess: () => {
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
// Manual folders — vault 실제 디렉토리 트리. 메모장 폴더 패턴 동형.

export function useManualFolders() {
  const { adapter, isReady } = useVault();
  return useQuery({
    queryKey: foldersKey,
    queryFn: () => listManualFolders(adapter),
    enabled: isReady,
  });
}

export function useCreatePortfolioFolder() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { parent: string; name: string }) => {
      const path = await createPortfolioFolder(adapter, input.parent, input.name);
      watcher.markSelfWrite(`${PORTFOLIO_DIR}/${path}`);
      return path;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: foldersKey });
    },
  });
}

export function useRenamePortfolioFolder() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fromPath: string; newName: string }) => {
      const toPath = await renamePortfolioFolder(
        adapter,
        input.fromPath,
        input.newName,
      );
      watcher.markSelfWrite(`${PORTFOLIO_DIR}/${input.fromPath}`);
      watcher.markSelfWrite(`${PORTFOLIO_DIR}/${toPath}`);
      return { fromPath: input.fromPath, toPath };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: foldersKey });
      qc.invalidateQueries({ queryKey: worksKey });
    },
  });
}

// 수동 카드의 폴더 이동 — disk rename. 카드 frontmatter 안 만짐 (vault path 가 진실).
export function useMoveManualCard() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { fromPath: string; toFolder: string }) => {
      const newPath = await moveManualCard(
        adapter,
        input.fromPath,
        input.toFolder,
      );
      watcher.markSelfWrite(input.fromPath);
      watcher.markSelfWrite(newPath);
      return newPath;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: worksKey });
      qc.invalidateQueries({ queryKey: foldersKey });
    },
  });
}

export function useDeletePortfolioFolder() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folderPath: string) => {
      const result = await deletePortfolioFolder(adapter, folderPath);
      watcher.markSelfWrite(`${PORTFOLIO_DIR}/${folderPath}`);
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: foldersKey });
      qc.invalidateQueries({ queryKey: worksKey });
      qc.invalidateQueries({ queryKey: trashKey });
    },
  });
}

// 카테고리 정의 — builtin 5 + categories.md user-defined + 카드 frontmatter 의 unique
// slug 들 union. 옵시디안에서 카드 frontmatter 만 임의 slug 박아도 사이드바 chip row 에
// 자동 등장 (orphan 개념 없음). categories.md 는 색·label override + 빈 카테고리 즐겨찾기.
//
// 구현: raw user 정의를 query 로 캐싱 + worksQuery 의 data 와 useMemo 로 union 계산.
// works 는 같은 queryKey(`portfolio`) 라 다른 hook 호출과 자동 캐시 공유.
export function usePortfolioCategories() {
  const { adapter, isReady } = useVault();
  const worksQuery = useQuery({
    queryKey: worksKey,
    queryFn: () => scanPortfolio(adapter),
    enabled: isReady,
  });
  const raw = useQuery({
    queryKey: categoriesKey,
    queryFn: () => readPortfolioCategories(adapter),
    enabled: isReady,
  });
  const data = useMemo(
    () => mergeCategoryDefs(raw.data ?? [], worksQuery.data ?? []),
    [raw.data, worksQuery.data],
  );
  return { ...raw, data };
}

// 사용자 카테고리 추가 / 수정 — categories.md 의 user-defined 배열만 갱신 (builtin 5 는
// 코드 const). builtin slug 와 같으면 label/color override 로 동작. 호출처에서 신규/수정
// 모두 이걸로 처리.
export function useAddPortfolioCategory() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (def: PortfolioCategoryDef) => {
      const existing = await readPortfolioCategories(adapter);
      // 같은 slug 있으면 새 def 로 덮기, 아니면 append.
      const idx = existing.findIndex((c) => c.slug === def.slug);
      const next =
        idx >= 0
          ? existing.map((c, i) => (i === idx ? def : c))
          : [...existing, def];
      await writePortfolioCategories(adapter, next);
      watcher.markSelfWrite(CATEGORIES_FILE);
      return next;
    },
    onSuccess: (next) => {
      // raw user-defined 만 categoriesKey 에 보관 — usePortfolioCategories 의
      // useMemo 가 builtin + 카드 frontmatter 와 union 계산.
      qc.setQueryData(categoriesKey, next);
    },
  });
}

// 카테고리 삭제 — categories.md user-defined 에서 entry 제거.
// 사용 중인 카드 (frontmatter.category === slug) 는 "other" 로 일괄 patch.
// builtin slug (ui_ux 등) 삭제 = categories.md 의 override 제거 = label/color default 복귀
// (코드 const 5는 항상 존재). 카드 마이그레이션도 builtin 의 경우 적용 안 함 (slug 그대로 유효).
export function useDeletePortfolioCategory() {
  const { adapter, watcher } = useVault();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      // 1) categories.md 에서 entry 제거 (없으면 변동 없음 — builtin 만 있던 경우)
      const existing = await readPortfolioCategories(adapter);
      const next = existing.filter((c) => c.slug !== slug);
      if (next.length !== existing.length) {
        await writePortfolioCategories(adapter, next);
        watcher.markSelfWrite(CATEGORIES_FILE);
      }
      // 2) custom slug (builtin 외) 인 경우만 카드 마이그레이션 — 빌트인 slug 는 코드 const
      //    상수라 항상 유효, override 만 제거됨.
      const isBuiltin = (BUILTIN_CATEGORIES as readonly string[]).includes(slug);
      let migrated = 0;
      if (!isBuiltin) {
        const works = await scanPortfolio(adapter);
        for (const w of works) {
          if (w.frontmatter.category !== slug) continue;
          try {
            const path = w.filePath;
            const raw = await adapter.read(path);
            const patched = patchFrontmatter(raw, { category: "other" });
            if (patched !== raw) {
              await adapter.write(path, patched);
              watcher.markSelfWrite(path);
              migrated++;
            }
          } catch {
            // 한 카드 실패해도 다음 진행
          }
        }
      }
      return { next, migrated };
    },
    onSuccess: ({ next }) => {
      qc.setQueryData(categoriesKey, next);
      qc.invalidateQueries({ queryKey: worksKey });
    },
  });
}

// 옛 projects.md 기반 hook (useWritePortfolioProjects / useAddPortfolioProject /
// useDeletePortfolioProject / useRenamePortfolioProject) 은 vault path 기반 폴더
// 모델로 대체되어 제거됨. github 그룹은 카드 frontmatter 에서 derive, 수동 폴더는
// 실제 vault 디렉토리 — useManualFolders / useCreatePortfolioFolder / 등 사용.

// ─────────────────────────────────────────────────────────────────────────────
// useGhSync — local mutable run state. design 1B: 시작/완료/중단 상태 노출.

export interface GhSyncProgress {
  running: boolean;
  current: number;
  total: number;
  error: Error | null;
  lastResult: SyncPortfolioResult | null;
}

// readSyncState 가 hang 되면 5초 후 full sync 로 fallback. Tauri 의
// "Couldn't find callback id" 후 invoke 응답이 영영 안 오는 경우 (dev 중 vite
// full-reload 와 동시 sync) 의 stuck 방어. since 만 손해.
const READ_SYNC_STATE_TIMEOUT_MS = 5000;

async function readSyncStateWithTimeout(
  adapter: Parameters<typeof readSyncState>[0],
): Promise<Awaited<ReturnType<typeof readSyncState>> | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      readSyncState(adapter),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), READ_SYNC_STATE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  const runningRef = useRef(false);
  // 매 run() 마다 증가. cancel() 도 증가시켜 in-flight 의 setState 를 무효화.
  // hang 된 invoke 가 뒤늦게 resolve 되어도 stale 라 무시 → state/UI 깨끗.
  const callIdRef = useRef(0);

  const run = useCallback(
    async (
      opts: Pick<SyncPortfolioOpts, "since"> & { incremental?: boolean } = {},
    ) => {
      // race 차단 — 이미 sync 진행 중이면 새 호출 무시. background auto-sync + 사용자 클릭
      // 동시 발생 시 Tauri callback id 충돌 (callback 손실) 회피.
      if (runningRef.current) return null;
      runningRef.current = true;
      const myCallId = ++callIdRef.current;

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
        // incremental: hook 안에서 last_sync 읽어 since 결정. 호출처 closure 단순화.
        let since = opts.since;
        if (opts.incremental && !since) {
          const st = await readSyncStateWithTimeout(adapter);
          // null = timeout 또는 read 실패 → full sync (since 없이) 로 fallback.
          if (st?.last_sync) {
            since = new Date(
              new Date(st.last_sync).getTime() - 24 * 60 * 60 * 1000,
            )
              .toISOString()
              .slice(0, 10);
          }
        }
        const result = await syncPortfolio(adapter, {
          since,
          signal: controller.signal,
          onProgress: (current, total) => {
            // stale callId 면 progress 도 무시 — cancel 이후 hang 풀린 호출 보호.
            if (callIdRef.current !== myCallId) return;
            setState((s) => ({ ...s, current, total }));
          },
        });
        // success: callId 가 여전히 본인 것이어야 state 반영. cancel() 후라면 skip.
        if (callIdRef.current === myCallId) {
          setState({
            running: false,
            current: result.total,
            total: result.total,
            error: null,
            lastResult: result,
          });
          qc.invalidateQueries({ queryKey: worksKey });
        }
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (callIdRef.current === myCallId) {
          setState((s) => ({ ...s, running: false, error }));
        }
        throw err;
      } finally {
        if (callIdRef.current === myCallId) {
          abortRef.current = null;
          runningRef.current = false;
        }
      }
    },
    [adapter, qc],
  );

  // 사용자 manual 취소 또는 stuck 회복. abort 가 hung Tauri invoke 를 못 풀어도
  // callId 를 advance + runningRef 리셋해 다음 click 받음. 뒤늦게 resolve 되는
  // stale promise 의 setState 는 callId 가드로 무시.
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    callIdRef.current++;
    runningRef.current = false;
    abortRef.current = null;
    setState((s) => ({ ...s, running: false }));
  }, []);

  // 사이드바 inline 에러 row 의 X 닫기. run() 시작 시 error: null 로 자동 reset 되므로
  // 다음 sync 시 같은 에러는 다시 표시됨.
  const dismissError = useCallback(() => {
    setState((s) => (s.error ? { ...s, error: null } : s));
  }, []);

  return { state, run, cancel, dismissError };
}
