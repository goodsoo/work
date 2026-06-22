import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CheckSquare,
  FileText,
  Plus,
  BookOpen,
  CornerUpLeft,
} from "lucide-react";
import { Button } from "../components/common/Button";
import { Text } from "../components/common/Text";
import { PageHeaderBar } from "../components/common/PageHeaderBar";
import { CheckboxButton } from "../components/tasks/CheckboxButton";
import { DayEvents } from "../components/today/DayEvents";
import { JournalEditor } from "../components/calendar/JournalEditor";
import { eventsOnDay, tasksDueOn, notesOnDay } from "../components/today/dayView";
import { compareTaskDate } from "../lib/taskSort";
import { useMeetings } from "../hooks/useMeetings";
import { useTasks, useUpdateTask, useCreateTask } from "../hooks/useTasks";
import { useSchedule } from "../hooks/useSchedule";
import type { Task } from "../api/tasks";
import {
  todayIso,
  formatDateLong,
  formatDisplayDate,
  relativeDateLabel,
  isPast,
} from "../lib/dates";

type Props = {
  // 메인창이 보여줄 날짜 (기본 = 오늘). 사이드바에서 날짜 선택 시 App 이 갱신.
  selectedDay: string;
  // "오늘로" 복귀 — selectedDay 를 오늘로.
  onReturnToday: () => void;
  onOpenMeeting: (uid: string) => void;
  onOpenTask: (id: string) => void;
  // 새 노트 생성 + 자동 선택. App 이 root 폴더에 만들고 메모장 탭으로 이동.
  onCreateNote: () => void;
};

// "이어서 쓸 노트" 표시 개수 (오늘 모드 전용).
const RECENT_NOTES = 5;
// 오늘 모드 할일 노출 개수 — 할일 탭과 같은 순서로 상위 N.
const TODO_LIMIT = 10;

// "오늘" 탭 메인창 — selectedDay 기준 day-view. 제목(헤더)이 곧 그 날짜이고(오늘이면
// "오늘"), 본문은 할일|일정 / 노트|일기 2열. 오늘이면 라이브 대시보드, 다른 날이면
// 그 날에 묶인 것만(그날 일정·그날 마감 할일·그날 노트·그날 일기). 루틴은 #routines 탭 전담.
export function TodayPage({
  selectedDay,
  onReturnToday,
  onOpenMeeting,
  onOpenTask,
  onCreateNote,
}: Props) {
  const today = todayIso();
  const day = selectedDay;
  const isTodayView = day === today;

  const meetingsQ = useMeetings();
  const tasksQ = useTasks();
  const scheduleQ = useSchedule();
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const [quickTask, setQuickTask] = useState("");

  // 그 날 일정 (count 용 — 본문은 DayEvents 가 추가/편집까지 렌더).
  const dayEvents = useMemo(
    () => eventsOnDay(scheduleQ.data ?? [], day),
    [scheduleQ.data, day],
  );

  // 할 일 — 오늘 모드: 오늘 날짜와 무관하게 할일 탭과 같은 순서(compareTaskDate date_asc)
  // 로 미완료(미삭제·미취소·미완료) 상위 TODO_LIMIT 개. 완료는 숨김. 다른 날: 그 날 마감만.
  const tasks = useMemo<Task[]>(() => {
    const all = tasksQ.data ?? [];
    if (!isTodayView) return tasksDueOn(all, day);
    return all
      .filter((t) => !t.deleted && !t.cancelled && !t.done)
      .sort((a, b) => compareTaskDate(a, b, true))
      .slice(0, TODO_LIMIT);
  }, [tasksQ.data, day, isTodayView]);

  // 노트 — 오늘 모드: 이어서 쓸 노트(최근 수정 N). 다른 날: 그 날 노트.
  const notes = useMemo(() => {
    const all = meetingsQ.data ?? [];
    if (!isTodayView) return notesOnDay(all, day);
    return [...all].sort((a, b) => b.mtime - a.mtime).slice(0, RECENT_NOTES);
  }, [meetingsQ.data, day, isTodayView]);

  function handleToggleTask(t: Task) {
    updateTask.mutate({ id: t.id, patch: { done: !t.done } });
  }

  function handleQuickAdd() {
    const title = quickTask.trim();
    if (!title) return;
    createTask.mutate({ title, due_date: day });
    setQuickTask("");
  }

  return (
    <div className="flex min-h-svh flex-col lg:h-full lg:min-h-0">
      <PageHeaderBar
        center={
          <Text variant="h4" as="h2">
            {isTodayView ? "오늘" : formatDateLong(day)}
          </Text>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-5 py-6">
          {/* 제목(날짜)은 헤더가 표시 — 다른 날일 때만 '오늘로' 복귀 버튼. */}
          {!isTodayView ? (
            <div className="mb-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onReturnToday}
                title="오늘로"
                leftIcon={<CornerUpLeft className="h-3 w-3" />}
                style={{ color: "var(--text-secondary)" }}
              >
                오늘로
              </Button>
            </div>
          ) : null}

          <div className="space-y-7">
            {/* 할 일 | 일정 */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-7 sm:grid-cols-2">
              <Section
                icon={<CheckSquare className="h-4 w-4" />}
                title={isTodayView ? "할 일" : "마감 할 일"}
                count={tasks.length}
              >
                <div className="mb-2 flex items-center gap-2">
                  <input
                    value={quickTask}
                    onChange={(e) => setQuickTask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleQuickAdd();
                      }
                    }}
                    placeholder={isTodayView ? "오늘 할 일 추가" : "이 날 할 일 추가"}
                    className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleQuickAdd}
                    title="할 일 추가"
                    style={{ color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
                    leftIcon={<Plus className="h-3 w-3" />}
                  >
                    추가
                  </Button>
                </div>
                {tasks.length === 0 ? (
                  <EmptyLine>
                    {isTodayView ? "오늘 할 일이 없습니다." : "이 날 마감 할 일이 없습니다."}
                  </EmptyLine>
                ) : (
                  tasks.map((t) => {
                    const overdue =
                      isTodayView && !t.done && t.due_date != null && isPast(t.due_date);
                    return (
                      <Row key={t.id} onClick={() => onOpenTask(t.id)}>
                        <CheckboxButton
                          status={t.done ? "done" : "pending"}
                          onClick={() => handleToggleTask(t)}
                        />
                        <span
                          className={`min-w-0 flex-1 truncate ${t.done ? "line-through" : ""}`}
                          style={{
                            color: t.done ? "var(--text-muted)" : "var(--text-primary)",
                          }}
                        >
                          {t.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums">
                          {t.due_date ? (
                            <span
                              style={{
                                color: overdue
                                  ? "var(--accent-red-text)"
                                  : "var(--text-muted)",
                              }}
                            >
                              {formatDisplayDate(t.due_date)}
                            </span>
                          ) : null}
                          {t.due_time ? (
                            <span style={{ color: "var(--text-muted)" }}>
                              {t.due_time}
                            </span>
                          ) : null}
                        </span>
                      </Row>
                    );
                  })
                )}
              </Section>

              <Section
                icon={<CalendarDays className="h-4 w-4" />}
                title={isTodayView ? "오늘 일정" : "일정"}
                count={dayEvents.length}
              >
                <DayEvents date={day} />
              </Section>
            </div>

            {/* 노트 | 일기 */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-7 sm:grid-cols-2">
              <Section
                icon={<FileText className="h-4 w-4" />}
                title={isTodayView ? "이어서 쓸 노트" : "이 날 노트"}
                action={
                  isTodayView ? (
                    <Button
                      variant="icon"
                      onClick={onCreateNote}
                      title="새 노트"
                      aria-label="새 노트"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  ) : undefined
                }
              >
                {notes.length === 0 ? (
                  <EmptyLine>
                    {isTodayView ? "아직 노트가 없습니다." : "이 날 작성한 노트가 없습니다."}
                  </EmptyLine>
                ) : (
                  notes.map((m) => (
                    <Row key={m.uid} onClick={() => onOpenMeeting(m.uid)}>
                      <FileText
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: "var(--accent-blue)" }}
                      />
                      <span
                        className="min-w-0 flex-1 truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {m.title?.trim() || "(제목 없음)"}
                      </span>
                      {isTodayView ? (
                        <span
                          className="shrink-0 text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {relativeDateLabel(todayIso(new Date(m.mtime)))}
                        </span>
                      ) : null}
                    </Row>
                  ))
                )}
              </Section>

              {/* 일기 — 그 날 일기. 모달 없이 그 자리에서 바로 인라인 편집(자동저장). */}
              <Section
                icon={<BookOpen className="h-4 w-4" />}
                title={isTodayView ? "오늘 일기" : "일기"}
              >
                <JournalEditor key={day} date={day} />
              </Section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 대시보드 블록 — 아이콘 + 라벨 + 카운트 헤더, 그 아래 행 리스트. 바깥 간격은
// 부모(space-y / grid gap)가 관리하므로 자체 margin 없음.
function Section({
  icon,
  title,
  count,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div
        className="mb-1.5 flex items-center gap-2"
        style={{ color: "var(--text-secondary)" }}
      >
        <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
          {icon}
        </span>
        <Text variant="body" weight="semibold" as="h3">
          {title}
        </Text>
        {typeof count === "number" && count > 0 ? (
          <span
            className="text-[12px] tabular-nums"
            style={{ color: "var(--text-muted)" }}
          >
            {count}
          </span>
        ) : null}
        {action ? <span className="ml-auto shrink-0">{action}</span> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

// 클릭 가능한 한 행 — hover 강조.
function Row({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
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
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[14px] transition hover:bg-[var(--bg-surface-hover)]"
    >
      {children}
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return (
    <Text variant="caption" color="muted" as="div" className="px-2 py-1.5">
      {children}
    </Text>
  );
}
