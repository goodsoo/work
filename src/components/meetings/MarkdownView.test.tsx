import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { MarkdownView } from "./MarkdownView";

describe("MarkdownView code blocks", () => {
  it("renders 4-space indented code block as a single block (no inline-styled code)", () => {
    const md = "before\n\n    Second\n    Code Block\n\nafter";
    const { container } = render(<MarkdownView content={md} />);
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    const code = pre!.querySelector("code");
    expect(code).not.toBeNull();
    // 핵심: code 의 textContent 는 source 그대로 — leading space 없어야.
    expect(code!.textContent).toBe("Second\nCode Block\n");
    // innerHTML 도 동일.
    expect(code!.innerHTML).toBe("Second\nCode Block\n");
  });

  it("renders fenced code block (no language) clean", () => {
    const md = "before\n\n```\nSecond\nCode Block\n```\n\nafter";
    const { container } = render(<MarkdownView content={md} />);
    const code = container.querySelector("pre code");
    expect(code).not.toBeNull();
    expect(code!.textContent).toBe("Second\nCode Block\n");
  });

  it("renders fenced code block with language clean", () => {
    const md = "before\n\n```js\nconst a = 1;\nconst b = 2;\n```\n\nafter";
    const { container } = render(<MarkdownView content={md} />);
    const code = container.querySelector("pre code");
    expect(code).not.toBeNull();
    expect(code!.classList.contains("language-js")).toBe(true);
    expect(code!.textContent).toBe("const a = 1;\nconst b = 2;\n");
  });

  it("inline code (single backtick) keeps inline styling", () => {
    const md = "use `npm install` to setup";
    const { container } = render(<MarkdownView content={md} />);
    const code = container.querySelector("code");
    expect(code).not.toBeNull();
    expect(code!.textContent).toBe("npm install");
    // inline code 는 pre 의 자식이 아님.
    expect(code!.parentElement?.tagName.toLowerCase()).not.toBe("pre");
  });
});

describe("MarkdownView task list", () => {
  it("renders exactly one checkbox per task item (no double-render)", () => {
    const md = "- [ ] one\n- [x] two";
    const { container } = render(<MarkdownView content={md} />);
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
  });

  it("preserves bullets on a normal ul that follows a task list", () => {
    const md = "- [ ] task\n\n- 하나\n  - 둘";
    const { container } = render(<MarkdownView content={md} />);
    // mdast 는 빈 줄로 분리해도 contains-task-list ul 안의 li 로 묶을 수 있다.
    // 어떤 구조이든 모든 ul 은 list-disc 를 유지해야 "하나" 의 마커가 보임.
    const uls = container.querySelectorAll("ul");
    for (const ul of Array.from(uls)) {
      expect(ul.className).toContain("list-disc");
    }
  });

  it("task-list-item li uses list-none (마커 중복 회피)", () => {
    const md = "- [ ] task";
    const { container } = render(<MarkdownView content={md} />);
    const li = container.querySelector("li.task-list-item");
    expect(li).not.toBeNull();
    expect(li!.className).toContain("list-none");
  });

  it("loose task list (빈 줄로 분리된 후속 list 포함) 도 체크박스 1개만 (p wrapper 안의 input 깊이 탐색)", () => {
    // 빈 줄로 분리하면 mdast 가 task list 와 다음 ul 을 같은 ul.contains-task-list 로
    // 묶고 각 li 의 inline content 가 <p> 로 감싸짐. 그 안의 default input 도 잡혀야.
    const md = "- [ ] one\n- [x] two\n\n- 하나\n  - 둘";
    const { container } = render(<MarkdownView content={md} />);
    // task-list-item 은 2개만, 각 1개의 checkbox.
    const taskLis = container.querySelectorAll("li.task-list-item");
    expect(taskLis.length).toBe(2);
    for (const li of Array.from(taskLis)) {
      const checkboxes = li.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(1);
    }
  });
});

describe("MarkdownView headings", () => {
  it("renders all 6 heading levels with distinct styling", () => {
    const md = "# h1\n## h2\n### h3\n#### h4\n##### h5\n###### h6";
    const { container } = render(<MarkdownView content={md} />);
    for (const level of [1, 2, 3, 4, 5, 6]) {
      const h = container.querySelector(`h${level}`);
      expect(h).not.toBeNull();
      // 모든 heading 은 font-serif (paragraph 와 시각 구분).
      expect(h!.className).toContain("font-serif");
    }
  });
});

describe("MarkdownView misc", () => {
  it("renders an img with alt", () => {
    const md = "![cat](https://example.com/cat.png)";
    const { container } = render(<MarkdownView content={md} />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("alt")).toBe("cat");
    // remote URL 은 그대로 통과.
    expect(img!.getAttribute("src")).toBe("https://example.com/cat.png");
  });

  it("renders no <br> for hard break — \\n 만으로 줄바꿈 (whitespace-pre-wrap)", () => {
    const md = "line1  \nline2";
    const { container } = render(<MarkdownView content={md} />);
    expect(container.querySelector("br")).toBeNull();
    // 텍스트는 둘 다 존재.
    expect(container.textContent).toContain("line1");
    expect(container.textContent).toContain("line2");
  });

  it("renders table with cells", () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |";
    const { container } = render(<MarkdownView content={md} />);
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    const ths = container.querySelectorAll("th");
    expect(ths.length).toBe(2);
    const tds = container.querySelectorAll("td");
    expect(tds.length).toBe(2);
  });

  it("renders table alignment from `:---` syntax", () => {
    const md = "| L | C | R |\n|:--|:-:|--:|\n| a | b | c |";
    const { container } = render(<MarkdownView content={md} />);
    const ths = Array.from(container.querySelectorAll("th"));
    expect(ths[0].style.textAlign).toBe("left");
    expect(ths[1].style.textAlign).toBe("center");
    expect(ths[2].style.textAlign).toBe("right");
    const tds = Array.from(container.querySelectorAll("td"));
    expect(tds[0].style.textAlign).toBe("left");
    expect(tds[1].style.textAlign).toBe("center");
    expect(tds[2].style.textAlign).toBe("right");
  });

  it("renders nested blockquote", () => {
    const md = "> outer\n>\n> > inner";
    const { container } = render(<MarkdownView content={md} />);
    const outer = container.querySelector("blockquote");
    expect(outer).not.toBeNull();
    const inner = outer!.querySelector("blockquote");
    expect(inner).not.toBeNull();
  });

  it("escapes inline HTML (no rehype-raw, safe)", () => {
    const md = "text <em>html</em> tag";
    const { container } = render(<MarkdownView content={md} />);
    // <em> 가 rehype-raw 없이 본문 문자로 escape 됨 → DOM 에 em 자식 없음.
    const em = container.querySelector(".markdown-view > p em");
    expect(em).toBeNull();
    expect(container.textContent).toContain("<em>html</em>");
  });

  it("renders strikethrough via remark-gfm (~~)", () => {
    const md = "~~struck~~ text";
    const { container } = render(<MarkdownView content={md} />);
    const del = container.querySelector("del");
    expect(del).not.toBeNull();
    expect(del!.textContent).toBe("struck");
  });

  it("renders autolink", () => {
    const md = "visit https://example.com please";
    const { container } = render(<MarkdownView content={md} />);
    const a = container.querySelector("a");
    expect(a).not.toBeNull();
    expect(a!.getAttribute("href")).toBe("https://example.com");
  });
});
