import { describe, expect, it } from "vitest";

import {
  buildVaultImageIndex,
  expandObsidianEmbeds,
  makeEmbedResolver,
} from "./obsidianEmbed";

describe("buildVaultImageIndex", () => {
  it("이미지만 basename(소문자) → 경로로 인덱싱, .md 등 제외", () => {
    const idx = buildVaultImageIndex([
      "notes/글쓰기/yYpocEf8MBAS.jpeg",
      "notes/수업/스크린샷 2023-05-26 오후 4.51.25.png",
      "notes/글쓰기/단편 만화 분석.md",
      "notes/_attachments/uid/1.png",
    ]);
    expect(idx.get("yypocef8mbas.jpeg")).toBe("notes/글쓰기/yYpocEf8MBAS.jpeg");
    expect(idx.get("스크린샷 2023-05-26 오후 4.51.25.png")).toBe(
      "notes/수업/스크린샷 2023-05-26 오후 4.51.25.png",
    );
    expect(idx.get("1.png")).toBe("notes/_attachments/uid/1.png");
    expect(idx.has("단편 만화 분석.md")).toBe(false);
  });

  it("basename 충돌 시 첫 항목 우선", () => {
    const idx = buildVaultImageIndex(["a/x.png", "b/x.png"]);
    expect(idx.get("x.png")).toBe("a/x.png");
  });
});

describe("expandObsidianEmbeds", () => {
  const idx = buildVaultImageIndex([
    "notes/글쓰기/yYpocEf8MBAS.jpeg",
    "notes/수업/스크린샷 2023-05-26 오후 4.51.25.png",
  ]);
  const resolve = makeEmbedResolver(idx);

  it("bare 파일명 임베드 → 표준 이미지 (공백·한글 경로는 <> 로 감쌈)", () => {
    expect(expandObsidianEmbeds("![[yYpocEf8MBAS.jpeg]]", resolve)).toBe(
      "![yYpocEf8MBAS.jpeg](<notes/글쓰기/yYpocEf8MBAS.jpeg>)",
    );
    expect(
      expandObsidianEmbeds("![[스크린샷 2023-05-26 오후 4.51.25.png]]", resolve),
    ).toBe(
      "![스크린샷 2023-05-26 오후 4.51.25.png](<notes/수업/스크린샷 2023-05-26 오후 4.51.25.png>)",
    );
  });

  it("alias 는 alt 로, 순수 크기 지정 alias 는 무시하고 파일명 alt", () => {
    expect(expandObsidianEmbeds("![[yYpocEf8MBAS.jpeg|만화 컷]]", resolve)).toBe(
      "![만화 컷](<notes/글쓰기/yYpocEf8MBAS.jpeg>)",
    );
    expect(expandObsidianEmbeds("![[yYpocEf8MBAS.jpeg|200x300]]", resolve)).toBe(
      "![yYpocEf8MBAS.jpeg](<notes/글쓰기/yYpocEf8MBAS.jpeg>)",
    );
  });

  it("경로형 임베드는 그대로 vault 상대경로 사용", () => {
    expect(
      expandObsidianEmbeds("![[folder/pic.png]]", makeEmbedResolver(new Map())),
    ).toBe("![folder/pic.png](<folder/pic.png>)");
  });

  it("미해석 (인덱스에 없는 파일·노트 임베드) 은 원본 유지", () => {
    expect(expandObsidianEmbeds("![[없는파일.png]]", resolve)).toBe(
      "![[없는파일.png]]",
    );
    expect(expandObsidianEmbeds("![[다른 노트]]", resolve)).toBe(
      "![[다른 노트]]",
    );
  });

  it("코드블록·인라인 코드 안 임베드는 변환 안 함", () => {
    const fenced = "```\n![[yYpocEf8MBAS.jpeg]]\n```";
    expect(expandObsidianEmbeds(fenced, resolve)).toBe(fenced);
    const inline = "`![[yYpocEf8MBAS.jpeg]]` 는 문법";
    expect(expandObsidianEmbeds(inline, resolve)).toBe(inline);
  });

  it("본문 중간 임베드 + 주변 텍스트 보존", () => {
    const md = "분석 결과:\n\n![[yYpocEf8MBAS.jpeg]]\n\n끝.";
    expect(expandObsidianEmbeds(md, resolve)).toBe(
      "분석 결과:\n\n![yYpocEf8MBAS.jpeg](<notes/글쓰기/yYpocEf8MBAS.jpeg>)\n\n끝.",
    );
  });

  it("임베드 없으면 입력 그대로", () => {
    expect(expandObsidianEmbeds("그냥 텍스트", resolve)).toBe("그냥 텍스트");
  });
});
