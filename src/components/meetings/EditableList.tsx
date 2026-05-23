import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../common/Button";
import { Text } from "../common/Text";

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
      <Text
        variant="body"
        color="secondary"
        as="h4"
        weight="medium"
        className="mb-2"
      >
        {title}
      </Text>
      {items.length === 0 && !adding ? (
        <Text variant="body" color="muted" as="p" className="mb-2 pl-6">
          {placeholder ?? "(없음)"}
        </Text>
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
                <Button
                  variant="ghost"
                  onClick={() => startEdit(i)}
                  className="flex-1 cursor-text rounded text-left whitespace-pre-wrap leading-relaxed font-normal px-0 py-0"
                >
                  {item}
                </Button>
              )}
              {editingIndex === i ? null : (
                <>
                  {itemActions ? itemActions(i, item) : null}
                  <Button
                    variant="icon"
                    onClick={() => deleteAt(i)}
                    aria-label="삭제"
                    className="p-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={startAdd}
          leftIcon={<Plus className="h-3 w-3" />}
          className="mt-2 pl-6 font-normal"
          style={{ color: "var(--text-muted)" }}
        >
          항목 추가
        </Button>
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
