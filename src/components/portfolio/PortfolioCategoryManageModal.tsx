import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { Text } from "../common/Text";
import {
  BUILTIN_CATEGORIES,
  type PortfolioCategoryDef,
} from "../../api/portfolio";
import {
  useAddPortfolioCategory,
  useDeletePortfolioCategory,
  usePortfolioCategories,
  usePortfolioWorks,
} from "../../hooks/usePortfolio";
import { slugifyUserKey } from "../../lib/portfolio/slug";

type Props = {
  open: boolean;
  onClose: () => void;
};

// 색상 swatch — 카테고리 빌트인 5 + accent 3. 사용자가 새 카테고리 만들거나
// 기존 색 바꿀 때 선택지. var(--*) 토큰으로 저장해 light/dark 자동 대응.
const COLOR_SWATCHES: readonly { id: string; var: string }[] = [
  { id: "uiux", var: "var(--cat-uiux)" },
  { id: "backend", var: "var(--cat-backend)" },
  { id: "infra", var: "var(--cat-infra)" },
  { id: "fix", var: "var(--cat-fix)" },
  { id: "other", var: "var(--cat-other)" },
  { id: "work", var: "var(--cat-work)" },
  { id: "schedule", var: "var(--cat-schedule)" },
  { id: "yellow", var: "var(--accent-yellow)" },
];

// 카테고리 관리 모달 — 추가 / label 수정 / 색상 변경 / 삭제.
// builtin 5 (ui_ux 등) 는 slug 고정·삭제 불가. label·color override 는 가능 (categories.md
// 에 entry 저장하면 mergeCategoryDefs 가 코드 default 위에 덮음).
export function PortfolioCategoryManageModal({ open, onClose }: Props) {
  const categoriesQuery = usePortfolioCategories();
  const worksQuery = usePortfolioWorks();
  const addCategory = useAddPortfolioCategory();
  const deleteCategory = useDeletePortfolioCategory();

  const categories = useMemo(
    () => categoriesQuery.data ?? [],
    [categoriesQuery.data],
  );

  // 각 카테고리 사용 카운트 — 삭제 시 마이그레이션 영향 카드 수 안내용.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of worksQuery.data ?? []) {
      const c = w.frontmatter.category;
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return map;
  }, [worksQuery.data]);

  // 신규 추가 폼
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<string>("var(--cat-other)");
  const [addError, setAddError] = useState<string | null>(null);

  // 편집 중인 slug — 한 행만 편집 모드.
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("var(--cat-other)");

  // 삭제 confirm 중인 slug.
  const [deleteTarget, setDeleteTarget] = useState<PortfolioCategoryDef | null>(
    null,
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setNewLabel("");
    setNewColor("var(--cat-other)");
    setAddError(null);
    setEditingSlug(null);
    setDeleteTarget(null);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const slug = slugifyUserKey(label);
    if (!slug) {
      setAddError("이름에서 slug 를 만들 수 없습니다. 영문·숫자·하이픈을 포함하세요.");
      return;
    }
    if (categories.some((c) => c.slug === slug)) {
      setAddError("같은 slug 의 카테고리가 이미 있습니다.");
      return;
    }
    try {
      await addCategory.mutateAsync({ slug, label, color: newColor });
      setNewLabel("");
      setNewColor("var(--cat-other)");
      setAddError(null);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    }
  };

  const startEdit = (def: PortfolioCategoryDef) => {
    setEditingSlug(def.slug);
    setEditLabel(def.label);
    setEditColor(def.color ?? "var(--cat-other)");
  };

  const cancelEdit = () => {
    setEditingSlug(null);
  };

  const saveEdit = async (def: PortfolioCategoryDef) => {
    const label = editLabel.trim();
    if (!label) return;
    try {
      await addCategory.mutateAsync({
        slug: def.slug,
        label,
        color: editColor,
        sort: def.sort,
      });
      setEditingSlug(null);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCategory.mutateAsync(deleteTarget.slug);
      setDeleteTarget(null);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      ariaLabelledBy="portfolio-cat-manage-title"
    >
      <div
        className="flex shrink-0 items-center gap-2 px-5 py-3"
        style={{ borderBottom: "1px solid var(--border-default)" }}
      >
        <Pencil
          className="h-4 w-4"
          style={{ color: "var(--text-secondary)" }}
        />
        <Text
          id="portfolio-cat-manage-title"
          variant="body"
          weight="semibold"
          as="h2"
        >
          카테고리 관리
        </Text>
        <Button
          variant="icon"
          onClick={onClose}
          title="닫기  ESC"
          aria-label="닫기"
          className="ml-auto"
          style={{ color: "var(--text-muted)" }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
        {/* 신규 추가 */}
        <div className="mb-4">
          <Text
            variant="caption"
            color="secondary"
            as="div"
            weight="medium"
            className="mb-1.5 text-[11px]"
          >
            새 카테고리 추가
          </Text>
          <div
            className="flex flex-col gap-2 rounded-md p-3"
            style={{
              backgroundColor: "var(--bg-surface-hover)",
              border: "1px solid var(--border-default)",
            }}
          >
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder="카테고리 이름을 입력하세요"
              className="rounded-md px-2 py-1.5 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                color: "var(--text-primary)",
              }}
            />
            <SwatchPicker selected={newColor} onChange={setNewColor} />
            <div className="flex items-center justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={handleAdd}
                disabled={addCategory.isPending || newLabel.trim().length === 0}
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                className="disabled:opacity-40"
              >
                추가
              </Button>
            </div>
          </div>
        </div>

        {/* 기존 목록 */}
        <Text
          variant="caption"
          color="secondary"
          as="div"
          weight="medium"
          className="mb-1.5 text-[11px]"
        >
          기존 카테고리
        </Text>
        <ul className="flex flex-col gap-2">
          {categories.map((c) => {
            const isBuiltin = (BUILTIN_CATEGORIES as readonly string[]).includes(
              c.slug,
            );
            const isEditing = editingSlug === c.slug;
            const count = counts.get(c.slug) ?? 0;
            return (
              <li
                key={c.slug}
                className="rounded-md px-3 py-2"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                }}
              >
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void saveEdit(c);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                      placeholder="카테고리 이름을 입력하세요"
                      autoFocus
                      className="rounded-md px-2 py-1.5 text-sm outline-none"
                      style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <SwatchPicker
                      selected={editColor}
                      onChange={setEditColor}
                    />
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => saveEdit(c)}
                        leftIcon={<Check className="h-3 w-3" />}
                      >
                        저장
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={cancelEdit}
                        style={{
                          backgroundColor: "var(--bg-surface-hover)",
                          color: "var(--text-primary)",
                        }}
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: c.color ?? "var(--cat-other)",
                      }}
                    />
                    <Text
                      variant="body"
                      as="span"
                      className="flex-1 truncate text-sm"
                    >
                      {c.label}
                    </Text>
                    {isBuiltin ? (
                      <Text
                        variant="caption"
                        color="muted"
                        as="span"
                        className="text-[10px]"
                      >
                        기본
                      </Text>
                    ) : null}
                    <Text
                      variant="caption"
                      color="muted"
                      as="span"
                      className="text-[11px]"
                    >
                      {count}개
                    </Text>
                    <Button
                      variant="icon"
                      onClick={() => startEdit(c)}
                      title="수정"
                      aria-label="수정"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!isBuiltin ? (
                      <Button
                        variant="icon"
                        onClick={() => setDeleteTarget(c)}
                        title="삭제"
                        aria-label="삭제"
                        style={{ color: "var(--accent-red)" }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {addError ? (
          <Text
            variant="caption"
            as="p"
            className="mt-3"
            style={{ color: "var(--accent-red-text)" }}
          >
            {addError}
          </Text>
        ) : null}
      </div>

      {/* 삭제 confirm — 별도 stack 모달 대신 inline 카드 (Modal 중첩 z 충돌 회피) */}
      {deleteTarget ? (
        <div
          className="flex shrink-0 flex-col gap-2 px-5 py-3"
          style={{
            borderTop: "1px solid var(--border-default)",
            backgroundColor: "var(--accent-red-bg)",
          }}
        >
          <Text variant="body" weight="semibold" as="p">
            "{deleteTarget.label}" 카테고리를 삭제할까요?
          </Text>
          <Text
            variant="caption"
            color="secondary"
            as="p"
            className="text-[11px] leading-relaxed"
          >
            이 카테고리의 카드 {counts.get(deleteTarget.slug) ?? 0}개는 "기타"
            카테고리로 옮겨집니다. 카드 자체는 삭제되지 않습니다.
          </Text>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              style={{
                backgroundColor: "var(--bg-surface-hover)",
                color: "var(--text-primary)",
              }}
            >
              취소
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDelete}
              disabled={deleteCategory.isPending}
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              className="disabled:opacity-50"
            >
              {deleteCategory.isPending ? "삭제 중…" : "삭제"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function SwatchPicker({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {COLOR_SWATCHES.map((s) => {
        const active = s.var === selected;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.var)}
            className="flex h-6 w-6 items-center justify-center rounded-full transition"
            style={{
              backgroundColor: s.var,
              border: active
                ? "2px solid var(--text-primary)"
                : "2px solid transparent",
              outline: active ? "1px solid var(--bg-surface)" : "none",
              outlineOffset: "-3px",
            }}
            aria-label={`색상 ${s.id}`}
            aria-pressed={active}
          >
            {active ? (
              <Check
                className="h-3 w-3"
                style={{ color: "var(--bg-surface)" }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
