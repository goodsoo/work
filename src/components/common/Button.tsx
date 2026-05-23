import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

type Variant = "primary" | "secondary" | "danger" | "info" | "ghost" | "icon";
type Size = "sm" | "md";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
};

// 디자인 토큰 기반 Button. 141 자리 raw <button> 흡수.
// variant — primary(filled black) / secondary(outlined) / danger(red) / info(blue) /
//           ghost(no fill, hover surface) / icon(아이콘 only)
// size sm = xs/px-2.5, md = sm/px-3 (default). icon 은 size 무시 + p-1.5 정사각.
// 자리마다 미세 override 가 필요한 경우 className + style 그대로 통과.
export function Button({
  variant = "secondary",
  size = "md",
  leftIcon,
  rightIcon,
  className = "",
  type = "button",
  style,
  children,
  ...rest
}: Props) {
  const sizeClass =
    variant === "icon"
      ? "p-1.5 text-sm"
      : size === "sm"
        ? "px-2.5 py-1 text-xs"
        : "px-3 py-1.5 text-sm";

  const hover =
    variant === "primary" || variant === "danger" || variant === "info"
      ? "hover:opacity-90"
      : "hover:bg-[var(--bg-surface-hover)]";

  const variantStyle: React.CSSProperties =
    variant === "primary"
      ? { backgroundColor: "var(--btn-primary)", color: "var(--btn-primary-text)" }
      : variant === "danger"
        ? { backgroundColor: "var(--accent-red)", color: "var(--text-inverse)" }
        : variant === "info"
          ? { backgroundColor: "var(--accent-blue)", color: "var(--text-inverse)" }
          : variant === "secondary"
            ? {
                border: "1px solid var(--border-default)",
                color: "var(--text-secondary)",
              }
            : { color: "var(--text-secondary)" };

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${sizeClass} ${hover} ${className}`}
      style={{ minHeight: 0, ...variantStyle, ...style }}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}
