import type { ReactNode } from "react";

type Props = {
  left: ReactNode;
  right?: ReactNode;
  secondaryRow?: ReactNode;
};

export function PageHeader({ left, right, secondaryRow }: Props) {
  return (
    <div
      className="sticky z-10 border-b border-zinc-100 bg-white/90 backdrop-blur lg:top-0 dark:border-zinc-800/50 dark:bg-zinc-950/90"
      style={{ top: "var(--app-header-h)" }}
    >
      <div className="mx-auto w-full max-w-2xl px-5 py-3 lg:max-w-4xl">
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
