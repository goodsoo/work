import { useCallback, useEffect, useRef, useState } from "react";
import { X, Eye, Pencil } from "lucide-react";
import { useUpsertJournal, useDeleteJournal, useJournals } from "../../hooks/useJournals";
import { useDebouncedSave, type SaveStatus } from "../../hooks/useDebouncedSave";
import { formatDateLong } from "../../lib/dates";
import { MarkdownView } from "../meetings/MarkdownView";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";

type Props = {
  open: boolean;
  date: string;
  onClose: () => void;
};

// 같은 날짜로 다시 열어도 ref state 살아남도록 모듈 cache. 다른 날짜는 별개.
// 새로고침 시 reset.
const DRAFT_CACHE = new Map<string, string>();

export function JournalOverlay({ open, date, onClose }: Props) {
  const journalsQ = useJournals();
  const upsertMutation = useUpsertJournal();
  const deleteMutation = useDeleteJournal();

  const existing = (journalsQ.data ?? []).find((j) => j.date === date) ?? null;

  // 초기값: 서버 데이터 > draft cache > 빈 문자열. open 될 때 한 번 결정.
  // open 중에 외부 데이터 바뀌어도 사용자 입력 덮어쓰지 않게 open 분리.
  const [content, setContent] = useState<string>("");
  // view/edit 토글 — 일기는 매번 편집 모드로 시작 (방금 쓴 거 이어 쓰기 자연스러움).
  // 회의록 useViewMode 와 의도적으로 분리: persist 안 함, 오버레이 닫으면 reset.
  const [viewMode, setViewMode] = useState<"edit" | "view">("edit");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const save = useCallback(
    async (value: string) => {
      const isEmpty = value.trim().length === 0;
      if (isEmpty) {
        // 빈 본문 = 삭제 의도 (사용자 명시: "필요하면 내용 전부 지우면 되니까").
        // 1초 debounce 후에도 빈 상태면 자동 delete. existing 없으면 noop.
        if (existing) {
          await deleteMutation.mutateAsync(existing.id);
        }
        return;
      }
      await upsertMutation.mutateAsync({ date, content: value });
    },
    [date, existing, upsertMutation, deleteMutation],
  );

  const { schedule, flush, status, error } = useDebouncedSave<string>({ save });

  // open 시 초기값 세팅 + draft cache 비움 + 편집 모드로 리셋. 이미 열려있는 채로
  // date prop 만 바뀌면 동일.
  // 의도: open 트리거의 1회 reset — 외부 데이터가 바뀌어도 사용자 입력을 덮어쓰지
  // 않도록 effect 안에서 setContent. effect-set-state warning 은 의도된 패턴이라 무시.
  useEffect(() => {
    if (!open) return;
    const initial = DRAFT_CACHE.get(date) ?? existing?.content ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setContent(initial);
    setViewMode("edit");
    DRAFT_CACHE.delete(date);
    // existing 이 늦게 도착해도 placeholder 가 유지되도록 open + date 만 dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  // 닫힐 때 pending flush. unmount 시 draft cache 저장 (저장 실패 케이스 보존용).
  useEffect(() => {
    return () => {
      void flush();
    };
  }, [flush]);

  // open 시 자동 focus + 끝으로 caret. view 모드 진입 시엔 focus 안 함.
  useEffect(() => {
    if (!open) return;
    if (viewMode !== "edit") return;
    const id = requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
    return () => cancelAnimationFrame(id);
  }, [open, viewMode]);

  // 모달 단축키 (Escape 는 Modal 컴포넌트가 onClose=handleClose 로 처리):
  //   Cmd/Ctrl+Enter — 저장&닫기
  //   Cmd/Ctrl+Shift+E — 편집/보기 토글 (content 비어있으면 무효). 메모장 단축키와 통일.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd || e.altKey) return;
      if (!e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        handleClose();
        return;
      }
      // e.code 사용해서 한글 IME 무관 (KeyE 매칭).
      if (e.shiftKey && e.code === "KeyE") {
        if (content.trim().length === 0) return;
        e.preventDefault();
        setViewMode((m) => (m === "edit" ? "view" : "edit"));
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, content]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setContent(next);
    schedule(next);
  }

  async function handleClose() {
    await flush();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} ariaLabel="일기 작성">
      <div
        // 설정창과 동일 사이즈 spec — max-w-3xl + min(560px, 80vh) 고정.
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-xl"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          height: "min(560px, 80vh)",
        }}
      >
        <header
          className="flex shrink-0 items-center justify-between gap-3 px-5"
          style={{
            height: "3rem",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          <h2
            className="font-serif text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {formatDateLong(date)} 일기
          </h2>
          <div className="flex items-center gap-2">
            <SaveBadge status={status} error={error} />
            {content.trim().length > 0 ? (
              <ModeChip
                viewMode={viewMode}
                onToggle={() =>
                  setViewMode((m) => (m === "edit" ? "view" : "edit"))
                }
              />
            ) : null}
            <Button
              variant="icon"
              onClick={handleClose}
              aria-label="닫기"
              title="닫기  ESC"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>
        {/* edit: textarea 가 컨테이너 100% 채우고 자체 스크롤. view: 컨테이너 스크롤. */}
        {viewMode === "edit" ? (
          <textarea
            ref={taRef}
            value={content}
            onChange={handleChange}
            onBlur={() => void flush()}
            placeholder="오늘 어땠어요?"
            className="block min-h-0 flex-1 resize-none bg-transparent px-6 py-5 font-serif text-[15px] leading-relaxed outline-none placeholder:not-italic placeholder:text-[var(--text-muted)]"
            style={{ color: "var(--text-primary)" }}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 font-serif">
            <MarkdownView content={content} />
          </div>
        )}
      </div>
    </Modal>
  );
}

// 메모장 ModeChip 과 동일 spec (MeetingForm.tsx 의 ModeChip 참고): chip 스타일,
// 아이콘 의미 = 다음 액션 (편집 모드면 Pencil + "편집" 라벨, 클릭하면 보기로).
function ModeChip({
  viewMode,
  onToggle,
}: {
  viewMode: "edit" | "view";
  onToggle: () => void;
}) {
  const isEdit = viewMode === "edit";
  const title = `${isEdit ? "보기" : "편집"} 모드로  ⌘⇧E`;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      title={title}
      aria-label={title}
      leftIcon={
        isEdit ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />
      }
      className="px-1.5 py-0.5"
      style={{
        border: "1px solid var(--border-subtle)",
        color: isEdit ? "var(--accent-blue-text)" : "var(--text-secondary)",
        backgroundColor: isEdit ? "var(--accent-blue-bg)" : "var(--bg-surface)",
      }}
    >
      {isEdit ? "편집" : "보기"}
    </Button>
  );
}

function SaveBadge({ status, error }: { status: SaveStatus; error: Error | null }) {
  if (status === "saving" || status === "pending") {
    return (
      <Text variant="caption" color="muted" as="span" className="text-[11px]">
        저장 중…
      </Text>
    );
  }
  if (status === "saved") {
    return (
      <Text variant="caption" color="muted" as="span" className="text-[11px]">
        저장됨
      </Text>
    );
  }
  if (status === "error") {
    return (
      <Text
        variant="caption"
        as="span"
        className="text-[11px]"
        style={{ color: "var(--accent-red)" }}
        title={error?.message ?? undefined}
      >
        저장 실패
      </Text>
    );
  }
  return null;
}
