import type { QueryClient } from "@tanstack/react-query";
import type { VaultAdapter, VaultWatchEvent } from "./adapter";

// vault 변경 시 어떤 query key 를 invalidate 할지 매핑.
// hooks 의 query key 와 일치해야 함.
function affectedQueryKeys(path: string): unknown[][] {
  const keys: unknown[][] = [];
  if (path.startsWith("meetings/")) {
    keys.push(["meetings"]);
    keys.push(["meetings", path]);
    keys.push(["todos"]); // 회의록 안 todo 가 통합 뷰에 영향
  } else if (path.startsWith("journals/")) {
    keys.push(["journals"]);
    keys.push(["journals", path]);
    keys.push(["todos"]);
  } else if (path === "inbox.md" || !path.includes("/")) {
    // root level *.md (inbox 등)
    keys.push(["todos"]);
    keys.push(["inbox"]);
  }
  return keys;
}

// debounce 헬퍼 (한 파일에 대한 빠른 연속 변경을 합침)
function debounceByKey<T>(
  fn: (key: string, value: T) => void,
  delayMs: number,
): (key: string, value: T) => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return (key, value) => {
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        fn(key, value);
      }, delayMs),
    );
  };
}

export interface WatcherOptions {
  // 우리가 직접 write 한 직후의 modified 이벤트는 무시 (자기 변경).
  // adapter.write() 호출 직후 같은 path 를 markSelfWrite 로 등록해두면 N ms 내 modified 이벤트 skip.
  selfWriteWindowMs?: number;
}

export interface VaultWatcher {
  start(): Promise<void>;
  stop(): void;
  markSelfWrite(path: string): void;
}

export function createVaultWatcher(
  adapter: VaultAdapter,
  queryClient: QueryClient,
  options: WatcherOptions = {},
): VaultWatcher {
  const selfWindow = options.selfWriteWindowMs ?? 1000;
  const selfWrites = new Map<string, number>(); // path → timestamp
  let unwatch: (() => void) | null = null;

  const invalidateForPath = debounceByKey<void>((path) => {
    for (const key of affectedQueryKeys(path)) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }, 100);

  const handle = (event: VaultWatchEvent) => {
    const path = "path" in event ? event.path : event.to;
    // 자기 write 인지 확인
    const recent = selfWrites.get(path);
    if (recent && Date.now() - recent < selfWindow) {
      selfWrites.delete(path);
      return;
    }
    invalidateForPath(path);
  };

  return {
    async start() {
      if (unwatch) return;
      unwatch = await adapter.watch(handle);
    },
    stop() {
      if (unwatch) {
        unwatch();
        unwatch = null;
      }
    },
    markSelfWrite(path: string) {
      selfWrites.set(path, Date.now());
      // window 지나면 cleanup
      setTimeout(() => selfWrites.delete(path), selfWindow * 2);
    },
  };
}
