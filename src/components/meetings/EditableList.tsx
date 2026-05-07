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
      <h4 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {title}
      </h4>
      {items.length === 0 && !adding ? (
        <p className="mb-2 pl-6 text-sm text-zinc-400">
          {placeholder ?? "(없음)"}
        </p>
      ) : (
        <ul className="space-y-1.5 text-sm text-zinc-800 dark:text-zinc-200">
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
                  className="flex-1 cursor-text rounded text-left whitespace-pre-wrap leading-relaxed transition hover:bg-zinc-50 hover:px-1 dark:hover:bg-zinc-900"
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
                    className="rounded p-1 text-zinc-300 transition hover:text-red-600 dark:hover:text-red-500"
                    style={{ minHeight: 24, minWidth: 24 }}
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
          className="mt-2 inline-flex items-center gap-1 pl-6 text-xs text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
          style={{ minHeight: 0 }}
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
      <span className="mt-1 inline-block h-3.5 w-3.5 shrink-0 rounded border-2 border-red-600 dark:border-red-500" />
    );
  }
  return (
    <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
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
      className="flex-1 resize-none rounded bg-transparent px-1 py-0 leading-relaxed outline-none focus:bg-zinc-50 dark:focus:bg-zinc-900"
    />
  );
}
