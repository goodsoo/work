import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

// 드롭존이 drop → saveScreenshot → frontmatter patch 까지 실제로 도는지 회귀 고정.
// 무거운 vault adapter / React Query / 이미지 리사이즈는 모킹하고, 컴포넌트의
// 분기(이미지 필터 · label · vault 가드)만 검증한다.

const mutate = vi.fn();
const getRoot = vi.fn<() => string | null>(() => "/vault");

vi.mock("../../lib/vault/useVault", () => ({
  useVault: () => ({ adapter: { getRoot } }),
}));
vi.mock("../../hooks/usePortfolio", () => ({
  useUpdatePortfolioFrontmatter: () => ({ mutate }),
}));
vi.mock("../../lib/portfolio/screenshot", () => ({
  saveScreenshot: vi.fn(
    async ({ label }: { label: string }) => ({
      path: `portfolio/_attachments/owner-repo-1/${label}-1.jpg`,
    }),
  ),
}));

import { ScreenshotDropzone } from "./ScreenshotDropzone";
import { saveScreenshot } from "../../lib/portfolio/screenshot";

function imageFile(name = "shot.png") {
  return new File(["binary"], name, { type: "image/png" });
}
function textFile(name = "notes.txt") {
  return new File(["plain"], name, { type: "text/plain" });
}
function dropFiles(el: Element, files: File[]) {
  fireEvent.drop(el, { dataTransfer: { files } });
}

beforeEach(() => {
  vi.clearAllMocks();
  getRoot.mockReturnValue("/vault");
});

describe("ScreenshotDropzone drop flow", () => {
  it("saves a dropped image and patches frontmatter screenshots (before)", async () => {
    const { container } = render(
      <ScreenshotDropzone prSlug="owner-repo-1" existing={[]} label="before" />,
    );
    const zone = container.querySelector("label")!;
    dropFiles(zone, [imageFile()]);

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(saveScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({ prSlug: "owner-repo-1", label: "before" }),
    );
    expect(mutate).toHaveBeenCalledWith({
      screenshots: [
        {
          path: "portfolio/_attachments/owner-repo-1/before-1.jpg",
          label: "before",
          caption: "",
        },
      ],
    });
  });

  it("appends after the existing screenshots and uses the after label", async () => {
    const existing = [
      { path: "portfolio/_attachments/owner-repo-1/after-1.jpg", label: "after" as const, caption: "" },
    ];
    const { container } = render(
      <ScreenshotDropzone
        prSlug="owner-repo-1"
        existing={existing}
        label="after"
      />,
    );
    dropFiles(container.querySelector("label")!, [imageFile("two.png")]);

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    const arg = mutate.mock.calls[0][0] as { screenshots: unknown[] };
    expect(arg.screenshots).toHaveLength(2);
    expect(arg.screenshots[1]).toMatchObject({ label: "after" });
  });

  it("rejects non-image files without mutating and shows an error", async () => {
    const { container, findByText } = render(
      <ScreenshotDropzone prSlug="owner-repo-1" existing={[]} label="before" />,
    );
    dropFiles(container.querySelector("label")!, [textFile()]);

    expect(await findByText("이미지 파일만 업로드 가능")).toBeInTheDocument();
    expect(saveScreenshot).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("guards when the vault root is not set", async () => {
    getRoot.mockReturnValue(null);
    const { container, findByText } = render(
      <ScreenshotDropzone prSlug="owner-repo-1" existing={[]} label="before" />,
    );
    dropFiles(container.querySelector("label")!, [imageFile()]);

    expect(await findByText("vault 가 설정되지 않았어요")).toBeInTheDocument();
    expect(saveScreenshot).not.toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });
});
