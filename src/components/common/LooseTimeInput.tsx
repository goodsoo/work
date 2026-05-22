import { useEffect, useRef, useState } from "react";
import { parseLooseTime } from "../../lib/dates";

type Props = {
  value: string;
  onCommit: (next: string) => void;
  fullWidth?: boolean;
  compact?: boolean;
};

// 너그러운 시간 input. blur/Enter 시 parseLooseTime → HH:mm 정규화.
// 파싱 실패 시 이전 값으로 revert.
export function LooseTimeInput({
  value,
  onCommit,
  fullWidth = false,
  compact = false,
}: Props) {
  const [draft, setDraft] = useState(value);
  const skipCommitRef = useRef(false);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      return;
    }
    const trimmed = draft.trim();
    if (trimmed === "") {
      if (value !== "") onCommit("");
      return;
    }
    if (trimmed === value) return;
    const hhmm = parseLooseTime(trimmed);
    if (hhmm) {
      setDraft(hhmm);
      if (hhmm !== value) onCommit(hhmm);
    } else {
      setDraft(value);
    }
  }

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          skipCommitRef.current = true;
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      placeholder="hh:mm"
      maxLength={11}
      className={`m-0 appearance-none border-0 bg-transparent p-0 leading-none outline-none ${compact ? "text-xs" : "text-sm"}`}
      style={{
        color: "var(--text-primary)",
        width: fullWidth ? "100%" : `${Math.max(draft.length, 5)}ch`,
      }}
    />
  );
}
