import type { VaultAdapter } from "../lib/vault/adapter";
import { isSyncNoiseFile, TASKS_DIR, trashFile } from "../lib/vault/scan";

// 할 일 프로젝트 = `tasks/` 폴더의 md 파일 하나. `tasks/inbox.md` = 미분류.
// 프로젝트 추가 = 새 파일, 삭제 = 파일 휴지통. (노트 폴더 모델과 같은 정신.)

export const INBOX_FILE = `${TASKS_DIR}/inbox.md`;

export interface TaskProject {
  file: string; // `tasks/{name}.md`
  name: string; // 표시 이름 (inbox → "미분류")
  isInbox: boolean;
}

// 파일 path → 표시 이름. `tasks/inbox.md` = "미분류", 그 외는 파일명(확장자 제거).
export function projectLabel(file: string): string {
  const base = file.replace(/^.*\//, "").replace(/\.md$/, "");
  return base === "inbox" ? "미분류" : base;
}

// 표시 이름 → 파일 path. "미분류"/"inbox" → inbox.md.
export function projectFile(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "" || trimmed === "미분류" || trimmed === "inbox") {
    return INBOX_FILE;
  }
  return `${TASKS_DIR}/${trimmed}.md`;
}

export async function listProjects(
  adapter: VaultAdapter,
): Promise<TaskProject[]> {
  let files: string[];
  try {
    files = await adapter.list(TASKS_DIR);
  } catch {
    files = [];
  }
  const projects: TaskProject[] = files
    .filter((p) => p.endsWith(".md") && !isSyncNoiseFile(p))
    .map((file) => ({
      file,
      name: projectLabel(file),
      isInbox: file === INBOX_FILE,
    }));
  // inbox(미분류) 항상 맨 위, 나머지는 이름순.
  projects.sort((a, b) => {
    if (a.isInbox !== b.isInbox) return a.isInbox ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });
  return projects;
}

// 새 프로젝트 파일 생성. 이미 있으면 그대로 반환(멱등). 빈 헤더만 박는다.
export async function createProject(
  adapter: VaultAdapter,
  name: string,
): Promise<TaskProject> {
  const file = projectFile(name);
  if (!(await adapter.exists(file))) {
    await adapter.write(file, `# ${projectLabel(file)}\n`);
  }
  return { file, name: projectLabel(file), isInbox: file === INBOX_FILE };
}

// 프로젝트 파일 휴지통行. inbox(미분류)는 삭제 불가 — 기본 집이라 보존.
export async function deleteProject(
  adapter: VaultAdapter,
  file: string,
): Promise<void> {
  if (file === INBOX_FILE) {
    throw new Error("미분류는 삭제할 수 없습니다.");
  }
  await trashFile(adapter, file);
}
