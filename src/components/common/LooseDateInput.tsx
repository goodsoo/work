import { useEffect, useRef, useState } from "react";
import { parseLooseDate, weekdayShort } from "../../lib/dates";

type Props = {
  value: string;
  onCommit: (next: string) => void;
  fullWidth?: boolean;
  // todo 카드 같은 좁은 메타 row 용 — text-xs.
  compact?: boolean;
};

// 너그러운 날짜 input. blur/Enter 시 parseLooseDate → ISO 정규화. 파싱 실패 시
// 이전 값으로 revert. blur 상태 + 유효 ISO + 요일 있으면 input value 자체에
// " (요일)" 합쳐 표시. focus 가면 ISO 만 (편집 가능).
export function LooseDateInput({
  value,
  onCommit,
  fullWidth = false,
  compact = false,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  // ESC → blur 시 commit skip flag. setDraft 가 async 라 commit 클로저가
  // stale draft 읽고 수정값을 저장하는 버그 방지.
  const skipCommitRef = useRef(false);
  useEffect(() => {
    // 외부에서 value 바뀌면 draft 동기화 (server 갱신 등). 의도된 sync 패턴.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const iso = parseLooseDate(trimmed);
    if (iso) {
      setDraft(iso);
      if (iso !== value) onCommit(iso);
    } else {
      setDraft(value);
    }
  }

  const wd = weekdayShort(value);
  const display = !focused && draft && wd ? `${draft} (${wd})` : draft;
  // ch unit ≈ 영문 0 width. text-xs 의 ch 가 약간 넉넉해서 한글 1자 (`(일)` 같은)
  // 도 추가 보정 없이 display.length 만으로 fit. 보정 더하면 우측 큰 패딩 생김.
  const widthCh = Math.max(display.length, 10);

  return (
    <input
      type="text"
      value={display}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
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
      placeholder="yyyy-mm-dd"
      maxLength={10}
      className={`m-0 appearance-none border-0 bg-transparent p-0 leading-none outline-none ${compact ? "text-xs" : "text-sm"}`}
      style={{
        color: "var(--text-primary)",
        width: fullWidth ? "100%" : `${widthCh}ch`,
      }}
    />
  );
}
