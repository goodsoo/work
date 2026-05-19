import {
  readTextFile,
  writeTextFile,
  readDir,
  mkdir as tauriMkdir,
  remove as tauriRemove,
  rename as tauriRename,
  exists as tauriExists,
  stat as tauriStat,
  watch as tauriWatch,
} from "@tauri-apps/plugin-fs";

export interface FileMeta {
  mtime: number; // ms epoch
  size: number;
}

export type VaultWatchEvent =
  | { type: "created"; path: string }
  | { type: "modified"; path: string }
  | { type: "deleted"; path: string }
  | { type: "renamed"; from: string; to: string };

export class ConflictError extends Error {
  path: string;
  expectedMtime: number;
  actualMtime: number;
  constructor(path: string, expectedMtime: number, actualMtime: number) {
    super(
      `vault conflict: ${path} mtime ${actualMtime} ≠ expected ${expectedMtime}`,
    );
    this.name = "ConflictError";
    this.path = path;
    this.expectedMtime = expectedMtime;
    this.actualMtime = actualMtime;
  }
}

export interface VaultAdapter {
  setRoot(absPath: string): void;
  getRoot(): string | null;

  list(subdir: string): Promise<string[]>;
  read(relPath: string): Promise<string>;
  readMeta(relPath: string): Promise<FileMeta>;
  // expectedMtime: 마지막으로 읽었을 때의 mtime. 디스크가 더 새 거면 ConflictError throw.
  write(
    relPath: string,
    content: string,
    expectedMtime?: number,
  ): Promise<FileMeta>;
  delete(relPath: string): Promise<void>;
  rename(fromRel: string, toRel: string): Promise<void>;
  exists(relPath: string): Promise<boolean>;
  mkdir(relPath: string): Promise<void>;

  watch(callback: (event: VaultWatchEvent) => void): Promise<() => void>;
}

function joinAbs(root: string, rel: string): string {
  if (rel.startsWith("/")) throw new Error(`expected relative path: ${rel}`);
  if (rel.includes("..")) throw new Error(`path traversal blocked: ${rel}`);
  const r = root.endsWith("/") ? root.slice(0, -1) : root;
  const p = rel.startsWith("./") ? rel.slice(2) : rel;
  return p === "" ? r : `${r}/${p}`;
}

// 같은 abs path 에 대한 write 직렬화. 두 동시 write 가 공유 tmp 를 만져
// 첫 번째 rename 으로 tmp 소진 → 두 번째 remove 가 결과 파일 삭제 → 두 번째
// rename 이 ENOENT 떨어지며 파일이 진짜 사라지는 race 차단. POSIX rename 자체는
// atomic 이지만 'remove → rename' 시퀀스는 비-원자라 lock 필요.
const writeLocks = new Map<string, Promise<unknown>>();
export async function withWriteLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = writeLocks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  writeLocks.set(key, next);
  try {
    return await next;
  } finally {
    if (writeLocks.get(key) === next) writeLocks.delete(key);
  }
}

function toRel(root: string, abs: string): string {
  const r = root.endsWith("/") ? root : root + "/";
  return abs.startsWith(r) ? abs.slice(r.length) : abs;
}

export function createTauriAdapter(): VaultAdapter {
  let root: string | null = null;

  const requireRoot = (): string => {
    if (!root) throw new Error("vault root not set");
    return root;
  };

  return {
    setRoot(absPath: string) {
      root = absPath;
    },
    getRoot() {
      return root;
    },

    async list(subdir: string): Promise<string[]> {
      const r = requireRoot();
      const abs = joinAbs(r, subdir);
      try {
        const entries = await readDir(abs);
        return entries
          .filter((e) => e.isFile && e.name && !e.name.startsWith("."))
          .map((e) => (subdir === "" ? e.name! : `${subdir}/${e.name!}`));
      } catch (err) {
        // 디렉토리 없으면 빈 배열
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("No such file") || msg.includes("not found")) return [];
        throw err;
      }
    },

    async read(relPath: string): Promise<string> {
      return readTextFile(joinAbs(requireRoot(), relPath));
    },

    async readMeta(relPath: string): Promise<FileMeta> {
      const s = await tauriStat(joinAbs(requireRoot(), relPath));
      const mtime = s.mtime ? new Date(s.mtime).getTime() : 0;
      return { mtime, size: s.size };
    },

    async write(
      relPath: string,
      content: string,
      expectedMtime?: number,
    ): Promise<FileMeta> {
      const abs = joinAbs(requireRoot(), relPath);

      return withWriteLock(abs, async () => {
        if (expectedMtime !== undefined) {
          const existed = await tauriExists(abs);
          if (existed) {
            const s = await tauriStat(abs);
            const actual = s.mtime ? new Date(s.mtime).getTime() : 0;
            // 1초 미만 차이는 같은 write 로 간주 (파일 시스템 mtime resolution)
            if (Math.abs(actual - expectedMtime) > 1000) {
              throw new ConflictError(relPath, expectedMtime, actual);
            }
          }
        }

        // Atomic write: 고유 tmp file → rename. tmp 이름이 attempt 마다 고유라
        // lock 가 어떤 이유로 풀려도 tmp 충돌 X.
        const suffix = `${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 10)}`;
        const tmp = `${abs}.${suffix}.tmp`;
        await writeTextFile(tmp, content);
        // remove existing then rename (Tauri rename은 dest 존재 시 실패할 수 있음)
        const existed = await tauriExists(abs);
        if (existed) await tauriRemove(abs);
        await tauriRename(tmp, abs);

        const s = await tauriStat(abs);
        return {
          mtime: s.mtime ? new Date(s.mtime).getTime() : Date.now(),
          size: s.size,
        };
      });
    },

    async delete(relPath: string): Promise<void> {
      await tauriRemove(joinAbs(requireRoot(), relPath));
    },

    async rename(fromRel: string, toRel: string): Promise<void> {
      const r = requireRoot();
      await tauriRename(joinAbs(r, fromRel), joinAbs(r, toRel));
    },

    async exists(relPath: string): Promise<boolean> {
      return tauriExists(joinAbs(requireRoot(), relPath));
    },

    async mkdir(relPath: string): Promise<void> {
      const abs = joinAbs(requireRoot(), relPath);
      if (await tauriExists(abs)) return;
      await tauriMkdir(abs, { recursive: true });
    },

    async watch(
      callback: (event: VaultWatchEvent) => void,
    ): Promise<() => void> {
      const r = requireRoot();
      // Tauri watch: recursive, debounce
      const unwatch = await tauriWatch(
        r,
        (event) => {
          // Tauri v2 plugin-fs 의 event.type 은 object — notify-rs EventKind 가
          // `{ create: { kind: "file" } }`, `{ modify: { kind: "metadata", mode: "..." } }`,
          // `{ remove: { kind: "file" } }` 식으로 직렬화. 옛 코드는 String(...) 로
          // 변환해 `.includes` 검사 → "[object Object]" 라 매칭 항상 실패 → 외부 변경이
          // 사이드바에 영영 반영 안 되던 버그.
          const eType = (event as { type?: unknown }).type;
          if (typeof eType !== "object" || eType === null) return;
          const obj = eType as Record<string, unknown>;

          let kind: VaultWatchEvent["type"] | null = null;
          if ("create" in obj) kind = "created";
          else if ("remove" in obj) kind = "deleted";
          else if ("modify" in obj) {
            // metadata-only 변경은 macOS Finder/iCloud 가 폴더 touch 시 폭주.
            // 실제 파일 내용/이름 변화 아니므로 skip.
            const sub = (obj.modify as { kind?: string })?.kind;
            if (sub === "metadata") return;
            // macOS Finder delete = `.Trash` 로 rename. notify-rs 가 from/to 안 줘서
            // 옛 path 만 옴. 같은 path 가 사라진 것과 동치 → deleted 로 normalize.
            // vault 안 이동도 같은 처리 — refetch 가 새 위치 발견.
            if (sub === "rename") kind = "deleted";
            else kind = "modified";
          }
          if (!kind) return;

          const paths = (event as { paths?: string[] }).paths ?? [];
          for (const abs of paths) {
            const rel = toRel(r, abs);
            // hidden 파일 (.DS_Store 등) 무시 — vault scan 도 dotfile 제외.
            const base = rel.split("/").pop() ?? "";
            if (base.startsWith(".")) continue;
            callback({ type: kind, path: rel });
          }
        },
        { recursive: true, delayMs: 100 },
      );
      return unwatch;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory adapter (테스트용)

export function createMemoryAdapter(): VaultAdapter & {
  __trigger(event: VaultWatchEvent): void;
  __dump(): Map<string, { content: string; mtime: number }>;
} {
  let root: string | null = null;
  const files = new Map<string, { content: string; mtime: number }>();
  const dirs = new Set<string>();
  const watchers = new Set<(e: VaultWatchEvent) => void>();
  let clock = 1_700_000_000_000;
  const tick = () => (clock += 1500);

  const requireRoot = (): string => {
    if (!root) throw new Error("vault root not set");
    return root;
  };

  return {
    setRoot(absPath: string) {
      root = absPath;
    },
    getRoot() {
      return root;
    },

    async list(subdir: string): Promise<string[]> {
      requireRoot();
      const prefix = subdir === "" ? "" : subdir + "/";
      const result: string[] = [];
      for (const path of files.keys()) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        // 직속 자식만 (한 단계 깊이)
        if (rest.includes("/")) continue;
        if (rest.startsWith(".")) continue;
        result.push(path);
      }
      return result;
    },

    async read(relPath: string): Promise<string> {
      requireRoot();
      const f = files.get(relPath);
      if (!f) throw new Error(`ENOENT: ${relPath}`);
      return f.content;
    },

    async readMeta(relPath: string): Promise<FileMeta> {
      requireRoot();
      const f = files.get(relPath);
      if (!f) throw new Error(`ENOENT: ${relPath}`);
      return { mtime: f.mtime, size: f.content.length };
    },

    async write(
      relPath: string,
      content: string,
      expectedMtime?: number,
    ): Promise<FileMeta> {
      requireRoot();
      if (expectedMtime !== undefined) {
        const existing = files.get(relPath);
        if (existing && Math.abs(existing.mtime - expectedMtime) > 1000) {
          throw new ConflictError(relPath, expectedMtime, existing.mtime);
        }
      }
      const mtime = tick();
      files.set(relPath, { content, mtime });
      const event: VaultWatchEvent = { type: "modified", path: relPath };
      for (const w of watchers) w(event);
      return { mtime, size: content.length };
    },

    async delete(relPath: string): Promise<void> {
      requireRoot();
      files.delete(relPath);
      for (const w of watchers) w({ type: "deleted", path: relPath });
    },

    async rename(fromRel: string, toRel: string): Promise<void> {
      requireRoot();
      const f = files.get(fromRel);
      if (!f) throw new Error(`ENOENT: ${fromRel}`);
      files.delete(fromRel);
      files.set(toRel, { ...f, mtime: tick() });
      for (const w of watchers) w({ type: "renamed", from: fromRel, to: toRel });
    },

    async exists(relPath: string): Promise<boolean> {
      requireRoot();
      return files.has(relPath) || dirs.has(relPath);
    },

    async mkdir(relPath: string): Promise<void> {
      requireRoot();
      dirs.add(relPath);
    },

    async watch(
      callback: (event: VaultWatchEvent) => void,
    ): Promise<() => void> {
      watchers.add(callback);
      return () => watchers.delete(callback);
    },

    __trigger(event: VaultWatchEvent) {
      for (const w of watchers) w(event);
    },
    __dump() {
      return new Map(files);
    },
  };
}
