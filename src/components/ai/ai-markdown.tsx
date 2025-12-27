/**
 * AI 消息 Markdown 渲染器
 *
 * 专为聊天气泡设计的轻量级 Markdown 渲染组件
 * - 支持标题、列表、粗体、链接等基本语法
 * - 紧凑样式适配糖果色主题
 * - 无代码高亮依赖，快速渲染
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

"use client";

import { memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface AIMarkdownProps {
  /** Markdown 内容 */
  content: string;
  /** 自定义类名 */
  className?: string;
  /** 是否为用户消息（影响链接颜色） */
  isUser?: boolean;
}

/**
 * AI 消息 Markdown 渲染器
 *
 * 专为聊天场景优化，提供清晰的视觉层次
 */
export const AIMarkdown = memo(function AIMarkdown({
  content,
  className,
  isUser = false,
}: AIMarkdownProps) {
  // Markdown 组件配置 - 适配聊天气泡样式
  const components = useMemo<Partial<Components>>(
    () => ({
      // 标题 - 使用相对大小，紧凑间距
      h1: ({ children }) => (
        <h2 className="text-lg font-bold mt-3 mb-2 first:mt-0 border-b border-current/20 pb-1">
          {children}
        </h2>
      ),
      h2: ({ children }) => (
        <h3 className="text-base font-bold mt-3 mb-1.5 first:mt-0">
          {children}
        </h3>
      ),
      h3: ({ children }) => (
        <h4 className="text-sm font-semibold mt-2.5 mb-1 first:mt-0">
          {children}
        </h4>
      ),
      h4: ({ children }) => (
        <h5 className="text-sm font-medium mt-2 mb-1 first:mt-0">{children}</h5>
      ),
      h5: ({ children }) => (
        <h6 className="text-xs font-medium mt-2 mb-1 first:mt-0 uppercase tracking-wide opacity-80">
          {children}
        </h6>
      ),
      h6: ({ children }) => (
        <h6 className="text-xs font-medium mt-1.5 mb-0.5 first:mt-0 opacity-70">
          {children}
        </h6>
      ),

      // 段落 - 紧凑行高
      p: ({ children }) => (
        <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">
          {children}
        </p>
      ),

      // 无序列表
      ul: ({ children }) => (
        <ul className="my-2 first:mt-0 last:mb-0 pl-4 space-y-1 list-disc marker:text-current/50">
          {children}
        </ul>
      ),

      // 有序列表
      ol: ({ children }) => (
        <ol className="my-2 first:mt-0 last:mb-0 pl-4 space-y-1 list-decimal marker:text-current/50">
          {children}
        </ol>
      ),

      // 列表项
      li: ({ children }) => (
        <li className="leading-relaxed pl-1">{children}</li>
      ),

      // 链接 - 根据消息类型调整颜色
      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "underline underline-offset-2 hover:no-underline transition-all",
            isUser
              ? "text-white/90 hover:text-white"
              : "text-purple-600 hover:text-purple-800",
          )}
        >
          {children}
        </a>
      ),

      // 粗体
      strong: ({ children }) => (
        <strong className="font-semibold">{children}</strong>
      ),

      // 斜体
      em: ({ children }) => <em className="italic">{children}</em>,

      // 行内代码
      code: ({ children, className: codeClassName }) => {
        // 检查是否是代码块（有语言标记）
        const isCodeBlock = /language-/.test(codeClassName || "");
        if (isCodeBlock) {
          // 代码块样式
          return (
            <code
              className={cn(
                "block my-2 p-3 rounded-lg text-xs font-mono overflow-x-auto",
                isUser
                  ? "bg-white/10 text-white/90"
                  : "bg-gray-100 text-gray-800",
              )}
            >
              {children}
            </code>
          );
        }
        // 行内代码样式
        return (
          <code
            className={cn(
              "px-1.5 py-0.5 rounded text-sm font-mono",
              isUser
                ? "bg-white/20 text-white"
                : "bg-purple-100 text-purple-700",
            )}
          >
            {children}
          </code>
        );
      },

      // 代码块
      pre: ({ children }) => (
        <pre
          className={cn(
            "my-2 first:mt-0 last:mb-0 rounded-lg overflow-hidden",
            isUser ? "bg-white/10" : "bg-gray-50 border border-gray-200",
          )}
        >
          {children}
        </pre>
      ),

      // 引用块
      blockquote: ({ children }) => (
        <blockquote
          className={cn(
            "my-2 first:mt-0 last:mb-0 pl-3 border-l-2 italic opacity-90",
            isUser ? "border-white/50" : "border-purple-300",
          )}
        >
          {children}
        </blockquote>
      ),

      // 分隔线
      hr: () => <hr className="my-3 border-current/20" />,

      // 表格
      table: ({ children }) => (
        <div className="my-2 first:mt-0 last:mb-0 overflow-x-auto rounded-lg">
          <table
            className={cn(
              "min-w-full text-sm border-collapse",
              isUser ? "border-white/30" : "border-gray-200",
            )}
          >
            {children}
          </table>
        </div>
      ),
      thead: ({ children }) => (
        <thead className={cn(isUser ? "bg-white/10" : "bg-purple-50")}>
          {children}
        </thead>
      ),
      tbody: ({ children }) => <tbody>{children}</tbody>,
      tr: ({ children }) => (
        <tr
          className={cn(
            "border-b",
            isUser ? "border-white/20" : "border-gray-200",
          )}
        >
          {children}
        </tr>
      ),
      th: ({ children }) => (
        <th className="px-2 py-1.5 text-left font-semibold">{children}</th>
      ),
      td: ({ children }) => <td className="px-2 py-1.5">{children}</td>,

      // 删除线
      del: ({ children }) => <del className="opacity-60">{children}</del>,

      // 任务列表复选框
      input: ({ type, checked }) => {
        if (type === "checkbox") {
          return (
            <input
              type="checkbox"
              checked={checked}
              disabled
              className={cn(
                "mr-1.5 rounded",
                isUser ? "accent-white" : "accent-purple-500",
              )}
            />
          );
        }
        return null;
      },
    }),
    [isUser],
  );

  return (
    <div className={cn("ai-markdown", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default AIMarkdown;
