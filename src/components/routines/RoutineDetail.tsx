import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  useRoutine,
  useUpdateRoutine,
  useDeleteRoutine,
  useToggleRoutineDay,
} from "../../hooks/useRoutines";
import { PageHeaderBar } from "../common/PageHeaderBar";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import { LooseDateInput } from "../common/LooseDateInput";
import { LooseTimeInput } from "../common/LooseTimeInput";
import { useToast } from "../Toast";
import { formatError } from "../../lib/errors";
import { RoutineLog } from "./RoutineLog";

type Props = {
  name: string;
  onClose: () => void;
};

export function RoutineDetail({ name, onClose }: Props) {
  const routineQ = useRoutine(name);
  const updateMutation = useUpdateRoutine();
  const deleteMutation = useDeleteRoutine();
  const toggleMutation = useToggleRoutineDay();
  const toast = useToast();

  const routine = routineQ.data ?? null;

  // form draft — 서버 데이터와 분리. blur 시 commit (메모장 패턴).
  const [draftName, setDraftName] = useState(name);
  const [draftTime, setDraftTime] = useState("");
  const [draftStarted, setDraftStarted] = useState("");
  const [draftEnds, setDraftEnds] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!routine) return;
    setDraftName(routine.name);
    setDraftTime(routine.frontmatter.time ?? "");
    setDraftStarted(routine.frontmatter.started);
    setDraftEnds(routine.frontmatter.ends ?? "");
  }, [routine?.name, routine?.frontmatter.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function commitField(patch: Parameters<typeof updateMutation.mutate>[0]["patch"]) {
    if (!routine) return;
    try {
      await updateMutation.mutateAsync({ name: routine.name, patch });
    } catch (err) {
      toast.show(formatError(err));
    }
  }

  async function commitRename() {
    if (!routine) return;
    const next = draftName.trim();
    if (!next || next === routine.name) {
      setDraftName(routine.name);
      return;
    }
    try {
      await updateMutation.mutateAsync({
        name: routine.name,
        patch: { rename: next },
      });
    } catch (err) {
      setDraftName(routine.name);
      toast.show(formatError(err));
    }
  }

  async function handleDelete() {
    if (!routine) return;
    if (
      !window.confirm(
        `'${routine.name}' 루틴을 삭제할까요? 체크 이력도 함께 사라집니다.`,
      )
    )
      return;
    try {
      await deleteMutation.mutateAsync(routine.name);
      onClose();
    } catch (err) {
      toast.show(formatError(err));
    }
  }

  function handleToggleDay(date: string, currentDone: boolean) {
    if (!routine) return;
    toggleMutation.mutate({
      name: routine.name,
      date,
      done: !currentDone,
    });
  }

  if (routineQ.isLoading || !routine) {
    return (
      <>
        <PageHeaderBar
          center={
            <Text variant="h4" as="h2" className="text-center">
              루틴
            </Text>
          }
        />
        <div className="mx-auto w-full max-w-xl px-5 pt-6">
          <div
            className="h-32 animate-pulse rounded-lg"
            style={{ backgroundColor: "var(--bg-surface)" }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeaderBar
        center={
          <Text variant="h4" as="h2" className="text-center">
            {routine.name}
          </Text>
        }
        right={
          <Button
            variant="icon"
            onClick={() => void handleDelete()}
            title="루틴 삭제"
            style={{ color: "var(--text-muted)" }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-xl px-5 pb-16 pt-5">
        {/* 폼 — 이름 (전체 너비) + 시간/시작일/종료일 3 cols. 태스크 행과 유사한 row 패딩. */}
        <div className="space-y-2">
          <Field label="이름">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => void commitRename()}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setDraftName(routine.name);
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
              className="w-full rounded-md px-2 py-1.5 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="시간">
              <InputBox>
                <LooseTimeInput
                  value={draftTime}
                  onCommit={(next) => {
                    setDraftTime(next);
                    if (next === (routine.frontmatter.time ?? "")) return;
                    void commitField({ time: next || null });
                  }}
                  fullWidth
                />
              </InputBox>
            </Field>
            <Field label="시작일">
              <InputBox>
                <LooseDateInput
                  value={draftStarted}
                  onCommit={(next) => {
                    setDraftStarted(next);
                    if (!next || next === routine.frontmatter.started) return;
                    void commitField({ started: next });
                  }}
                  fullWidth
                />
              </InputBox>
            </Field>
            <Field label="종료일">
              <InputBox>
                <LooseDateInput
                  value={draftEnds}
                  onCommit={(next) => {
                    setDraftEnds(next);
                    if (next === (routine.frontmatter.ends ?? "")) return;
                    void commitField({ ends: next || null });
                  }}
                  fullWidth
                />
              </InputBox>
            </Field>
          </div>
        </div>

        {/* 기록 — 시작일부터 (또는 종료일까지) 전체. GitHub-style 그리드. */}
        <div className="mt-6">
          <RoutineLog routine={routine} onToggleDay={handleToggleDay} />
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <Text variant="caption" color="secondary" as="span" weight="medium">
        {label}
      </Text>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function InputBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-md px-2 py-1.5"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
      }}
    >
      {children}
    </div>
  );
}
