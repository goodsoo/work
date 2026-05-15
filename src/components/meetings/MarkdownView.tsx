import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  content: string;
};

export function MarkdownView({ content }: Props) {
  if (!content.trim()) {
    return (
      <p style={{ color: "var(--text-muted)" }} className="text-sm">
        본문이 비어있어요. 편집으로 전환해서 적어보세요.
      </p>
    );
  }
  return (
    <div
      className="markdown-view text-base leading-relaxed"
      style={{ color: "var(--text-primary)" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 font-serif text-2xl font-bold first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 mb-2 font-serif text-xl font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 font-serif text-lg font-semibold first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-2 whitespace-pre-wrap leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-6">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-6">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          input: (props) =>
            props.type === "checkbox" ? (
              <input
                {...props}
                disabled
                className="mr-2 inline-block h-3.5 w-3.5 align-middle"
                style={{ accentColor: "var(--accent-red)" }}
              />
            ) : (
              <input {...props} />
            ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
              style={{ color: "var(--text-secondary)" }}
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code
                  className={`${className} block rounded p-3 font-mono text-sm`}
                  style={{ backgroundColor: "var(--bg-surface)" }}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded px-1 py-0.5 font-mono text-sm"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--text-primary)",
                }}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre
              className="my-3 overflow-auto rounded p-3 font-mono text-sm"
              style={{ backgroundColor: "var(--bg-surface)" }}
            >
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="my-3 pl-4 italic"
              style={{
                borderLeft: "2px solid var(--border-default)",
                color: "var(--text-secondary)",
              }}
            >
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr
              className="my-6"
              style={{ borderColor: "var(--border-default)" }}
            />
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th
              className="px-2 py-1.5 text-left font-semibold"
              style={{
                borderBottom: "1px solid var(--border-default)",
                backgroundColor: "var(--bg-surface)",
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className="px-2 py-1.5"
              style={{ borderBottom: "1px solid var(--border-default)" }}
            >
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => (
            <del
              className="line-through"
              style={{ color: "var(--text-muted)" }}
            >
              {children}
            </del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
