import { describe, expect, it } from "vitest";
import { createMemoryAdapter } from "../lib/vault/adapter";
import type { GhPRDetail, GhSearchResult } from "../lib/portfolio/gh";
import {
  ATTACHMENTS_DIR,
  PORTFOLIO_CATEGORIES,
  PORTFOLIO_DIR,
  attachmentsDirFor,
  buildBootstrapProjects,
  defaultUserFields,
  fileToPortfolioWork,
  parsePortfolioFrontmatter,
  portfolioWorkPath,
  portfolioWorkToRaw,
  projectSlugForRepo,
  prSlug,
  prSlugFromNameWithOwner,
  readPortfolioProjects,
  readPortfolioWork,
  readSyncState,
  scanPortfolio,
  splitPortfolioBody,
  syncPortfolio,
  upsertPortfolioWork,
  writePortfolioProjects,
  writeSyncState,
} from "./portfolio";

describe("portfolio schema (step 1 lock-in)", () => {
  it("prSlug 은 owner-repo-number 형태", () => {
    expect(prSlug("zzompang2", "goodsoob-work", 42)).toBe(
      "zzompang2-goodsoob-work-42",
    );
  });

  it("prSlugFromNameWithOwner 는 nameWithOwner 를 split", () => {
    expect(prSlugFromNameWithOwner("owner/repo", 123)).toBe("owner-repo-123");
  });

  it("path helpers 는 PORTFOLIO_DIR 기반", () => {
    const slug = "owner-repo-123";
    expect(portfolioWorkPath(slug)).toBe(`${PORTFOLIO_DIR}/${slug}.md`);
    expect(attachmentsDirFor(slug)).toBe(`${ATTACHMENTS_DIR}/${slug}`);
  });

  it("defaultUserFields 는 included=true / category=other / 빈 값", () => {
    const fields = defaultUserFields();
    expect(fields.included).toBe(true);
    expect(fields.category).toBe("other");
    expect(fields.project).toBe("");
    expect(fields.impact_summary).toBe("");
    expect(fields.screenshots).toEqual([]);
  });

  it("PORTFOLIO_CATEGORIES 는 5종", () => {
    expect(PORTFOLIO_CATEGORIES).toEqual([
      "ui_ux",
      "backend",
      "infra",
      "fix",
      "other",
    ]);
  });

  it("projectSlugForRepo — matching repo → slug, 미매칭 → 빈 문자열", () => {
    const projects = [
      { slug: "company", name: "X", sort: 1, repos: ["a/repo1", "b/repo2"] },
      { slug: "side", name: "Y", sort: 2, repos: ["zz/personal"] },
    ];
    expect(projectSlugForRepo(projects, "a/repo1")).toBe("company");
    expect(projectSlugForRepo(projects, "zz/personal")).toBe("side");
    expect(projectSlugForRepo(projects, "x/unknown")).toBe("");
    expect(projectSlugForRepo([], "a/b")).toBe("");
  });

  it("buildBootstrapProjects — unique nameWithOwner 마다 1 project", () => {
    const projects = buildBootstrapProjects([
      "a/repo1",
      "b/repo2",
      "a/repo1", // 중복
    ]);
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.slug).sort()).toEqual(["a-repo1", "b-repo2"]);
    expect(projects[0].repos).toEqual([projects[0].name]);
  });
});

const SAMPLE_CARD = `---
type: portfolio-work
github_owner: zzompang2
github_repo: goodsoob-work
github_pr_number: 42
github_pr_url: https://github.com/zzompang2/goodsoob-work/pull/42
github_state: merged
github_merged_at: 2026-05-15T14:23:00Z
github_title: "feat: redesign dashboard"
github_changed_files: 12
github_additions: 340
github_deletions: 87
project: prj-renewal
included: true
category: ui_ux
impact_summary: "차트 가독성 2배"
screenshots:
  - path: portfolio/_attachments/zzompang2-goodsoob-work-42/before-1.jpg
    label: before
    caption: "기존 차트"
  - path: portfolio/_attachments/zzompang2-goodsoob-work-42/after-1.jpg
    label: after
    caption: "리뉴얼 차트"
synced_at: 2026-05-18T01:30:00Z
---

## Description (from GitHub)

기존 차트 색 대비가 낮아 가독성 문제. 디자인 토큰 적용한 새 차트로 교체.

## Notes

평가 미팅 1순위. 본인 메모.
`;

describe("portfolio body parsing (step 2)", () => {
  it("parsePortfolioFrontmatter — 유효 frontmatter 매핑", () => {
    const fm = {
      type: "portfolio-work",
      github_owner: "owner",
      github_repo: "repo",
      github_pr_number: 7,
      github_pr_url: "https://github.com/owner/repo/pull/7",
      github_state: "merged",
      github_merged_at: "2026-05-15T14:23:00Z",
      github_title: "fix: x",
      github_changed_files: 3,
      github_additions: 10,
      github_deletions: 2,
      project: "prj-a",
      included: false,
      category: "fix",
      impact_summary: "test",
      screenshots: [
        { path: "a.jpg", label: "before", caption: "c" },
      ],
      synced_at: "2026-05-18T00:00:00Z",
    };
    const parsed = parsePortfolioFrontmatter(fm);
    expect(parsed).not.toBeNull();
    expect(parsed?.included).toBe(false);
    expect(parsed?.category).toBe("fix");
    expect(parsed?.screenshots).toHaveLength(1);
  });

  it("parsePortfolioFrontmatter — type 불일치 → null", () => {
    expect(parsePortfolioFrontmatter({ type: "meeting" })).toBeNull();
    expect(parsePortfolioFrontmatter({})).toBeNull();
  });

  it("parsePortfolioFrontmatter — included 누락 시 default true", () => {
    const fm = {
      type: "portfolio-work",
      github_owner: "o",
      github_repo: "r",
      github_pr_number: 1,
    };
    const parsed = parsePortfolioFrontmatter(fm);
    expect(parsed?.included).toBe(true);
  });

  it("parsePortfolioFrontmatter — legacy 카드 (pr_number=0 + url 빈) 허용", () => {
    const fm = {
      type: "portfolio-work",
      github_owner: "zzompang2",
      github_repo: "side-project",
      github_pr_number: 0,
      github_pr_url: "",
      github_state: "merged",
      github_title: "초기 셋업 + 핵심 기능",
      github_merged_at: "2025-12-01T00:00:00Z",
      github_changed_files: 8,
      github_additions: 320,
      github_deletions: 0,
      category: "backend",
    };
    const parsed = parsePortfolioFrontmatter(fm);
    expect(parsed).not.toBeNull();
    expect(parsed?.github_pr_number).toBe(0);
    expect(parsed?.github_pr_url).toBe("");
  });

  it("parsePortfolioFrontmatter — pr_number 음수 → null", () => {
    const fm = {
      type: "portfolio-work",
      github_owner: "o",
      github_repo: "r",
      github_pr_number: -1,
    };
    expect(parsePortfolioFrontmatter(fm)).toBeNull();
  });

  it("parsePortfolioFrontmatter — 잘못된 category → other fallback", () => {
    const fm = {
      type: "portfolio-work",
      github_owner: "o",
      github_repo: "r",
      github_pr_number: 1,
      category: "weird",
    };
    expect(parsePortfolioFrontmatter(fm)?.category).toBe("other");
  });

  it("splitPortfolioBody — Description + Notes 두 섹션 분리", () => {
    const body = `## Description (from GitHub)\n\nA body\n\n## Notes\n\nN body\n`;
    const { description, notes } = splitPortfolioBody(body);
    expect(description).toBe("A body");
    expect(notes).toBe("N body");
  });

  it("splitPortfolioBody — Notes 없으면 빈 문자열", () => {
    const body = `## Description (from GitHub)\n\nonly desc\n`;
    const { description, notes } = splitPortfolioBody(body);
    expect(description).toBe("only desc");
    expect(notes).toBe("");
  });

  it("fileToPortfolioWork — 전체 카드 파싱", () => {
    const work = fileToPortfolioWork(
      "portfolio/zzompang2-goodsoob-work-42.md",
      SAMPLE_CARD,
      1700000000000,
    );
    expect(work).not.toBeNull();
    expect(work?.prSlug).toBe("zzompang2-goodsoob-work-42");
    expect(work?.frontmatter.github_pr_number).toBe(42);
    expect(work?.frontmatter.project).toBe("prj-renewal");
    expect(work?.frontmatter.screenshots).toHaveLength(2);
    expect(work?.description).toContain("색 대비");
    expect(work?.notes).toContain("평가 미팅");
  });

  it("fileToPortfolioWork — type 불일치 → null", () => {
    const raw = `---\ntype: meeting\n---\n\n## Description (from GitHub)\nx\n`;
    expect(fileToPortfolioWork("portfolio/x.md", raw, 0)).toBeNull();
  });
});

describe("scanPortfolio (step 2)", () => {
  it("portfolio/ 만 list, projects.md / .synced.md skip, type 불일치 skip", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    await adapter.write("portfolio/zzompang2-goodsoob-work-42.md", SAMPLE_CARD);
    // 다른 owner-repo-number, merged_at 더 옛날 → 정렬 검증
    await adapter.write(
      "portfolio/owner-repo-2.md",
      SAMPLE_CARD.replace(
        "github_pr_number: 42",
        "github_pr_number: 2",
      )
        .replace(
          "github_merged_at: 2026-05-15T14:23:00Z",
          "github_merged_at: 2026-04-01T00:00:00Z",
        )
        .replace(/zzompang2-goodsoob-work-42/g, "owner-repo-2"),
    );
    // projects.md 는 type 도 다름 → 명시 skip
    await adapter.write(
      "portfolio/projects.md",
      `---\nprojects:\n  - slug: a\n    name: A\n    sort: 1\n---\n`,
    );
    // 손상 카드 (type 다름)
    await adapter.write(
      "portfolio/random.md",
      `---\ntype: meeting\n---\n\nblah\n`,
    );

    const results = await scanPortfolio(adapter);
    expect(results.map((r) => r.prSlug)).toEqual([
      // 더 최근 merged_at 가 위로
      "zzompang2-goodsoob-work-42",
      "owner-repo-2",
    ]);
    expect(results[0].frontmatter.github_pr_number).toBe(42);
  });

  it("portfolio/ 폴더 없음 → 빈 배열", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    const results = await scanPortfolio(adapter);
    expect(results).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: sync orchestration tests

let __mockPrId = 1000;
function mkSearchResult(opts: Partial<GhSearchResult> = {}): GhSearchResult {
  return {
    id: __mockPrId++,
    number: 42,
    title: "feat: test PR",
    body: "PR body content",
    url: "https://github.com/owner/repo/pull/42",
    state: "closed",
    closedAt: "2026-05-15T14:23:00Z",
    repository: { nameWithOwner: "owner/repo" },
    ...opts,
  };
}

function mkDetail(opts: Partial<GhPRDetail> = {}): GhPRDetail {
  return {
    mergedAt: "2026-05-15T14:23:00Z",
    changedFiles: 5,
    additions: 100,
    deletions: 20,
    body: "Detailed PR body",
    ...opts,
  };
}

describe("portfolioWorkToRaw (step 4)", () => {
  it("round-trip: write → read 가 동일한 frontmatter / body", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    const work = await upsertPortfolioWork(adapter, {
      search: mkSearchResult(),
      detail: mkDetail(),
    });
    const read = await readPortfolioWork(adapter, work.prSlug);
    expect(read).not.toBeNull();
    expect(read?.frontmatter.github_pr_number).toBe(42);
    expect(read?.frontmatter.included).toBe(true);
    expect(read?.frontmatter.category).toBe("other");
    expect(read?.description).toBe("Detailed PR body");
    expect(read?.notes).toBe("");
  });

  it("긴 body truncate (5000 char + marker)", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    const longBody = "x".repeat(6000);
    await upsertPortfolioWork(adapter, {
      search: mkSearchResult(),
      detail: mkDetail({ body: longBody }),
    });
    const read = await readPortfolioWork(adapter, "owner-repo-42");
    expect(read?.description.length).toBeLessThan(longBody.length);
    expect(read?.description).toContain("...(truncated)");
  });

  it("신규 카드: PR body 의 H2 7섹션 양식 → impact_summary + category 자동 채움", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    const prBody = `## 한 줄 임팩트
차트 가독성 개선

## 문제 (Why)
기존 차트 안 보임

## 카테고리
ui_ux
`;
    await upsertPortfolioWork(adapter, {
      search: mkSearchResult(),
      detail: mkDetail({ body: prBody }),
    });
    const read = await readPortfolioWork(adapter, "owner-repo-42");
    expect(read?.frontmatter.impact_summary).toBe("차트 가독성 개선");
    expect(read?.frontmatter.category).toBe("ui_ux");
  });

  it("기존 카드: PR body 자동 파싱 결과로 본인 수정값 덮어쓰지 않음 (3A)", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    // 1차: 신규 (H2 양식 X) → default
    await upsertPortfolioWork(adapter, {
      search: mkSearchResult(),
      detail: mkDetail({ body: "no H2 sections here" }),
    });
    // 본인이 수정
    const existing = await readPortfolioWork(adapter, "owner-repo-42");
    await adapter.write(
      portfolioWorkPath("owner-repo-42"),
      portfolioWorkToRaw({
        ...existing!,
        frontmatter: {
          ...existing!.frontmatter,
          impact_summary: "본인이 직접 적은 임팩트",
          category: "backend",
        },
      }),
    );
    // 2차 sync: PR body 가 다른 H2 양식 들고 와도 본인 수정 보존
    const reloaded = await readPortfolioWork(adapter, "owner-repo-42");
    const prBody = `## 한 줄 임팩트
sync 가 들고 온 다른 임팩트

## 카테고리
ui_ux
`;
    await upsertPortfolioWork(adapter, {
      search: mkSearchResult(),
      detail: mkDetail({ body: prBody }),
      existing: reloaded!,
    });
    const after = await readPortfolioWork(adapter, "owner-repo-42");
    expect(after?.frontmatter.impact_summary).toBe("본인이 직접 적은 임팩트");
    expect(after?.frontmatter.category).toBe("backend");
  });
});

describe("syncState (step 4)", () => {
  it("미존재 시 last_sync null", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    const state = await readSyncState(adapter);
    expect(state.last_sync).toBeNull();
    expect(state.last_sync_pr_count).toBe(0);
  });

  it("write 후 read 가 동일 값", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    await writeSyncState(adapter, {
      last_sync: "2026-05-18T01:30:00Z",
      last_sync_pr_count: 23,
    });
    const state = await readSyncState(adapter);
    expect(state.last_sync).toBe("2026-05-18T01:30:00Z");
    expect(state.last_sync_pr_count).toBe(23);
  });
});

describe("syncPortfolio — 본인 수정 필드 보존 (v2.2 3A, design test #8)", () => {
  it("신규 PR 추가 + 기존 카드 frontmatter 보존", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");

    // 기존 카드: 사용자가 included=false / project=prj-x / category=ui_ux 로 토글
    await upsertPortfolioWork(adapter, {
      search: mkSearchResult({ number: 1, url: "https://github.com/owner/repo/pull/1" }),
      detail: mkDetail(),
    });
    const existing = await readPortfolioWork(adapter, "owner-repo-1");
    expect(existing).not.toBeNull();
    // 본인이 frontmatter patch (UI 가 한 것 시뮬레이션)
    await adapter.write(
      portfolioWorkPath("owner-repo-1"),
      portfolioWorkToRaw({
        ...existing!,
        frontmatter: {
          ...existing!.frontmatter,
          included: false,
          project: "prj-x",
          category: "ui_ux",
          impact_summary: "본인이 작성한 임팩트",
        },
        notes: "본인 메모",
      }),
    );

    // sync 가 다시 같은 PR + 신규 PR 들고 옴
    const searchFn = async () => [
      mkSearchResult({ number: 1, url: "https://github.com/owner/repo/pull/1" }),
      mkSearchResult({ number: 2, url: "https://github.com/owner/repo/pull/2" }),
    ];
    const enrichFn = async () => mkDetail({ body: "fresh body from sync" });

    const result = await syncPortfolio(adapter, { searchFn, enrichFn });
    expect(result.total).toBe(2);
    expect(result.added).toBe(1);
    expect(result.preserved).toBe(1);

    const preserved = await readPortfolioWork(adapter, "owner-repo-1");
    expect(preserved?.frontmatter.included).toBe(false);
    expect(preserved?.frontmatter.project).toBe("prj-x");
    expect(preserved?.frontmatter.category).toBe("ui_ux");
    expect(preserved?.frontmatter.impact_summary).toBe("본인이 작성한 임팩트");
    expect(preserved?.notes).toBe("본인 메모");
    // github_* 는 refresh
    expect(preserved?.description).toBe("fresh body from sync");

    const fresh = await readPortfolioWork(adapter, "owner-repo-2");
    expect(fresh?.frontmatter.included).toBe(true); // default
    // bootstrap 으로 "owner-repo" project 가 만들어졌고 owner/repo nameWithOwner
    // 가 그 project 의 repos 에 들어가 자동 분류.
    expect(fresh?.frontmatter.project).toBe("owner-repo");

    // .synced.md 갱신
    const state = await readSyncState(adapter);
    expect(state.last_sync).not.toBeNull();
    expect(state.last_sync_pr_count).toBe(2);
  });

  it("onProgress 콜백 + state === 'open' 은 skip", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    const progress: Array<[number, number]> = [];
    const searchFn = async () => [
      mkSearchResult({ number: 1, state: "closed" }),
      mkSearchResult({ number: 2, state: "open" }), // skipped
      mkSearchResult({ number: 3, state: "closed" }),
    ];
    const enrichFn = async () => mkDetail();
    const result = await syncPortfolio(adapter, {
      searchFn,
      enrichFn,
      onProgress: (c, t) => progress.push([c, t]),
    });
    expect(result.total).toBe(2);
    expect(progress.at(-1)).toEqual([2, 2]);
  });

  it("projects.md 비었으면 bootstrap + 신규 카드 자동 분류", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    const searchFn = async () => [
      mkSearchResult({
        number: 1,
        url: "https://github.com/a/repo1/pull/1",
        repository: { nameWithOwner: "a/repo1" },
      }),
      mkSearchResult({
        number: 2,
        url: "https://github.com/b/repo2/pull/2",
        repository: { nameWithOwner: "b/repo2" },
      }),
    ];
    const enrichFn = async () => mkDetail();
    await syncPortfolio(adapter, { searchFn, enrichFn });

    // projects.md 자동 생성
    const projects = await readPortfolioProjects(adapter);
    expect(projects).toHaveLength(2);
    expect(projects[0].slug).toBe("a-repo1");
    expect(projects[0].repos).toEqual(["a/repo1"]);
    expect(projects[1].slug).toBe("b-repo2");

    // 카드 frontmatter 의 project 자동 부여
    const card1 = await readPortfolioWork(adapter, "a-repo1-1");
    expect(card1?.frontmatter.project).toBe("a-repo1");
    const card2 = await readPortfolioWork(adapter, "b-repo2-2");
    expect(card2?.frontmatter.project).toBe("b-repo2");
  });

  it("projects.md 이미 있으면 bootstrap 안 함 + 매칭되는 repo 만 자동 분류", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    // 본인이 미리 정의: "company" project 가 a/repo1 + b/repo2 모두 묶음
    await writePortfolioProjects(adapter, [
      {
        slug: "company",
        name: "회사 작업",
        sort: 1,
        repos: ["a/repo1", "b/repo2"],
      },
    ]);
    const searchFn = async () => [
      mkSearchResult({
        number: 1,
        url: "https://github.com/a/repo1/pull/1",
        repository: { nameWithOwner: "a/repo1" },
      }),
      mkSearchResult({
        number: 2,
        url: "https://github.com/b/repo2/pull/2",
        repository: { nameWithOwner: "b/repo2" },
      }),
      mkSearchResult({
        number: 3,
        url: "https://github.com/c/unmapped/pull/3",
        repository: { nameWithOwner: "c/unmapped" },
      }),
    ];
    const enrichFn = async () => mkDetail();
    await syncPortfolio(adapter, { searchFn, enrichFn });

    // bootstrap 안 함 (이미 있어서)
    const projects = await readPortfolioProjects(adapter);
    expect(projects).toHaveLength(1);
    expect(projects[0].slug).toBe("company");

    // 매칭된 repo 카드는 자동 분류
    const card1 = await readPortfolioWork(adapter, "a-repo1-1");
    expect(card1?.frontmatter.project).toBe("company");
    // 미매칭 repo 는 분류안됨
    const card3 = await readPortfolioWork(adapter, "c-unmapped-3");
    expect(card3?.frontmatter.project).toBe("");
  });

  it("re-sync 시 분류안됨 (project=빈) 기존 카드 → 자동 매핑이 채움", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    // 첫 sync 시점: projects.md 없고 단순 카드만 생성됨 (project=빈)
    const searchFn = async () => [
      mkSearchResult({
        number: 1,
        url: "https://github.com/a/repo1/pull/1",
        repository: { nameWithOwner: "a/repo1" },
      }),
    ];
    const enrichFn = async () => mkDetail();
    // 첫 sync (projects.md 자동 부트스트랩됨)
    await syncPortfolio(adapter, { searchFn, enrichFn });
    const first = await readPortfolioWork(adapter, "a-repo1-1");
    expect(first?.frontmatter.project).toBe("a-repo1"); // bootstrap 매핑 결과

    // 본인이 옵시디안에서 project 를 빈 값으로 reset (e.g. "분류 다시 결정 중")
    await adapter.write(
      portfolioWorkPath("a-repo1-1"),
      portfolioWorkToRaw({
        ...first!,
        frontmatter: { ...first!.frontmatter, project: "" },
      }),
    );

    // re-sync → 분류안됨 카드는 자동 매핑이 다시 채움
    await syncPortfolio(adapter, { searchFn, enrichFn });
    const after = await readPortfolioWork(adapter, "a-repo1-1");
    expect(after?.frontmatter.project).toBe("a-repo1");
  });

  it("re-sync 시 기존 카드의 본인 수정 project 는 보존 (매핑이 덮어쓰지 않음)", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    // 첫 sync: 자동 분류로 "a-repo1" project 부여
    const searchFn = async () => [
      mkSearchResult({
        number: 1,
        url: "https://github.com/a/repo1/pull/1",
        repository: { nameWithOwner: "a/repo1" },
      }),
    ];
    const enrichFn = async () => mkDetail();
    await syncPortfolio(adapter, { searchFn, enrichFn });

    // 본인이 다른 project 로 재분류
    const card = await readPortfolioWork(adapter, "a-repo1-1");
    await adapter.write(
      portfolioWorkPath("a-repo1-1"),
      portfolioWorkToRaw({
        ...card!,
        frontmatter: { ...card!.frontmatter, project: "manual-override" },
      }),
    );

    // re-sync — 본인 수정 보존
    await syncPortfolio(adapter, { searchFn, enrichFn });
    const after = await readPortfolioWork(adapter, "a-repo1-1");
    expect(after?.frontmatter.project).toBe("manual-override");
  });

  it("github_pr_id 매칭 → owner/repo rename 자동 감지 + 파일 이동 + projects.md repos 갱신", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    // 첫 sync: old-owner/repo 로 PR 1개. 명시적 PR id 사용 (rename 후에도 같음).
    const PR_ID = 999_001;
    const firstSearch = async () => [
      {
        id: PR_ID,
        number: 5,
        title: "feat: x",
        body: "b",
        url: "https://github.com/old-owner/repo/pull/5",
        state: "closed",
        closedAt: "2026-05-15T14:23:00Z",
        repository: { nameWithOwner: "old-owner/repo" },
      },
    ];
    await syncPortfolio(adapter, {
      searchFn: firstSearch,
      enrichFn: async () => mkDetail(),
    });

    // 첫 sync 결과 확인
    const first = await readPortfolioWork(adapter, "old-owner-repo-5");
    expect(first?.frontmatter.github_pr_id).toBe(PR_ID);
    const firstProjects = await readPortfolioProjects(adapter);
    expect(firstProjects[0].repos).toEqual(["old-owner/repo"]);

    // 본인이 그 카드에 명시 분류 + impact_summary 작성 (사용자 수정 보존 검증)
    await adapter.write(
      portfolioWorkPath("old-owner-repo-5"),
      portfolioWorkToRaw({
        ...first!,
        frontmatter: {
          ...first!.frontmatter,
          impact_summary: "본인이 작성한 임팩트",
          project: "old-owner-repo", // bootstrap 으로 부여된 그대로
        },
      }),
    );

    // 시뮬: GitHub 에서 owner rename → 다음 sync 결과의 nameWithOwner 가 새로움.
    // id 는 동일.
    const secondSearch = async () => [
      {
        id: PR_ID,
        number: 5,
        title: "feat: x",
        body: "b",
        url: "https://github.com/new-owner/repo/pull/5",
        state: "closed",
        closedAt: "2026-05-15T14:23:00Z",
        repository: { nameWithOwner: "new-owner/repo" },
      },
    ];
    await syncPortfolio(adapter, {
      searchFn: secondSearch,
      enrichFn: async () => mkDetail(),
    });

    // 옛 slug 카드는 없어짐
    const oldStillExists = await readPortfolioWork(adapter, "old-owner-repo-5");
    expect(oldStillExists).toBeNull();
    // 새 slug 카드로 이동, frontmatter 갱신, 본인 수정 보존
    const renamed = await readPortfolioWork(adapter, "new-owner-repo-5");
    expect(renamed).not.toBeNull();
    expect(renamed?.frontmatter.github_pr_id).toBe(PR_ID);
    expect(renamed?.frontmatter.github_owner).toBe("new-owner");
    expect(renamed?.frontmatter.github_repo).toBe("repo");
    expect(renamed?.frontmatter.impact_summary).toBe("본인이 작성한 임팩트");
    // projects.md 의 repos 도 자동 갱신
    const afterProjects = await readPortfolioProjects(adapter);
    expect(afterProjects[0].repos).toEqual(["new-owner/repo"]);
  });

  it("AbortSignal — 중단 시 AbortError throw + 추가 enrich 안 호출", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    const controller = new AbortController();
    const TOTAL = 20; // concurrency 5 보다 훨씬 큼
    const searchFn = async () =>
      Array.from({ length: TOTAL }, (_, i) =>
        mkSearchResult({
          number: i + 1,
          url: `https://github.com/owner/repo/pull/${i + 1}`,
        }),
      );
    let enrichCalls = 0;
    const enrichFn = async () => {
      enrichCalls++;
      controller.abort(); // 첫 enrich 시작 즉시 cancel
      return mkDetail();
    };
    await expect(
      syncPortfolio(adapter, {
        searchFn,
        enrichFn,
        signal: controller.signal,
      }),
    ).rejects.toThrow(/cancelled/);
    // 5 worker 동시 시작 → 동시 in-flight 만큼만 enrich 호출되고 (≤ 5),
    // 그 다음 다음 PR 들은 abort 검출로 enrich 안 들어감.
    expect(enrichCalls).toBeLessThan(TOTAL);
    expect(enrichCalls).toBeLessThanOrEqual(5);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // V0.7.x — PR body 이미지 자동 import

  it("PR body 이미지 자동 import: existing.screenshots 비어있으면 다운로드 + frontmatter", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    const searchFn = async () => [
      mkSearchResult({
        number: 1,
        url: "https://github.com/owner/repo/pull/1",
      }),
    ];
    const enrichFn = async () =>
      mkDetail({
        body: `## Before
![before](https://example.com/before.png)
## After
![after](https://example.com/after.jpg)
`,
      });
    const downloaded: Array<[string, string]> = [];
    const downloadFn = async (relPath: string, url: string) => {
      downloaded.push([relPath, url]);
    };
    await syncPortfolio(adapter, { searchFn, enrichFn, downloadFn });

    expect(downloaded).toEqual([
      ["portfolio/_attachments/owner-repo-1/before-1.png", "https://example.com/before.png"],
      ["portfolio/_attachments/owner-repo-1/after-1.jpg", "https://example.com/after.jpg"],
    ]);
    const card = await readPortfolioWork(adapter, "owner-repo-1");
    expect(card?.frontmatter.screenshots).toEqual([
      {
        path: "portfolio/_attachments/owner-repo-1/before-1.png",
        label: "before",
        caption: "",
      },
      {
        path: "portfolio/_attachments/owner-repo-1/after-1.jpg",
        label: "after",
        caption: "",
      },
    ]);
  });

  it("본인이 dropzone 박은 screenshots 보존 — sync 가 덮어쓰지 않음", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    // 1차 sync 로 카드 생성
    const searchFn = async () => [mkSearchResult({ number: 1 })];
    const enrichFn = async () => mkDetail({ body: "" });
    await syncPortfolio(adapter, { searchFn, enrichFn });

    // 본인이 옵시디안/UI 에서 직접 dropzone 박았다고 가정
    const card = await readPortfolioWork(adapter, "owner-repo-1");
    await adapter.write(
      portfolioWorkPath("owner-repo-1"),
      portfolioWorkToRaw({
        ...card!,
        frontmatter: {
          ...card!.frontmatter,
          screenshots: [
            {
              path: "portfolio/_attachments/owner-repo-1/manual.png",
              label: "before",
              caption: "내가 박은 것",
            },
          ],
        },
      }),
    );

    // 2차 sync — PR body 에 이미지가 있어도 import 안 함 (보존)
    const enrich2 = async () =>
      mkDetail({
        body: `## Before\n![before](https://example.com/sync-tries.png)`,
      });
    const downloaded: string[] = [];
    const downloadFn = async (relPath: string) => {
      downloaded.push(relPath);
    };
    await syncPortfolio(adapter, {
      searchFn,
      enrichFn: enrich2,
      downloadFn,
    });
    expect(downloaded).toEqual([]); // 다운로드 안 일어남
    const preserved = await readPortfolioWork(adapter, "owner-repo-1");
    expect(preserved?.frontmatter.screenshots).toHaveLength(1);
    expect(preserved?.frontmatter.screenshots[0].caption).toBe("내가 박은 것");
  });

  it("download 실패해도 sync 는 전체 안 죽음 (best effort)", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    const searchFn = async () => [mkSearchResult({ number: 1 })];
    const enrichFn = async () =>
      mkDetail({
        body: `## Before\n![before](https://broken/url.png)\n![after](https://broken/url2.png)`,
      });
    const downloadFn = async () => {
      throw new Error("network down");
    };
    const result = await syncPortfolio(adapter, {
      searchFn,
      enrichFn,
      downloadFn,
    });
    expect(result.added).toBe(1);
    const card = await readPortfolioWork(adapter, "owner-repo-1");
    expect(card?.frontmatter.screenshots).toEqual([]);
  });

  it("이미 vault 에 같은 path 이미지 있으면 redundant download skip", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    // 같은 path 가 이미 vault 에 있음 (이전 sync 또는 본인이 직접 박은 binary)
    await adapter.write(
      "portfolio/_attachments/owner-repo-1/before-1.png",
      "stub",
    );
    const searchFn = async () => [mkSearchResult({ number: 1 })];
    const enrichFn = async () =>
      mkDetail({
        body: `## Before\n![before](https://example.com/x.png)`,
      });
    const downloaded: string[] = [];
    const downloadFn = async (relPath: string) => {
      downloaded.push(relPath);
    };
    await syncPortfolio(adapter, { searchFn, enrichFn, downloadFn });
    expect(downloaded).toEqual([]); // skip
    // frontmatter 엔 path 가 박혀야 함 (이미 파일은 있으니)
    const card = await readPortfolioWork(adapter, "owner-repo-1");
    expect(card?.frontmatter.screenshots[0].path).toBe(
      "portfolio/_attachments/owner-repo-1/before-1.png",
    );
  });
});
