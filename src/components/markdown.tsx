import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders Markdown written by staff (course pages, assignments, feedback). Raw HTML is not rendered. */
export function Markdown({ children, size = "base" }: { children: string; size?: "base" | "lg" }) {
  return (
    <div className={`prose prose-slate max-w-none text-body leading-relaxed prose-headings:font-display prose-headings:tracking-tight prose-headings:text-ink prose-a:text-accent prose-a:font-medium hover:prose-a:text-accent-dark prose-code:rounded prose-code:bg-accent-soft prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-navy ${size === "lg" ? "prose-lg" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{children}</a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
