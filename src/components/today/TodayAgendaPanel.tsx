import { useMemo } from "react";
import { FileText, ChevronRight } from "lucide-react";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { useMeetings } from "../../hooks/useMeetings";
import { useTasks } from "../../hooks/useTasks";
import type { Task } from "../../api/tasks";
import type { Meeting } from "../../api/meetings";
import { categoryColor } from "../../lib/taskCategory";
import { todayIso, addDaysIso, formatDisplayDate } from "../../lib/dates";

// "오늘" 탭 사이드바 — 캘린더 그리드의 "다가오는 날 훑기" 역할을 대신. 내일부터 N일간
// 항목(일정/할일/노트)이 있는 날만 모아 아젠다로. 메인 대시보드(오늘)와 안 겹치게
// 오늘은 제외하고 내일부터. 날짜 헤더 클릭 = 캘린더 탭에서 그 날짜 상세.
type Props = {
  onOpenMeeting: (uid: string) => void;
  onOpenTask: (id: string) => void;
  // 날짜 헤더 클릭 — 캘린더 탭으로 이동해 그 날짜 선택.
  onOpenDate: (date: string) => void;
};

// 앞으로 몇 일치를 훑을지. 30일이면 한 달 앞 일정/마감까지 시야에 들어옴.
const LOOKAHEAD_DAYS = 30;

type DayGroup = {
  date: string;
  events: Task[]; // category=schedule
  tasks: Task[]; // 그 외 카테고리
  notes: Meeting[];
};

function byTime(a: string | null, b: string | null): number {
  const ta = a ?? "";
  const tb = b ?? "";
  if (ta === tb) return 0;
  if (!ta) return -1;
  if (!tb) return 1;
  return ta < tb ? -1 : 1;
}

export function TodayAgendaPanel({ onOpenMeeting, onOpenTask, onOpenDate }: Props) {
  const meetingsQ = useMeetings();
  const tasksQ = useTasks();

  const groups = useMemo<DayGroup[]>(() => {
    const from = addDaysIso(todayIso(), 1); // 내일
    const to = addDaysIso(todayIso(), LOOKAHEAD_DAYS);
    const map = new Map<string, DayGroup>();
    const ensure = (d: string): DayGroup => {
      let g = map.get(d);
      if (!g) {
        g = { date: d, events: [], tasks: [], notes: [] };
        map.set(d, g);
      }
      return g;
    };
    const inRange = (d: string | null): d is string =>
      d != null && d >= from && d <= to;

    for (const t of tasksQ.data ?? []) {
      if (t.deleted || t.cancelled) continue;
      if (!inRange(t.due_date)) continue;
      if (t.category === "schedule") ensure(t.due_date).events.push(t);
      else if (!t.done) ensure(t.due_date).tasks.push(t);
    }
    for (const m of meetingsQ.data ?? []) {
      if (inRange(m.date)) ensure(m.date!).notes.push(m);
    }

    for (const g of map.values()) {
      g.events.sort(
        (a, b) => byTime(a.due_time, b.due_time) || (a.title < b.title ? -1 : 1),
      );
      g.tasks.sort((a, b) => byTime(a.due_time, b.due_time));
      g.notes.sort((a, b) => {
        const ta = a.time ?? "";
        const tb = b.time ?? "";
        if (ta !== tb) return ta < tb ? -1 : 1;
        return a.created_at < b.created_at ? -1 : 1;
      });
    }
    return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [meetingsQ.data, tasksQ.data]);

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center px-4"
        style={{
          height: "var(--page-header-h)",
          borderBottom: "1px solid var(--border-default)",
        }}
      >
        <h2
          className="font-serif text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          다가오는 일정
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {groups.length === 0 ? (
          <Text
            variant="body"
            color="muted"
            as="div"
            className="px-4 py-8 text-center"
          >
            다가오는 일정이 없습니다.
          </Text>
        ) : (
          groups.map((g) => (
            <div key={g.date} className="mb-1">
              {/* 날짜 헤더 — 클릭 시 캘린더 탭에서 그 날짜 상세. */}
              <Button
                variant="ghost"
                onClick={() => onOpenDate(g.date)}
                title="캘린더에서 보기"
                className="group w-full justify-between gap-1.5 rounded-none py-1 pr-2 text-[13px] font-medium"
                style={{ paddingLeft: "12px", color: "var(--text-secondary)" }}
              >
                <span>{formatDisplayDate(g.date)}</span>
                <ChevronRight
                  className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-60"
                />
              </Button>

              <div className="px-1">
                {g.events.map((t) => (
                  <AgendaRow key={`e:${t.id}`} onClick={() => onOpenTask(t.id)}>
                    <span
                      className="w-11 shrink-0 text-[11px] tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {t.due_time ?? "종일"}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {t.title}
                    </span>
                  </AgendaRow>
                ))}
                {g.tasks.map((t) => (
                  <AgendaRow key={`t:${t.id}`} onClick={() => onOpenTask(t.id)}>
                    <span
                      aria-hidden
                      className="ml-1.5 mr-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: categoryColor(t.category) || "var(--text-muted)" }}
                    />
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {t.title}
                    </span>
                    {t.due_time ? (
                      <span
                        className="shrink-0 text-[11px] tabular-nums"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t.due_time}
                      </span>
                    ) : null}
                  </AgendaRow>
                ))}
                {g.notes.map((m) => (
                  <AgendaRow key={`n:${m.uid}`} onClick={() => onOpenMeeting(m.uid)}>
                    <FileText
                      className="h-3 w-3 shrink-0"
                      style={{ color: "var(--accent-blue)" }}
                    />
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {m.title?.trim() || "(제목 없음)"}
                    </span>
                  </AgendaRow>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AgendaRow({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[13px] transition hover:bg-[var(--bg-surface-hover)]"
    >
      {children}
    </div>
  );
}
