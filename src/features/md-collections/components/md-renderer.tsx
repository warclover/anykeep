/**
 * Markdown 渲染器组件
 * P2-007: 专业阅读视图 - 支持代码高亮、GFM、目录锚点
 */

"use client";

import { memo, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { cn } from "@/lib/utils";
import { Copy, Check, Link as LinkIcon } from "lucide-react";

// 普鲁士蓝主题色
const PRUSSIAN_BLUE = "#00324D";

// 动态导入 SyntaxHighlighter 避免 SSR 问题
const SyntaxHighlighter = dynamic(
  () => import("react-syntax-highlighter").then((mod) => mod.Prism),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse">
        加载中...
      </div>
    ),
  },
);

// 动态导入样式（使用 vscDarkPlus 和 vs 替代 oneDark/oneLight）
let darkTheme: Record<string, React.CSSProperties> = {};
let lightTheme: Record<string, React.CSSProperties> = {};

if (typeof window !== "undefined") {
  import("react-syntax-highlighter/dist/cjs/styles/prism").then((styles) => {
    darkTheme = styles.vscDarkPlus;
    lightTheme = styles.vs;
  });
}

// 为兼容性导出别名
const oneDark = darkTheme;
const oneLight = lightTheme;

interface MdRendererProps {
  /** Markdown 内容 */
  content: string;
  /** 自定义类名 */
  className?: string;
  /** 主题模式 */
  theme?: "light" | "dark" | "auto";
  /** 是否显示行号 */
  showLineNumbers?: boolean;
  /** 代码块最大高度 */
  maxCodeHeight?: number;
}

/**
 * 代码块组件 - 支持复制和语法高亮
 */
function CodeBlock({
  language,
  value,
  showLineNumbers,
  maxCodeHeight,
  theme,
}: {
  language: string;
  value: string;
  showLineNumbers: boolean;
  maxCodeHeight?: number;
  theme: "light" | "dark";
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 静默失败
    }
  }, [value]);

  const syntaxStyle = theme === "dark" ? oneDark : oneLight;

  return (
    <div className="group relative my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* 语言标签和复制按钮 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
          {language || "text"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          title="复制代码"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-500">已复制</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                复制
              </span>
            </>
          )}
        </button>
      </div>

      {/* 代码内容 */}
      <div
        className="overflow-auto"
        style={maxCodeHeight ? { maxHeight: maxCodeHeight } : undefined}
      >
        <SyntaxHighlighter
          language={language || "text"}
          style={syntaxStyle}
          showLineNumbers={showLineNumbers}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "0.875rem",
            lineHeight: 1.6,
          }}
          lineNumberStyle={{
            minWidth: "2.5em",
            paddingRight: "1em",
            color: theme === "dark" ? "#6b7280" : "#9ca3af",
            userSelect: "none",
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

/**
 * 内联代码组件
 */
function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono text-emerald-600 dark:text-emerald-400">
      {children}
    </code>
  );
}

/**
 * Markdown 渲染器
 */
export const MdRenderer = memo(function MdRenderer({
  content,
  className,
  theme = "auto",
  showLineNumbers = true,
  maxCodeHeight = 500,
}: MdRendererProps) {
  // 解析主题
  const resolvedTheme = useMemo(() => {
    if (theme === "auto") {
      // 检测系统主题
      if (typeof window !== "undefined") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      return "light";
    }
    return theme;
  }, [theme]);

  // Markdown 组件配置
  const components = useMemo(
    () => ({
      // 代码块
      code({
        inline,
        className: codeClassName,
        children,
        ...props
      }: {
        inline?: boolean;
        className?: string;
        children?: React.ReactNode;
      }) {
        const match = /language-(\w+)/.exec(codeClassName || "");
        const language = match ? match[1] : "";
        const value = String(children).replace(/\n$/, "");

        if (!inline && (match || value.includes("\n"))) {
          return (
            <CodeBlock
              language={language}
              value={value}
              showLineNumbers={showLineNumbers}
              maxCodeHeight={maxCodeHeight}
              theme={resolvedTheme}
            />
          );
        }

        return <InlineCode {...props}>{children}</InlineCode>;
      },

      // 标题锚点 - 使用普鲁士蓝主题色
      h1: ({ children, id }: { children: React.ReactNode; id?: string }) => (
        <h1
          id={id}
          className="group flex items-center gap-2 text-3xl font-bold mt-8 mb-4 dark:text-gray-100"
          style={{ color: PRUSSIAN_BLUE }}
        >
          {children}
          {id && <HeadingAnchor id={id} />}
        </h1>
      ),
      h2: ({ children, id }: { children: React.ReactNode; id?: string }) => (
        <h2
          id={id}
          className="group flex items-center gap-2 text-2xl font-bold mt-6 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2 dark:text-gray-100"
          style={{ color: PRUSSIAN_BLUE }}
        >
          {children}
          {id && <HeadingAnchor id={id} />}
        </h2>
      ),
      h3: ({ children, id }: { children: React.ReactNode; id?: string }) => (
        <h3
          id={id}
          className="group flex items-center gap-2 text-xl font-semibold mt-5 mb-2 dark:text-gray-100"
          style={{ color: PRUSSIAN_BLUE }}
        >
          {children}
          {id && <HeadingAnchor id={id} />}
        </h3>
      ),
      h4: ({ children, id }: { children: React.ReactNode; id?: string }) => (
        <h4
          id={id}
          className="group flex items-center gap-2 text-lg font-semibold mt-4 mb-2 dark:text-gray-200"
          style={{ color: PRUSSIAN_BLUE }}
        >
          {children}
          {id && <HeadingAnchor id={id} />}
        </h4>
      ),

      // 段落
      p: ({ children }: { children: React.ReactNode }) => (
        <p className="my-4 leading-7 text-gray-700 dark:text-gray-300">
          {children}
        </p>
      ),

      // 链接
      a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          {children}
        </a>
      ),

      // 列表
      ul: ({ children }: { children: React.ReactNode }) => (
        <ul className="my-4 pl-6 space-y-2 list-disc text-gray-700 dark:text-gray-300">
          {children}
        </ul>
      ),
      ol: ({ children }: { children: React.ReactNode }) => (
        <ol className="my-4 pl-6 space-y-2 list-decimal text-gray-700 dark:text-gray-300">
          {children}
        </ol>
      ),
      li: ({ children }: { children: React.ReactNode }) => (
        <li className="leading-7">{children}</li>
      ),

      // 引用块
      blockquote: ({ children }: { children: React.ReactNode }) => (
        <blockquote className="my-4 pl-4 border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 py-2 italic text-gray-600 dark:text-gray-400">
          {children}
        </blockquote>
      ),

      // 分隔线
      hr: () => <hr className="my-8 border-gray-200 dark:border-gray-700" />,

      // 表格
      table: ({ children }: { children: React.ReactNode }) => (
        <div className="my-4 overflow-x-auto">
          <table className="min-w-full border border-gray-200 dark:border-gray-700">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: { children: React.ReactNode }) => (
        <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>
      ),
      tbody: ({ children }: { children: React.ReactNode }) => (
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {children}
        </tbody>
      ),
      tr: ({ children }: { children: React.ReactNode }) => (
        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
          {children}
        </tr>
      ),
      th: ({ children }: { children: React.ReactNode }) => (
        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700">
          {children}
        </th>
      ),
      td: ({ children }: { children: React.ReactNode }) => (
        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
          {children}
        </td>
      ),

      // 图片
      // 注意：此处使用原生 img 而非 next/image，原因：
      // 1. Markdown 内容包含外部图片，域名未知无法预配置
      // 2. 图片尺寸未知，无法提供 width/height 属性
      // 3. 用户生成内容的图片 URL 不可预测
      img: ({ src, alt }: { src?: string; alt?: string }) => (
        <span className="block my-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt || ""}
            className="max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700"
            loading="lazy"
          />
          {alt && (
            <span className="block mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
              {alt}
            </span>
          )}
        </span>
      ),

      // 任务列表（GFM）
      input: ({ type, checked }: { type?: string; checked?: boolean }) => {
        if (type === "checkbox") {
          return (
            <input
              type="checkbox"
              checked={checked}
              disabled
              className="mr-2 rounded border-gray-300 dark:border-gray-600 text-emerald-500 focus:ring-emerald-500"
            />
          );
        }
        return <input type={type} />;
      },
    }),
    [showLineNumbers, maxCodeHeight, resolvedTheme],
  );

  return (
    <article
      className={cn(
        "prose prose-gray dark:prose-invert max-w-none",
        "prose-headings:scroll-mt-20", // 锚点滚动偏移
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSanitize,
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: "wrap" }],
        ]}
        components={components as Partial<Components>}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
});

/**
 * 标题锚点链接
 */
function HeadingAnchor({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 静默失败
    }
  }, [id]);

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400"
      style={{ color: copied ? undefined : undefined }}
      onMouseEnter={(e) =>
        !copied && (e.currentTarget.style.color = PRUSSIAN_BLUE)
      }
      onMouseLeave={(e) => !copied && (e.currentTarget.style.color = "")}
      title="复制链接"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <LinkIcon className="w-4 h-4" />
      )}
    </button>
  );
}

export default MdRenderer;
