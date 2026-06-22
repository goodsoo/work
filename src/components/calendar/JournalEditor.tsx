import { useCallback, useEffect, useRef, useState } from "react";
import {
  useJournals,
  useUpsertJournal,
  useDeleteJournal,
} from "../../hooks/useJournals";
import { useDebouncedSave, type SaveStatus } from "../../hooks/useDebouncedSave";
import { SourceBodyEditor } from "../meetings/SourceBodyEditor";
import { Text } from "../common/Text";

// 그 날(date) 일기 인라인 에디터 — 모달 없이 그 자리에서 바로 편집. JournalOverlay 와
// 같은 저장 로직(빈 본문=삭제, debounce 자동저장)을 useDebouncedSave + SourceBodyEditor
// 로 재사용. 날짜가 바뀌면 부모가 key={date} 로 remount (상태/저장 깔끔히 리셋).
export function JournalEditor({ date }: { date: string }) {
  const journalsQ = useJournals();
  const upsert = useUpsertJournal();
  const del = useDeleteJournal();
  const existing = (journalsQ.data ?? []).find((j) => j.date === date) ?? null;

  // 데이터가 이미 있으면 그 내용으로 시작, 아니면 빈 값(아래 effect 가 로드 후 1회 채움).
  const [content, setContent] = useState<string>(() => existing?.content ?? "");
  const inited = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const save = useCallback(
    async (value: string) => {
      if (value.trim().length === 0) {
        // 빈 본문 = 삭제 의도 (JournalOverlay 와 동일).
        if (existing) await del.mutateAsync(existing.id);
        return;
      }
      await upsert.mutateAsync({ date, content: value });
    },
    [date, existing, upsert, del],
  );

  const { schedule, flush, status } = useDebouncedSave<string>({ save });

  // 쿼리가 늦게 로드되면 그때 1회 초기화. 이후 캐시 갱신(자동저장 결과 등)이 입력을
  // 덮어쓰지 않도록 ref 가드 — date 는 remount key 라 마운트당 한 번만 의미 있음.
  useEffect(() => {
    if (journalsQ.isLoading || inited.current) return;
    inited.current = true;
    setContent(existing?.content ?? "");
  }, [journalsQ.isLoading, existing]);

  // 언마운트(날짜 전환 포함) 시 pending 저장 flush.
  useEffect(() => {
    return () => {
      void flush();
    };
  }, [flush]);

  return (
    // 다른 섹션처럼 타이틀 바로 아래 박스가 오도록 별도 상태 줄을 두지 않고,
    // 저장 표시는 박스 우상단에 떠 있게(레이아웃 안 밀림).
    <div className="relative">
      <div className="pointer-events-none absolute right-2 top-1.5 z-10">
        <SaveStatusText status={status} />
      </div>
      <div
        className="rounded-md px-3 py-2 font-serif text-[14px]"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          minHeight: "7rem",
        }}
        onClick={() => taRef.current?.focus()}
      >
        <SourceBodyEditor
          content={content}
          onChange={(next) => {
            setContent(next);
            schedule(next);
          }}
          placeholder="오늘 어땠어요?"
          textareaRef={taRef}
          onBlur={() => void flush()}
        />
      </div>
    </div>
  );
}

function SaveStatusText({ status }: { status: SaveStatus }) {
  const label =
    status === "saving" || status === "pending"
      ? "저장 중…"
      : status === "saved"
        ? "저장됨"
        : status === "error"
          ? "저장 실패"
          : null;
  if (!label) return null;
  return (
    <Text
      variant="caption"
      as="span"
      className="text-[11px]"
      style={{ color: status === "error" ? "var(--accent-red)" : "var(--text-muted)" }}
    >
      {label}
    </Text>
  );
}
