import { describe, it, expect } from "vitest";
import { buildMeetingsTree, flattenFolderPaths } from "./meetingsTree";
import type { Meeting } from "../api/meetings";

function fakeMeeting(id: string, title: string, mtime = 1000): Meeting {
  return {
    id,
    uid: `uid-${title}`,
    title,
    date: null,
    time: null,
    attendees: [],
    tags: [],
    mtime,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    content: "",
    transcript: "",
    discussion_items: [],
    decisions: [],
    action_items: [],
  };
}

describe("buildMeetingsTree", () => {
  it("root 메모는 rootMeetings 로, 폴더 안 메모는 트리로", () => {
    const tree = buildMeetingsTree([
      fakeMeeting("meetings/inbox.md", "inbox"),
      fakeMeeting("meetings/work/q1.md", "q1"),
      fakeMeeting("meetings/work/q2.md", "q2"),
      fakeMeeting("meetings/personal/run.md", "run"),
    ]);
    expect(tree.rootMeetings.map((m) => m.title)).toEqual(["inbox"]);
    expect(tree.folders.map((f) => f.path)).toEqual(["personal", "work"]); // alphabetic
    const work = tree.folders.find((f) => f.path === "work")!;
    expect(work.meetings.map((m) => m.title).sort()).toEqual(["q1", "q2"]);
  });

  it("중첩 폴더 (`work/2026`) 도 트리로", () => {
    const tree = buildMeetingsTree([
      fakeMeeting("meetings/work/2026/jan.md", "jan"),
      fakeMeeting("meetings/work/2026/feb.md", "feb"),
      fakeMeeting("meetings/work/strategy.md", "strategy"),
    ]);
    const work = tree.folders[0];
    expect(work.path).toBe("work");
    expect(work.meetings.map((m) => m.title)).toEqual(["strategy"]);
    expect(work.children[0].path).toBe("work/2026");
    expect(
      work.children[0].meetings.map((m) => m.title).sort(),
    ).toEqual(["feb", "jan"]);
  });

  it("sortMeetings comparator 적용 — 같은 폴더 안에서만", () => {
    const tree = buildMeetingsTree(
      [
        fakeMeeting("meetings/work/b.md", "b", 1000),
        fakeMeeting("meetings/work/a.md", "a", 2000), // 더 최신
      ],
      (a, b) => b.mtime - a.mtime, // mtime desc
    );
    expect(tree.folders[0].meetings.map((m) => m.title)).toEqual(["a", "b"]);
  });

  it("폴더 0개 — rootMeetings 만", () => {
    const tree = buildMeetingsTree([
      fakeMeeting("meetings/x.md", "x"),
      fakeMeeting("meetings/y.md", "y"),
    ]);
    expect(tree.folders).toEqual([]);
    expect(tree.rootMeetings).toHaveLength(2);
  });
});

describe("buildMeetingsTree — extraFolders (빈 폴더 시각화)", () => {
  it("메모 0개 폴더도 트리에 포함", () => {
    const tree = buildMeetingsTree([], undefined, ["meetings/empty"]);
    expect(tree.folders.map((f) => f.path)).toEqual(["empty"]);
    expect(tree.folders[0].meetings).toEqual([]);
  });

  it("meetings/ prefix 없는 path 도 허용 (relative)", () => {
    const tree = buildMeetingsTree([], undefined, ["work", "work/2026"]);
    expect(tree.folders[0].path).toBe("work");
    expect(tree.folders[0].children[0].path).toBe("work/2026");
  });

  it("메모 있는 폴더 + 빈 폴더 mix", () => {
    const tree = buildMeetingsTree(
      [fakeMeeting("meetings/work/q1.md", "q1")],
      undefined,
      ["meetings/work", "meetings/personal"],
    );
    const work = tree.folders.find((f) => f.path === "work")!;
    const personal = tree.folders.find((f) => f.path === "personal")!;
    expect(work.meetings).toHaveLength(1);
    expect(personal.meetings).toHaveLength(0);
  });

  it("dot-prefix path 는 빈 폴더로도 안 들어옴", () => {
    const tree = buildMeetingsTree([], undefined, [".trash", "meetings/.icloud"]);
    expect(tree.folders).toEqual([]);
  });
});

describe("flattenFolderPaths", () => {
  it("root + 깊이 우선 폴더 path 평면화", () => {
    const tree = buildMeetingsTree([
      fakeMeeting("meetings/work/2026/jan.md", "jan"),
      fakeMeeting("meetings/personal/run.md", "run"),
    ]);
    expect(flattenFolderPaths(tree)).toEqual([
      "",
      "personal",
      "work",
      "work/2026",
    ]);
  });

  it("폴더 0개 → root 만", () => {
    const tree = buildMeetingsTree([fakeMeeting("meetings/x.md", "x")]);
    expect(flattenFolderPaths(tree)).toEqual([""]);
  });
});
