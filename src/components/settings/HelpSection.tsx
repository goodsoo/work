type Example = { inputs: string[]; output: string };

const DATE_EXAMPLES: Example[] = [
  { inputs: ["오늘", "내일", "어제"], output: "자연어" },
  { inputs: ["월", "금요일"], output: "가장 최근 그 요일" },
  { inputs: ["2026.05.04", "2026/05/04", "2026-05-04"], output: "전체 날짜" },
  { inputs: ["5/4", "5.4", "5 4"], output: "올해 5월 4일" },
  { inputs: ["20260504", "260504"], output: "압축 yyyymmdd / yymmdd" },
  { inputs: ["2026년 5월 4일"], output: "한글 단위" },
];

const TIME_EXAMPLES: Example[] = [
  { inputs: ["18:30", "18시 30분"], output: "기본" },
  { inputs: ["오후 6:30", "6:30 PM"], output: "12시간제" },
  { inputs: ["1830", "0930"], output: "압축 HHmm" },
];

export function HelpSection() {
  return (
    <div className="space-y-5">
      <Block title="날짜 입력" examples={DATE_EXAMPLES} />
      <Block title="시간 입력" examples={TIME_EXAMPLES} />
    </div>
  );
}

function Block({ title, examples }: { title: string; examples: Example[] }) {
  return (
    <section>
      <h3
        className="mb-2 text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </h3>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-6">
        {examples.map((e, i) => (
          <li
            key={i}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
            style={{ borderBottom: "1px solid var(--border-default)" }}
          >
            <div className="flex flex-wrap items-center gap-1">
              {e.inputs.map((s, j) => (
                <code
                  key={j}
                  className="rounded px-1.5 py-0.5 text-xs"
                  style={{
                    background: "var(--bg-base)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-subtle)",
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  }}
                >
                  {s}
                </code>
              ))}
            </div>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {e.output}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
