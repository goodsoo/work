import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { parseSyncState, serializeSyncState } from "./state";
import { emptySyncState, type SyncState } from "./types";

// 기기 로컬 sync 상태 파일 — appDataDir/gcal-sync.json (vault 아님).
// vault 와 분리한 이유: syncToken 은 단일 커서라 같은 vault 를 여러 기기가
// 각자 advance 하면 서로 무효화(410 폭풍). 영구 매핑(eventId)은 task 줄 #gcal
// 태그에 있으니 이 파일엔 기기별 커서·스냅샷·묘비만 담는다.

const STATE_FILE = "gcal-sync.json";

async function statePath(): Promise<string> {
  return join(await appDataDir(), STATE_FILE);
}

// 직렬화는 단일 프로세스·단일 기기라 mutex 1개로 write 직렬화 (read-modify-write
// 사이 race 차단). 같은 turn 에 load→save 가 겹쳐도 안전.
let writeChain: Promise<unknown> = Promise.resolve();

export async function loadSyncState(): Promise<SyncState> {
  try {
    const path = await statePath();
    if (!(await exists(path))) return emptySyncState();
    return parseSyncState(await readTextFile(path));
  } catch {
    // 읽기 실패(권한·손상)는 빈 상태로 — 묘비 유실보다 안전 복구 우선.
    return emptySyncState();
  }
}

export async function saveSyncState(state: SyncState): Promise<void> {
  const run = async () => {
    const dir = await appDataDir();
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
    await writeTextFile(await statePath(), serializeSyncState(state));
  };
  // 이전 write 가 끝난 뒤 이어서 (순차 보장).
  writeChain = writeChain.then(run, run);
  return writeChain as Promise<void>;
}

// load → patch → save 헬퍼. 동시 호출 시에도 writeChain 으로 직렬화되지만,
// read-modify-write 원자성을 위해 최신 state 를 chain 안에서 다시 읽는다.
export async function updateSyncState(
  patch: (state: SyncState) => SyncState,
): Promise<SyncState> {
  const run = async (): Promise<SyncState> => {
    const current = await loadSyncState();
    const next = patch(current);
    const dir = await appDataDir();
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
    await writeTextFile(await statePath(), serializeSyncState(next));
    return next;
  };
  writeChain = writeChain.then(run, run);
  return writeChain as Promise<SyncState>;
}
