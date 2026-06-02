import type { VaultAdapter } from "../lib/vault/adapter";
import {
  fileToJournal,
  journalPath,
  journalToRaw,
  scanJournals,
  trashFile,
  type Journal,
} from "../lib/vault/scan";

export type { Journal };

export async function listJournals(adapter: VaultAdapter): Promise<Journal[]> {
  const metas = await scanJournals(adapter);
  const journals: Journal[] = [];
  for (const m of metas) {
    try {
      const raw = await adapter.read(m.id);
      journals.push(fileToJournal(m.id, raw, m.mtime));
    } catch {
      // skip
    }
  }
  return journals;
}

export async function upsertJournal(
  adapter: VaultAdapter,
  date: string,
  content: string,
): Promise<Journal> {
  const path = journalPath(date);
  let uid: string;
  let prevMtime: number | undefined;
  if (await adapter.exists(path)) {
    const prevRaw = await adapter.read(path);
    const prevMeta = await adapter.readMeta(path);
    const prev = fileToJournal(path, prevRaw, prevMeta.mtime);
    uid = prev.uid || crypto.randomUUID();
    prevMtime = prevMeta.mtime;
  } else {
    uid = crypto.randomUUID();
  }
  const raw = journalToRaw({
    id: path,
    uid,
    date,
    mtime: 0,
    content,
  });
  const meta = await adapter.write(path, raw, prevMtime);
  return {
    id: path,
    uid,
    date,
    mtime: meta.mtime,
    content,
  };
}

export async function deleteJournal(
  adapter: VaultAdapter,
  id: string,
): Promise<void> {
  await trashFile(adapter, id);
}
