import type { ReactNode } from "react";

type Props = {
  left: ReactNode;
  right?: ReactNode;
  secondaryRow?: ReactNode;
};

export function PageHeader({ left, right, secondaryRow }: Props) {
  return (
    <div
      className="sticky z-10 backdrop-blur lg:top-0"
      style={{
        top: "var(--app-header-h)",
        backgroundColor: "var(--bg-overlay)",
        borderBottom: "1px solid var(--border-default)",
      }}
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
