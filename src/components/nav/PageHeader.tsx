import type { ReactNode } from "react";

type Props = {
  /** Left side: title or back button. */
  left: ReactNode;
  /** Right side: action buttons / sort controls. */
  right?: ReactNode;
  /** Optional second row (form, secondary actions). */
  secondaryRow?: ReactNode;
};

/**
 * Sticky per-page header. Pins below the AppShell top bar (which is itself
 * sticky at top:0). The CSS var --app-header-h controls the offset.
 */
export function PageHeader({ left, right, secondaryRow }: Props) {
  return (
    <div
      className="sticky z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90"
      style={{ top: "var(--app-header-h)" }}
    >
      <div className="mx-auto w-full max-w-2xl px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">{left}</div>
          {right ? (
            <div className="flex flex-wrap items-center gap-2">{right}</div>
          ) : null}
        </div>
        {secondaryRow ? <div className="mt-2">{secondaryRow}</div> : null}
      </div>
    </div>
  );
}
