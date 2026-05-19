import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { formatAttendees, parseAttendees } from "../../lib/attendees";

type Props = {
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];
  placeholder?: string;
};

export function AttendeeTagInput({
  value,
  onChange,
  suggestions,
  placeholder,
}: Props) {
  const tags = useMemo(() => parseAttendees(value), [value]);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const tagsLower = useMemo(() => tags.map((t) => t.toLowerCase()), [tags]);

  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const candidates = suggestions.filter(
      (s) => !tagsLower.includes(s.toLowerCase()),
    );
    if (!q) return candidates.slice(0, 8);
    const startsWith = candidates.filter((s) =>
      s.toLowerCase().startsWith(q),
    );
    const contains = candidates.filter(
      (s) => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q),
    );
    return [...startsWith, ...contains].slice(0, 8);
  }, [draft, suggestions, tagsLower]);

  function addTag(name: string) {
    const trimmed = name.trim().replace(/,/g, "");
    if (!trimmed) return;
    if (tagsLower.includes(trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange(formatAttendees([...tags, trimmed]));
    setDraft("");
    setHighlight(0);
  }

  function removeAt(i: number) {
    const next = [...tags];
    next.splice(i, 1);
    onChange(formatAttendees(next));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[highlight]) addTag(filtered[highlight]);
      else if (draft.trim()) addTag(draft);
    } else if (e.key === ",") {
      e.preventDefault();
      if (draft.trim()) addTag(draft);
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      e.preventDefault();
      removeAt(tags.length - 1);
    } else if (e.key === "ArrowDown") {
      if (filtered.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      if (filtered.length === 0) return;
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <div
        className="flex flex-wrap items-center gap-1"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-0.5 pr-2"
            style={{ color: "var(--text-primary)" }}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeAt(i);
              }}
              aria-label={`${tag} 제거`}
              className="rounded transition"
              style={{ color: "var(--text-muted)", minHeight: 14, minWidth: 14 }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setTimeout(() => setOpen(false), 100);
            if (draft.trim()) addTag(draft);
          }}
          onKeyDown={onKeyDown}
          placeholder={tags.length === 0 ? placeholder ?? "이름 입력 후 Enter" : ""}
          className="min-w-[6em] flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--text-primary)", minHeight: 0, padding: 0 }}
        />
      </div>
      {open && filtered.length > 0 ? (
        <ul
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-auto rounded-lg shadow-md"
          style={{
            border: "1px solid var(--border-default)",
            backgroundColor: "var(--bg-base)",
          }}
          role="listbox"
        >
          {filtered.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(s);
                }}
                onMouseEnter={() => setHighlight(i)}
                className="w-full px-3 py-1.5 text-left text-sm transition"
                style={{
                  backgroundColor: i === highlight ? "var(--bg-surface)" : undefined,
                  color: i === highlight ? "var(--text-primary)" : "var(--text-secondary)",
                  minHeight: 32,
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
