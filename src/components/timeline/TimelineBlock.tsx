import type { ReactNode } from "react";
import { Text } from "../common/Text";

type Props = {
  letter: "M" | "J" | "T" | "S";
  children: ReactNode;
  onClick?: () => void;
};

export function TimelineBlock({ letter, children, onClick }: Props) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-start gap-3 text-left ${
        onClick
          ? "rounded-lg transition"
          : ""
      }`}
      style={onClick ? { minHeight: 0, padding: "0.25rem 0" } : undefined}
    >
      <Text
        variant="caption"
        color="muted"
        as="span"
        aria-hidden
        className="w-5 shrink-0 select-none pt-0.5 text-center font-mono"
      >
        {letter}
      </Text>
      <div className="min-w-0 flex-1">{children}</div>
    </Wrapper>
  );
}
