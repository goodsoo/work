import type { TodoCategory } from "../../api/todos";
import { categoryColor } from "../../lib/todoCategory";

// 체크박스 button — pending / done / cancelled 3 state. pending 일 때 카테고리 색을
// border 로, 미분류는 회색 (--text-muted). done/cancelled 는 카테고리 무관 (완료/취소가
// 의미 우선). e.stopPropagation 내장 — 부모 행의 click navigate 와 충돌 없음.
export function CheckboxButton({
  status,
  category,
  onClick,
}: {
  status: "pending" | "done" | "cancelled";
  category: TodoCategory | null;
  onClick: () => void;
}) {
  const catColor = status === "pending" ? categoryColor(category) : "";
  const pendingBorder = catColor || "var(--text-muted)";
  // 내부 배경 — 카테고리 색을 4% alpha 로 매우 연하게 tint. 미분류
  // (catColor 빈문자) 는 칠 안 함. color-mix 가 다크모드에서도 var(--cat-*) 자동
  // 따라감.
  const pendingFill = catColor
    ? `color-mix(in srgb, ${catColor} 4%, transparent)`
    : "transparent";
  return (
    <button
      type="button"
      aria-label={
        status === "cancelled"
          ? "취소 해제"
          : status === "done"
            ? "완료 취소"
            : "완료"
      }
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`group/check flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition ${
        status === "done"
          ? "bg-[var(--text-secondary)]"
          : status === "cancelled"
            ? "border-[var(--border-default)] bg-[var(--bg-surface)]"
            : "hover:brightness-95"
      }`}
      style={{
        minHeight: 18,
        minWidth: 18,
        borderColor:
          status === "pending"
            ? pendingBorder
            : status === "done"
              ? "var(--text-secondary)"
              : undefined,
        borderWidth: status === "pending" ? 1.5 : undefined,
        backgroundColor: status === "pending" ? pendingFill : undefined,
      }}
    >
      {status === "done" ? (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-3 w-3"
          style={{ color: "var(--text-inverse)" }}
          aria-hidden
        >
          <path
            d="M3 8l3 3 7-7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : status === "cancelled" ? (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-3 w-3"
          style={{ color: "var(--text-muted)" }}
          aria-hidden
        >
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="h-3 w-3 opacity-0 transition-opacity group-hover/check:opacity-50"
          style={{ color: "var(--text-primary)" }}
          aria-hidden
        >
          <path
            d="M3 8l3 3 7-7"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
