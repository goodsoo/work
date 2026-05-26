import { AlertCircle, Plus } from "lucide-react";
import { useMeetings } from "../../hooks/useMeetings";
import type { Meeting } from "../../api/meetings";
import { PageHeader } from "../nav/PageHeader";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { EmptyState as ErrorEmpty } from "../common/EmptyState";

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
          <Text variant="h3" as="h2">
            메모장
          </Text>
        }
        right={
          <Button
            variant="primary"
            onClick={onCreate}
            disabled={creating}
            leftIcon={<Plus className="h-4 w-4" />}
            className="rounded-lg gap-1.5 px-3 py-1.5 disabled:opacity-50"
          >
            새 메모장
          </Button>
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
              <Text
                variant="caption"
                color="muted"
                as="li"
                className="pt-2 text-center"
              >
                새로고침 중...
              </Text>
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
      <Button
        variant="ghost"
        onClick={onClick}
        className="block w-full rounded-lg p-4 text-left font-normal"
        style={{
          border: "1px solid var(--border-default)",
          backgroundColor: "var(--bg-base)",
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <Text
            variant="h4"
            weight="medium"
            as="span"
            truncate
          >
            {meeting.title?.trim() || "(제목 없음)"}
          </Text>
          <Text
            variant="caption"
            color="secondary"
            as="span"
            className="shrink-0 font-mono"
          >
            {formatDate(meeting.date)}
          </Text>
        </div>
        {meeting.attendees ? (
          <Text
            variant="caption"
            color="secondary"
            as="div"
            truncate
            className="mt-1"
          >
            {meeting.attendees}
          </Text>
        ) : null}
        {(() => {
          const first =
            meeting.discussion_items?.[0] ??
            meeting.decisions?.[0] ??
            meeting.action_items?.[0] ??
            meeting.content ??
            null;
          return first ? (
            <Text
              variant="body"
              color="secondary"
              as="p"
              className="mt-2 line-clamp-2"
            >
              {snippet(first, 140)}
            </Text>
          ) : null;
        })()}
      </Button>
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-24 animate-pulse rounded-lg"
          style={{ backgroundColor: "var(--bg-surface)" }}
        />
      ))}
    </ul>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Text variant="h3" as="h3">
        아직 메모장이 없어요
      </Text>
      <Text variant="body" color="secondary" as="p">
        첫 메모를 작성해볼까요?
      </Text>
      <Button
        variant="primary"
        onClick={onCreate}
        leftIcon={<Plus className="h-4 w-4" />}
        className="mt-2 rounded-lg gap-1.5 px-3 py-1.5"
      >
        새 메모장
      </Button>
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
    <ErrorEmpty
      icon={
        <AlertCircle
          className="h-12 w-12"
          style={{ color: "var(--accent-red)" }}
          strokeWidth={1.25}
        />
      }
      title="목록을 불러오지 못했습니다"
      description={
        <>
          <Text variant="body" color="secondary" as="p">
            잠시 후 다시 시도하세요.
          </Text>
          <Text variant="caption" color="muted" as="p" className="mt-1 font-mono">
            {message}
          </Text>
        </>
      }
      action={
        <Button variant="primary" onClick={onRetry}>
          다시 시도
        </Button>
      }
    />
  );
}
