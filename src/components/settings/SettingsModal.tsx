import { useEffect, useState } from "react";
import { X, Keyboard, FolderOpen, Archive, HelpCircle } from "lucide-react";
import { ShortcutsSection } from "./ShortcutsSection";
import { HelpSection } from "./HelpSection";
import { VaultSection } from "./VaultSection";
import { BackupSection } from "./BackupSection";

export type SettingsSection = "vault" | "backup" | "shortcuts" | "help";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSection;
};

const SECTIONS: Array<{ id: SettingsSection; label: string; icon: typeof Keyboard }> = [
  { id: "vault", label: "Vault 폴더", icon: FolderOpen },
  { id: "backup", label: "백업", icon: Archive },
  { id: "shortcuts", label: "단축키", icon: Keyboard },
  { id: "help", label: "도움말", icon: HelpCircle },
];

export function SettingsModal({ isOpen, onClose, initialSection = "vault" }: Props) {
  const [section, setSection] = useState<SettingsSection>(initialSection);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      // backdrop close: mousedown 시작점이 backdrop 자체일 때만. inner 안에서 시작한
      // 드래그가 바깥에서 mouseup 되어 click 이 backdrop 으로 발사되는 케이스 차단.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      role="dialog"
      aria-modal="true"
      aria-label="설정"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-3xl overflow-hidden rounded-xl"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          height: "min(560px, 80vh)",
        }}
      >
        <aside
          className="flex w-44 shrink-0 flex-col"
          style={{
            background: "var(--bg-base)",
            borderRight: "1px solid var(--border-default)",
          }}
        >
          <div
            className="flex h-12 shrink-0 items-center px-4 text-sm font-semibold"
            style={{
              color: "var(--text-primary)",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            설정
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const active = id === section;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  aria-current={active ? "page" : undefined}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition"
                  style={{
                    background: active ? "var(--bg-surface)" : "transparent",
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.5} />
                  {label}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header
            className="flex h-12 shrink-0 items-center justify-between px-5"
            style={{ borderBottom: "1px solid var(--border-default)" }}
          >
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {SECTIONS.find((s) => s.id === section)?.label}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              title="닫기  ESC"
              className="flex h-7 w-7 items-center justify-center rounded-md transition"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {section === "vault" ? (
              <VaultSection onAfterSwitch={onClose} />
            ) : section === "backup" ? (
              <BackupSection />
            ) : section === "shortcuts" ? (
              <ShortcutsSection />
            ) : (
              <HelpSection />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
