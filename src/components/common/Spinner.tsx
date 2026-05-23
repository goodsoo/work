import { Loader2 } from "lucide-react";
import type { HTMLAttributes } from "react";

type Size = "xs" | "sm" | "md";

type Props = HTMLAttributes<SVGSVGElement> & {
  size?: Size;
};

const sizeClass: Record<Size, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

// Loader2 + animate-spin 일관 자리 흡수. size = xs (3) / sm (3.5) / md (4).
// className / style 통과 — color 등 caller override.
export function Spinner({ size = "md", className = "", ...rest }: Props) {
  return (
    <Loader2
      className={`${sizeClass[size]} animate-spin ${className}`}
      {...rest}
    />
  );
}
