import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  ManualPasteFallback,
  manualFallbackSummary,
} from "./ManualPasteFallback";

const noop = () => {};

describe("manualFallbackSummary", () => {
  it("returns the default label when there is no request error", () => {
    expect(manualFallbackSummary(null)).toBe("직접 입력 (수동 paste)");
  });

  it("returns the guide label when a request error is present", () => {
    expect(
      manualFallbackSummary("claude CLI 가 안 보여요. 설치 후 로그인을 먼저."),
    ).toBe("claude CLI 가 없으면 외부 Claude 응답을 붙여넣으세요");
  });
});

describe("ManualPasteFallback auto-open", () => {
  it("stays collapsed with the default label when there is no request error", () => {
    const { container } = render(
      <ManualPasteFallback
        requestError={null}
        promptCopied={false}
        copyDisabled={false}
        onCopyPrompt={noop}
        onParsed={noop}
      />,
    );
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details!.open).toBe(false);
    expect(screen.getByText("직접 입력 (수동 paste)")).toBeInTheDocument();
  });

  it("auto-opens and shows the guide label when claude CLI fails", () => {
    const { container } = render(
      <ManualPasteFallback
        requestError="claude CLI 가 안 보여요. 설치 후 로그인을 먼저."
        promptCopied={false}
        copyDisabled={false}
        onCopyPrompt={noop}
        onParsed={noop}
      />,
    );
    const details = container.querySelector("details");
    expect(details!.open).toBe(true);
    expect(
      screen.getByText("claude CLI 가 없으면 외부 Claude 응답을 붙여넣으세요"),
    ).toBeInTheDocument();
  });
});
