import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CheckSquare,
  Repeat,
  FileText,
  Plus,
  BookOpen,
} from "lucide-react";
import { Button } from "../components/common/Button";
import { Text } from "../components/common/Text";
import { PageHeaderBar } from "../components/common/PageHeaderBar";
import { CheckboxButton } from "../components/tasks/CheckboxButton";
import { useMeetings } from "../hooks/useMeetings";
import { useTasks, useUpdateTask, useCreateTask } from "../hooks/useTasks";
import { useSchedule } from "../hooks/useSchedule";
import { useJournals } from "../hooks/useJournals";
import { useActiveRoutines, useToggleRoutineDay } from "../hooks/useRoutines";
import type { Task } from "../api/tasks";
import type { ScheduleEvent } from "../api/schedule";
import {
  todayIso,
  formatDateLong,
  relativeDateLabel,
  isPast,
} from "../lib/dates";

type Props = {
  onOpenMeeting: (uid: string) => void;
  onOpenTask: (id: string) => void;
  onOpenRoutine: (name: string) => void;
  // 새 노트 생성 + 자동 선택. App 이 root 폴더에 만들고 메모장 탭으로 이동.
  onCreateNote: () => void;
  // 오늘 일기 오버레이 열기 (App 이 소유 — 사이드바 과거 날짜 일기와 같은 오버레이).
  onOpenJournal: () => void;
  // 날짜 상세 모달 열기 (일정 보기/편집 + 일기 + 그 날 노트). App 이 소유.
  onOpenDay: (date: string) => void;
};

// 일기 미리보기용 — 첫 non-empty 줄을 제목처럼. ATX heading prefix 만 strip
// (사이드바 일기 미리보기와 동일 규칙).
function journalPreview(content: string | undefined): string {
  const first = content
    ?.split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return first?.replace(/^#+\s+/, "") || "(내용 없음)";
}

// 최근 수정 노트 표시 개수 — "이어서 쓸 노트" 동선용으로 4-5개면 충분.
const RECENT_NOTES = 5;

// "할 일/일정" 시간순 정렬 — 시각 없는(종일) 항목 먼저, 시각 있는 것은 오름차순.
// 앱 전체 (캘린더/사이드바) 와 동일 규칙.
function byTime(a: string | null, b: string | null): number {
  const ta = a ?? "";
  const tb = b ?? "";
  if (ta === tb) return 0;
  if (!ta) return -1;
  if (!tb) return 1;
  return ta < tb ? -1 : 1;
}

export function TodayPage({
  onOpenMeeting,
  onOpenTask,
  onOpenRoutine,
  onCreateNote,
  onOpenJournal,
  onOpenDay,
}: Props) {
  const today = todayIso();
  const meetingsQ = useMeetings();
  const tasksQ = useTasks();
  const scheduleQ = useSchedule();
  const journalsQ = useJournals();
  const routines = useActiveRoutines(today);
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const toggleRoutineDay = useToggleRoutineDay();
  const [quickTask, setQuickTask] = useState("");

  // 오늘 일정 — schedule.md 이벤트 중 오늘 날짜를 포함하는 것. 다일 일정도 포함.
  // 이벤트는 "완료" 개념이 없어 체크박스 없이 시각 + 제목만. 클릭 = 날짜 상세 모달.
  const events = useMemo<ScheduleEvent[]>(() => {
    const list = (scheduleQ.data ?? []).filter((e) => {
      if (e.end && e.end > e.start) return e.start <= today && today <= e.end;
      return e.start === today;
    });
    return list.sort(
      (a, b) => byTime(a.time, b.time) || (a.text < b.text ? -1 : 1),
    );
  }, [scheduleQ.data, today]);

  // 오늘·밀린 할 일 — 오늘 마감 + 지난 미완료. 날짜 없는 inbox 는 제외.
  // 밀린(지난 날짜 미완료) 은 빨강. 오늘 완료한 것도 노출 (체크 해제 가능).
  const tasks = useMemo<Task[]>(() => {
    const list = (tasksQ.data ?? []).filter((t) => {
      if (t.deleted || t.cancelled) return false;
      if (!t.due_date) return false;
      if (t.done) return t.due_date === today;
      // 미완료: 오늘 이전(밀린) 또는 오늘.
      return t.due_date <= today;
    });
    return list.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.due_date !== b.due_date)
        return (a.due_date ?? "") < (b.due_date ?? "") ? -1 : 1;
      return byTime(a.due_time, b.due_time);
    });
  }, [tasksQ.data, today]);

  // 이어서 쓸 노트 — 최근 수정순 (mtime desc) 상위 N개.
  const recentNotes = useMemo(() => {
    return [...(meetingsQ.data ?? [])]
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, RECENT_NOTES);
  }, [meetingsQ.data]);

  // 오늘 일기 — 있으면 첫 줄 미리보기, 없으면 쓰기 CTA.
  const todayJournal =
    (journalsQ.data ?? []).find((j) => j.date === today) ?? null;

  function handleToggleTask(t: Task) {
    updateTask.mutate({ id: t.id, patch: { done: !t.done } });
  }

  function handleQuickAdd() {
    const title = quickTask.trim();
    if (!title) return;
    createTask.mutate({ title, due_date: today });
    setQuickTask("");
  }

  return (
    <div className="flex min-h-svh flex-col lg:h-full lg:min-h-0">
      <PageHeaderBar
        center={
          <Text variant="h4" as="h2">
            오늘
          </Text>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-5 py-6">
          {/* 날짜 + 빠른 추가 */}
          <Text variant="body" color="secondary" as="div" className="mb-4">
            {formatDateLong(today)}
          </Text>

          <input
            value={quickTask}
            onChange={(e) => setQuickTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleQuickAdd();
              }
            }}
            placeholder="오늘 할 일을 입력하세요"
            className="mb-7 w-full rounded-md px-3 py-2 text-sm outline-none"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
            }}
          />

          {/* 1. 오늘 일정 */}
          <Section
            icon={<CalendarDays className="h-4 w-4" />}
            title="오늘 일정"
            count={events.length}
          >
            {events.length === 0 ? (
              <EmptyLine>오늘 일정이 없습니다.</EmptyLine>
            ) : (
              events.map((e) => (
                <Row key={e.id} onClick={() => onOpenDay(today)}>
                  <span
                    className="w-12 shrink-0 text-[12px] tabular-nums"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {e.time ?? "종일"}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {e.text}
                  </span>
                </Row>
              ))
            )}
          </Section>

          {/* 2. 오늘·밀린 할 일 */}
          <Section
            icon={<CheckSquare className="h-4 w-4" />}
            title="오늘·밀린 할 일"
            count={tasks.length}
          >
            {tasks.length === 0 ? (
              <EmptyLine>오늘 할 일이 없습니다.</EmptyLine>
            ) : (
              tasks.map((t) => {
                const overdue = !t.done && t.due_date != null && isPast(t.due_date);
                return (
                  <Row key={t.id} onClick={() => onOpenTask(t.id)}>
                    <CheckboxButton
                      status={t.done ? "done" : "pending"}
                      onClick={() => handleToggleTask(t)}
                    />
                    <span
                      className={`min-w-0 flex-1 truncate ${t.done ? "line-through" : ""}`}
                      style={{
                        color: t.done
                          ? "var(--text-muted)"
                          : "var(--text-primary)",
                      }}
                    >
                      {t.title}
                    </span>
                    {overdue ? (
                      <span
                        className="shrink-0 text-[11px]"
                        style={{ color: "var(--accent-red-text)" }}
                      >
                        {relativeDateLabel(t.due_date!)}
                      </span>
                    ) : t.due_time ? (
                      <span
                        className="shrink-0 text-[11px] tabular-nums"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t.due_time}
                      </span>
                    ) : null}
                  </Row>
                );
              })
            )}
          </Section>

          {/* 3. 오늘의 루틴 */}
          <Section
            icon={<Repeat className="h-4 w-4" />}
            title="오늘의 루틴"
            count={routines.length}
          >
            {routines.length === 0 ? (
              <EmptyLine>오늘 루틴이 없습니다.</EmptyLine>
            ) : (
              routines.map((r) => {
                const done = r.log.has(today);
                return (
                  <Row key={r.name} onClick={() => onOpenRoutine(r.name)}>
                    <CheckboxButton
                      status={done ? "done" : "pending"}
                      shape="circle"
                      onClick={() =>
                        toggleRoutineDay.mutate({
                          name: r.name,
                          date: today,
                          done: !done,
                        })
                      }
                    />
                    <span
                      className={`min-w-0 flex-1 truncate ${done ? "line-through" : ""}`}
                      style={{
                        color: done ? "var(--text-muted)" : "var(--text-primary)",
                      }}
                    >
                      {r.name}
                    </span>
                    {r.frontmatter.time ? (
                      <span
                        className="shrink-0 text-[11px] tabular-nums"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {r.frontmatter.time}
                      </span>
                    ) : null}
                  </Row>
                );
              })
            )}
          </Section>

          {/* 4. 이어서 쓸 노트 */}
          <Section
            icon={<FileText className="h-4 w-4" />}
            title="이어서 쓸 노트"
            action={
              <Button
                variant="icon"
                onClick={onCreateNote}
                title="새 노트"
                aria-label="새 노트"
                style={{ color: "var(--text-secondary)" }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            }
          >
            {recentNotes.length === 0 ? (
              <EmptyLine>아직 노트가 없습니다.</EmptyLine>
            ) : (
              recentNotes.map((m) => (
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
                  <span
                    className="shrink-0 text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {relativeDateLabel(todayIso(new Date(m.mtime)))}
                  </span>
                </Row>
              ))
            )}
          </Section>

          {/* 5. 오늘 일기 — 하루를 닫는 회고. 클릭 = 일기 오버레이 (사이드바 과거
              날짜 일기와 같은 오버레이). 없으면 쓰기 CTA, 있으면 첫 줄 미리보기. */}
          <Section icon={<BookOpen className="h-4 w-4" />} title="오늘 일기">
            <Row onClick={onOpenJournal}>
              <BookOpen
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: "var(--text-muted)" }}
              />
              <span
                className="min-w-0 flex-1 truncate"
                style={{
                  color: todayJournal
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
                }}
              >
                {todayJournal ? journalPreview(todayJournal.content) : "일기 쓰기"}
              </span>
            </Row>
          </Section>
        </div>
      </div>
    </div>
  );
}

// 대시보드 블록 — 아이콘 + 라벨 + 카운트 헤더, 그 아래 행 리스트.
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
  // 헤더 우측 액션 (예: "이어서 쓸 노트" 의 새 노트 버튼).
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-7">
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

// 클릭 가능한 한 행 — hover 강조. 체크박스의 stopPropagation 덕분에 행 클릭과 충돌 없음.
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
