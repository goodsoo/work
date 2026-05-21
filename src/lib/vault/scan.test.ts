import { describe, it, expect, vi } from "vitest";
import {
  slugify,
  transcriptPath,
  summaryPath,
  isMeetingSidecar,
  meetingMainPath,
  scanMeetings,
  dedupeUids,
  type MeetingMeta,
} from "./scan";
import { createMemoryAdapter } from "./adapter";
import { parseVaultFile } from "./parser";

describe("slugify", () => {
  it("공백 보존 (옵시디안 파일명 호환)", () => {
    expect(slugify("팀 주간 회의")).toBe("팀 주간 회의");
  });

  it("파일시스템 금지 문자 sanitize", () => {
    expect(slugify("a/b\\c:d*e?f\"g<h>i|j")).toBe("a-b-c-d-e-f-g-h-i-j");
  });

  it("옵시디안 link syntax 충돌 문자 sanitize", () => {
    expect(slugify("note#tag[[link]]^anchor")).toBe("note-tag--link---anchor");
  });

  it("앞뒤 dot/공백 제거 (Windows trim + macOS dotfile)", () => {
    expect(slugify("  .hidden  ")).toBe("hidden");
  });

  it("빈 결과는 untitled fallback", () => {
    expect(slugify("")).toBe("untitled");
    expect(slugify("   ")).toBe("untitled"); // 앞뒤 공백 trim 으로 빈 → fallback.
    // "///" 는 위험문자 치환 → "---" (dash-only). title input 차단으로 사용자 입력에선 안 옴.
    expect(slugify("///")).toBe("---");
  });

  it("200자 cap", () => {
    const long = "가".repeat(250);
    expect(slugify(long).length).toBeLessThanOrEqual(200);
  });

  it("정상 한글/숫자/dot/dash/공백 보존", () => {
    expect(slugify("v1.2-feature 회의록")).toBe("v1.2-feature 회의록");
  });
});

describe("sidecar path helpers", () => {
  it("transcriptPath / summaryPath", () => {
    const main = "meetings/2026-05-18-test.md";
    expect(transcriptPath(main)).toBe("meetings/2026-05-18-test.transcript.md");
    expect(summaryPath(main)).toBe("meetings/2026-05-18-test.summary.md");
  });

  it("isMeetingSidecar 인식", () => {
    expect(isMeetingSidecar("meetings/x.md")).toBe(false);
    expect(isMeetingSidecar("meetings/x.transcript.md")).toBe(true);
    expect(isMeetingSidecar("meetings/x.summary.md")).toBe(true);
  });

  it("meetingMainPath — sidecar → 메인 path 역변환", () => {
    expect(meetingMainPath("meetings/x.transcript.md")).toBe("meetings/x.md");
    expect(meetingMainPath("meetings/x.summary.md")).toBe("meetings/x.md");
    expect(meetingMainPath("meetings/x.md")).toBe("meetings/x.md"); // 이미 메인
  });
});

describe("scanMeetings — uid dedup", () => {
  // 외부 복사 / 옵시디안 모바일 merge / 백업 복원 시 두 파일이 같은 uuid 가질 수
  // 있음. 그대로 두면 React key 충돌 + 같은 uid hash 라우팅 시 어느 파일 잡힐지
  // 결정 불가. mtime 늦은 게 keeper, 나머지 새 uid + rewrite 가 정상 동작.
  it("같은 uid 두 파일 → mtime 늦은 entry 가 keeper, 후순위는 새 uid + rewrite", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    // a 먼저 write → b 이후 write (mtime 더 큼). 같은 uid 박힘.
    await adapter.write("meetings/a.md", "---\nid: shared-uid\n---\n\n# A\n");
    await adapter.write("meetings/b.md", "---\nid: shared-uid\n---\n\n# B\n");

    const list = await scanMeetings(adapter);

    expect(list).toHaveLength(2);
    const a = list.find((m) => m.title === "a")!;
    const b = list.find((m) => m.title === "b")!;
    expect(b.uid).toBe("shared-uid"); // 늦은 게 keeper
    expect(a.uid).not.toBe("shared-uid"); // 후순위는 새 uid
    expect(a.uid).not.toBe("");

    // 디스크에도 새 uid 박혀야 — rewrite 확인
    const aRaw = await adapter.read("meetings/a.md");
    expect(parseVaultFile(aRaw).frontmatter.id).toBe(a.uid);
    const bRaw = await adapter.read("meetings/b.md");
    expect(parseVaultFile(bRaw).frontmatter.id).toBe("shared-uid");
  });

  it("unique uid 들은 변경 0 (idempotent)", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    await adapter.write("meetings/a.md", "---\nid: uid-a\n---\n\n# A\n");
    await adapter.write("meetings/b.md", "---\nid: uid-b\n---\n\n# B\n");

    const first = await scanMeetings(adapter);
    const aRawBefore = await adapter.read("meetings/a.md");
    const bRawBefore = await adapter.read("meetings/b.md");

    const second = await scanMeetings(adapter);

    expect(first.map((m) => m.uid).sort()).toEqual(["uid-a", "uid-b"]);
    expect(second.map((m) => m.uid).sort()).toEqual(["uid-a", "uid-b"]);
    // 디스크 내용 그대로 — rewrite 없었음
    expect(await adapter.read("meetings/a.md")).toBe(aRawBefore);
    expect(await adapter.read("meetings/b.md")).toBe(bRawBefore);
  });

  it("3-way 충돌 — 가장 최근 1개만 keeper, 나머지 둘 다 새 uid", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    await adapter.write("meetings/a.md", "---\nid: shared\n---\n\n# A\n");
    await adapter.write("meetings/b.md", "---\nid: shared\n---\n\n# B\n");
    await adapter.write("meetings/c.md", "---\nid: shared\n---\n\n# C\n");

    const list = await scanMeetings(adapter);
    const byTitle = Object.fromEntries(list.map((m) => [m.title, m.uid]));

    expect(byTitle.c).toBe("shared"); // 가장 늦은 mtime
    expect(byTitle.a).not.toBe("shared");
    expect(byTitle.b).not.toBe("shared");
    expect(byTitle.a).not.toBe(byTitle.b); // 둘 다 서로 다른 새 uid
  });

  it("같은 mtime 시 path 알파벳 작은 entry 가 keeper (tiebreaker)", async () => {
    // memory adapter 가 매 write 마다 tick 증가시키므로 mtime 동률 만들기 위해
    // dedupeUids 를 직접 호출. 실제 race 는 외부 복사 / 백업 복원 시 mtime 동률 가능.
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    await adapter.write("meetings/b.md", "---\nid: shared\n---\n\n# B\n");
    await adapter.write("meetings/a.md", "---\nid: shared\n---\n\n# A\n");

    const sameMtime = 1_700_000_000_000;
    const results: MeetingMeta[] = [
      makeMeta("meetings/a.md", "shared", sameMtime),
      makeMeta("meetings/b.md", "shared", sameMtime),
    ];
    await dedupeUids(adapter, results);

    // path 알파벳 작은 a 가 keeper
    expect(results.find((m) => m.id === "meetings/a.md")!.uid).toBe("shared");
    expect(results.find((m) => m.id === "meetings/b.md")!.uid).not.toBe("shared");
  });

  it("write 실패 시 메모리 uid 만 분리해서 React key 충돌 차단", async () => {
    const adapter = createMemoryAdapter();
    adapter.setRoot("/vault");
    await adapter.write("meetings/a.md", "---\nid: shared\n---\n\n# A\n");
    await adapter.write("meetings/b.md", "---\nid: shared\n---\n\n# B\n");

    // read-only 시뮬레이션 — write throw
    const writeSpy = vi
      .spyOn(adapter, "write")
      .mockRejectedValue(new Error("read-only vault"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const results: MeetingMeta[] = [
      makeMeta("meetings/a.md", "shared", 1000),
      makeMeta("meetings/b.md", "shared", 2000), // b 가 keeper
    ];
    await dedupeUids(adapter, results);

    const a = results.find((m) => m.id === "meetings/a.md")!;
    const b = results.find((m) => m.id === "meetings/b.md")!;
    expect(b.uid).toBe("shared");
    expect(a.uid).not.toBe("shared"); // 메모리 uid 만 분리
    expect(a.uid).not.toBe("");

    writeSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

function makeMeta(id: string, uid: string, mtime: number): MeetingMeta {
  const iso = new Date(mtime).toISOString();
  return {
    id,
    uid,
    title: id.replace(/^meetings\//, "").replace(/\.md$/, ""),
    date: null,
    time: null,
    attendees: [],
    tags: [],
    mtime,
    created_at: iso,
    updated_at: iso,
    deleted_at: null,
  };
}
