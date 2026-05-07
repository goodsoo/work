import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  content: string;
};

export function MarkdownView({ content }: Props) {
  if (!content.trim()) {
    return (
      <p className="text-sm text-zinc-400">
        본문이 비어있어요. 편집으로 전환해서 적어보세요.
      </p>
    );
  }
  return (
    <div className="markdown-view text-base leading-relaxed text-zinc-900 dark:text-zinc-100">
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
                className="mr-2 inline-block h-3.5 w-3.5 align-middle accent-red-600 dark:accent-red-500"
              />
            ) : (
              <input {...props} />
            ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className={`${className} block rounded bg-zinc-100 p-3 font-mono text-sm dark:bg-zinc-900`}>
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-auto rounded bg-zinc-100 p-3 font-mono text-sm dark:bg-zinc-900">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-zinc-300 pl-4 italic text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="my-6 border-zinc-200 dark:border-zinc-800" />
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-zinc-300 bg-zinc-50 px-2 py-1.5 text-left font-semibold dark:border-zinc-700 dark:bg-zinc-900">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
              {children}
            </td>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          del: ({ children }) => (
            <del className="text-zinc-400 line-through">{children}</del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
