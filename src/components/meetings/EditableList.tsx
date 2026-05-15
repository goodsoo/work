import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";

type BulletKind = "dot" | "redCheckbox";

type Props = {
  title: string;
  items: string[];
  onSave: (next: string[]) => void;
  bullet?: BulletKind;
  itemActions?: (index: number, text: string) => ReactNode;
  placeholder?: string;
};

export function EditableList({
  title,
  items,
  onSave,
  bullet = "dot",
  itemActions,
  placeholder,
}: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState("");

  function startEdit(i: number) {
    setEditingIndex(i);
    setDraft(items[i] ?? "");
  }

  function commitEdit() {
    if (editingIndex === null) return;
    const trimmed = draft.trim();
    const next = [...items];
    if (trimmed === "") {
      next.splice(editingIndex, 1);
    } else if (trimmed !== items[editingIndex]) {
      next[editingIndex] = trimmed;
    } else {
      setEditingIndex(null);
      setDraft("");
      return;
    }
    setEditingIndex(null);
    setDraft("");
    onSave(next);
  }

  function cancelEdit() {
    setEditingIndex(null);
    setDraft("");
  }

  function deleteAt(i: number) {
    const next = [...items];
    next.splice(i, 1);
    onSave(next);
  }

  function startAdd() {
    setAdding(true);
    setAddDraft("");
  }

  function commitAdd() {
    const trimmed = addDraft.trim();
    if (trimmed) {
      onSave([...items, trimmed]);
    }
    setAdding(false);
    setAddDraft("");
  }

  function cancelAdd() {
    setAdding(false);
    setAddDraft("");
  }

  return (
    <div>
      <h4
        className="mb-2 text-sm font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {title}
      </h4>
      {items.length === 0 && !adding ? (
        <p className="mb-2 pl-6 text-sm" style={{ color: "var(--text-muted)" }}>
          {placeholder ?? "(없음)"}
        </p>
      ) : (
        <ul
          className="space-y-1.5 text-sm"
          style={{ color: "var(--text-primary)" }}
        >
          {items.map((item, i) => (
            <li key={i} className="group flex items-start gap-2">
              <Bullet kind={bullet} />
              {editingIndex === i ? (
                <EditingRow
                  draft={draft}
                  onChange={setDraft}
                  onCommit={commitEdit}
                  onCancel={cancelEdit}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(i)}
                  className="flex-1 cursor-text rounded text-left whitespace-pre-wrap leading-relaxed transition"
                  style={{ minHeight: 0 }}
                >
                  {item}
                </button>
              )}
              {editingIndex === i ? null : (
                <>
                  {itemActions ? itemActions(i, item) : null}
                  <button
                    type="button"
                    onClick={() => deleteAt(i)}
                    aria-label="삭제"
                    className="rounded p-1 transition"
                    style={{ color: "var(--text-muted)", minHeight: 24, minWidth: 24 }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <div className="mt-2 flex items-start gap-2">
          <Bullet kind={bullet} />
          <EditingRow
            autoFocus
            draft={addDraft}
            onChange={setAddDraft}
            onCommit={commitAdd}
            onCancel={cancelAdd}
            placeholder="새 항목"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={startAdd}
          className="mt-2 inline-flex items-center gap-1 pl-6 text-xs transition"
          style={{ color: "var(--text-muted)", minHeight: 0 }}
        >
          <Plus className="h-3 w-3" />
          항목 추가
        </button>
      )}
    </div>
  );
}

function Bullet({ kind }: { kind: BulletKind }) {
  if (kind === "redCheckbox") {
    return (
      <span
        className="mt-1 inline-block h-3.5 w-3.5 shrink-0 rounded border-2"
        style={{ borderColor: "var(--accent-red)" }}
      />
    );
  }
  return (
    <span
      className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full"
      style={{ backgroundColor: "var(--text-muted)" }}
    />
  );
}

function EditingRow({
  draft,
  onChange,
  onCommit,
  onCancel,
  placeholder,
  autoFocus,
}: {
  draft: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(draft.length, draft.length);
    }
  }, [autoFocus, draft.length]);
  useEffect(() => {
    if (!autoFocus && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(draft.length, draft.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosize
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [draft]);

  return (
    <textarea
      ref={ref}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onCommit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      rows={1}
      className="flex-1 resize-none rounded bg-transparent px-1 py-0 leading-relaxed outline-none"
    />
  );
}
