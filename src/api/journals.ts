import type { VaultAdapter } from "../lib/vault/adapter";
import {
  fileToJournal,
  journalPath,
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

export async function getJournalByDate(
  adapter: VaultAdapter,
  date: string,
): Promise<Journal | null> {
  const path = journalPath(date);
  if (!(await adapter.exists(path))) return null;
  const raw = await adapter.read(path);
  const meta = await adapter.readMeta(path);
  return fileToJournal(path, raw, meta.mtime);
}

export async function upsertJournal(
  adapter: VaultAdapter,
  date: string,
  content: string,
): Promise<Journal> {
  const path = journalPath(date);
  // 일기는 단순 형식: frontmatter (date) + 본문
  const raw = `---\ndate: ${date}\n---\n\n${content}\n`;
  const meta = await adapter.write(path, raw);
  return {
    id: path,
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
