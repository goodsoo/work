import { Plus } from "lucide-react";
import { useMeetings } from "../../hooks/useMeetings";
import type { Meeting } from "../../api/meetings";
import { PageHeader } from "../nav/PageHeader";

type Props = {
  onSelect: (id: string) => void;
  onCreate: () => void;
  creating?: boolean;
};

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

function formatDate(d: string | null): string {
  if (!d) return "날짜 없음";
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return d;
  return dateFmt.format(parsed);
}

function snippet(content: string | null, max = 80): string {
  if (!content) return "";
  const collapsed = content.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? collapsed.slice(0, max) + "…" : collapsed;
}

export function MeetingsList({ onSelect, onCreate, creating }: Props) {
  const { data, isLoading, error, refetch, isFetching } = useMeetings();

  return (
    <>
      <PageHeader
        left={
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            회의록
          </h2>
        }
        right={
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            새 회의록
          </button>
        }
      />
      <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-5 lg:max-w-4xl">
        {error ? (
          <ErrorState
            message={(error as Error).message}
            onRetry={() => void refetch()}
          />
        ) : isLoading ? (
          <SkeletonList />
        ) : !data || data.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {data.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                onClick={() => onSelect(m.id)}
              />
            ))}
            {isFetching ? (
              <li className="pt-2 text-center text-xs text-zinc-400">
                새로고침 중...
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </>
  );
}

function MeetingCard({ meeting, onClick }: { meeting: Meeting; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="block w-full rounded-lg border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-base font-medium text-zinc-900 dark:text-zinc-100">
            {meeting.title?.trim() || "(제목 없음)"}
          </span>
          <span className="shrink-0 font-mono text-xs text-zinc-500">
            {formatDate(meeting.date)}
          </span>
        </div>
        {meeting.attendees ? (
          <div className="mt-1 truncate text-xs text-zinc-500">
            {meeting.attendees}
          </div>
        ) : null}
        {(() => {
          const first =
            meeting.discussion_items?.[0] ??
            meeting.decisions?.[0] ??
            meeting.action_items?.[0] ??
            meeting.content ??
            null;
          return first ? (
            <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
              {snippet(first, 140)}
            </p>
          ) : null;
        })()}
      </button>
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
        />
      ))}
    </ul>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        아직 회의록이 없어요
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        첫 회의를 기록해볼까요?
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <Plus className="h-4 w-4" />새 회의록
      </button>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500 dark:bg-red-950/30 dark:text-red-200">
      <div className="font-medium">목록을 불러오지 못했어요</div>
      <div className="mt-1 font-mono text-xs opacity-80">{message}</div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 text-xs underline underline-offset-2"
      >
        다시 시도
      </button>
    </div>
  );
}
