import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readDir, readTextFile, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import { getActiveVault, getActiveVaultId } from "../vault/registry";
import { findAdoptableOrphan, parseSyncState, serializeSyncState } from "./state";
import { emptySyncState, type SyncState } from "./types";

// 기기 로컬 sync 상태 파일 — appDataDir/gcal-sync-<vaultId>.json.
// appDataDir(vault 아님) 인 이유: syncToken 은 단일 커서라 같은 vault 를 여러 기기가
// 각자 advance 하면 서로 무효화(410 폭풍). 영구 매핑(eventId)은 task 줄 #gcal 태그에
// 있으니 이 파일엔 기기별 커서·스냅샷·묘비만 담는다.
// vault별 분리: 각 vault 가 독립 전용 캘린더·커서·스냅샷을 갖도록 파일명을 vault id 로
// 스코핑한다. OAuth 토큰만 공유(같은 Google 계정, app-created scope 라 캘린더 여러 개 OK).

// vault별 상태 파일명. legacy(단일 vault 시절, id 없음)는 기존 gcal-sync.json 유지 —
// 마이그레이션 불필요. #gcal 앵커는 이미 각 vault 의 inbox.md 에 있어 파일만 분리하면 격리.
export function stateFileName(vaultId: string | null): string {
  if (!vaultId) return "gcal-sync.json";
  const safe = vaultId.replace(/[^a-zA-Z0-9_-]/g, "_"); // 방어적 (uuid/slug 는 통과)
  return `gcal-sync-${safe}.json`;
}

async function statePath(): Promise<string> {
  return join(await appDataDir(), stateFileName(getActiveVaultId()));
}

// 현재 vault 의 path 를 state 에 stamp. vault id 가 remove+재등록으로 바뀌면 옛
// id-keyed 상태가 고아가 되는데, 이 path 앵커가 있어야 adoptOrphan 이 같은 vault 의
// 고아를 찾아 입양할 수 있다.
function stampVaultPath(state: SyncState): SyncState {
  const path = getActiveVault()?.path;
  return path ? { ...state, vaultPath: path } : state;
}

// 고아 상태 입양 — vault id 가 바뀌어 현재 id 의 상태파일이 없을 때, 같은 vaultPath 를
// stamp 한 옛 파일을 현재 id 파일명으로 rename 해 연결·snapshot·tombstone 을 살린다.
// vault id 당 1회 (deduped). best-effort — 실패해도 sync 흐름은 빈 상태로 진행한다.
const adoptionByVault = new Map<string, Promise<void>>();

function ensureAdopted(): Promise<void> {
  const id = getActiveVaultId();
  if (!id) return Promise.resolve();
  let p = adoptionByVault.get(id);
  if (!p) {
    p = adoptOrphan(id).catch(() => {});
    adoptionByVault.set(id, p);
  }
  return p;
}

async function adoptOrphan(vaultId: string): Promise<void> {
  const dir = await appDataDir();
  const targetName = stateFileName(vaultId);
  const targetPath = await join(dir, targetName);
  if (await exists(targetPath)) return; // 현재 id 파일 이미 있음 → 입양 불필요
  const vault = getActiveVault();
  if (!vault?.path) return;

  let entries;
  try {
    entries = await readDir(dir);
  } catch {
    return; // appDataDir 없음 = 첫 실행, 고아도 없음
  }
  const candidates: Array<{ name: string; vaultPath: string | null }> = [];
  for (const e of entries) {
    if (!e.isFile || !e.name) continue;
    if (!e.name.startsWith("gcal-sync-") || !e.name.endsWith(".json")) continue;
    try {
      const parsed = parseSyncState(await readTextFile(await join(dir, e.name)));
      candidates.push({ name: e.name, vaultPath: parsed.vaultPath ?? null });
    } catch {
      /* 못 읽는 후보는 skip */
    }
  }
  const orphan = findAdoptableOrphan(candidates, vault.path, targetName);
  if (!orphan) return;
  await rename(await join(dir, orphan), targetPath);
}

// 직렬화는 단일 프로세스·단일 기기라 mutex 1개로 write 직렬화 (read-modify-write
// 사이 race 차단). 같은 turn 에 load→save 가 겹쳐도 안전.
let writeChain: Promise<unknown> = Promise.resolve();

export async function loadSyncState(): Promise<SyncState> {
  try {
    await ensureAdopted(); // 옛 vault id 의 고아 상태를 현재 id 로 입양 (1회/vault)
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
    await ensureAdopted();
    const dir = await appDataDir();
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
    await writeTextFile(await statePath(), serializeSyncState(stampVaultPath(state)));
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
    await writeTextFile(await statePath(), serializeSyncState(stampVaultPath(next)));
    return next;
  };
  writeChain = writeChain.then(run, run);
  return writeChain as Promise<SyncState>;
}
