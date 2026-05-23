import type { ReactNode } from "react";
import { Text } from "./Text";

type Props = {
  // 큰 아이콘 (optional). h-12 w-12 권장 (strokeWidth 1.25 weight).
  icon?: ReactNode;
  // h2 title
  title?: ReactNode;
  // body p
  description?: ReactNode;
  // 액션 button(s)
  action?: ReactNode;
  // 외부 wrapper className — viewport 높이 / center 정렬. caller 결정.
  // default: flex center column, padding.
  className?: string;
};

// 빈 상태 안내. 4 자리 (App MeetingsEmpty / Portfolio EmptyVault·EmptyFilter / Todos EmptyState)
// 동일 패턴 — icon? + title? + description? + action?.
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
}: Props) {
  return (
    <div className={className}>
      {icon}
      {title ? (
        <Text variant="h3" as="h2" className="mb-0">
          {title}
        </Text>
      ) : null}
      {description ? (
        <Text variant="body" color="secondary" as="p">
          {description}
        </Text>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
