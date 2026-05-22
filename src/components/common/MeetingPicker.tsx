import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Search } from "lucide-react";
import { useMeetings } from "../../hooks/useMeetings";
import { formatDateShortWithDay } from "../../lib/dates";

type Props = {
  value: string | null; // selected meeting uid
  onChange: (uid: string | null) => void;
};

// 메모가 많아지면 select dropdown 에서 찾기 어려움 → 검색 가능한 popover.
// 옵시디안 quick switcher 같은 느낌. 외부 클릭 / ESC 로 닫힘.
export function MeetingPicker({ value, onChange }: Props) {
  const meetingsQ = useMeetings();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = value
    ? meetingsQ.data?.find((m) => m.uid === value) ?? null
    : null;
  const buttonLabel = selected
    ? selected.title?.trim() || "(제목 없음)"
    : "연결 없음";

  const filtered = useMemo(() => {
    const all = meetingsQ.data ?? [];
    const q = query.trim().toLowerCase();
    // 최신순 — date desc (null last) → mtime desc fallback.
    const sorted = all.slice().sort((a, b) => {
      const da = a.date ?? "";
      const db = b.date ?? "";
      if (da !== db) {
        if (!da) return 1;
        if (!db) return -1;
        return db.localeCompare(da);
      }
      return b.mtime - a.mtime;
    });
    if (!q) return sorted.slice(0, 30);
    return sorted
      .filter((m) => (m.title?.trim() || "").toLowerCase().includes(q))
      .slice(0, 30);
  }, [meetingsQ.data, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex max-w-[12rem] items-center gap-1 rounded-md px-2 py-0.5 text-xs transition hover:bg-[var(--bg-surface-hover)]"
        style={{ color: "var(--text-secondary)", minHeight: 0 }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <FileText className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
        <span className="truncate">{buttonLabel}</span>
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-md shadow-md"
          style={{
            backgroundColor: "var(--bg-base)",
            border: "1px solid var(--border-default)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <Search
              className="h-3 w-3 shrink-0"
              style={{ color: "var(--text-muted)" }}
              aria-hidden
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="메모 검색"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              style={{ color: "var(--text-primary)" }}
            />
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="shrink-0 rounded px-1.5 py-0.5 text-[11px] transition hover:bg-[var(--bg-surface-hover)]"
                style={{ color: "var(--text-muted)", minHeight: 0 }}
              >
                연결 해제
              </button>
            ) : null}
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li
                className="px-3 py-2 text-center text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                일치하는 메모 없음
              </li>
            ) : (
              filtered.map((m) => {
                const active = m.uid === value;
                return (
                  <li key={m.uid}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(m.uid);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition"
                      style={{
                        backgroundColor: active
                          ? "var(--bg-surface-active)"
                          : undefined,
                        color: active
                          ? "var(--text-primary)"
                          : "var(--text-secondary)",
                        minHeight: 0,
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {m.title?.trim() || "(제목 없음)"}
                      </span>
                      {m.date ? (
                        <span
                          className="shrink-0 font-mono text-[10px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {formatDateShortWithDay(m.date)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
