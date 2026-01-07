/**
 * 可折叠代码块组件
 *
 * 用于长代码/JSON 内容的折叠展示
 * - 默认折叠超过指定行数的内容
 * - 提供展开/折叠切换按钮
 * - 显示剩余行数提示
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

"use client";

import { memo, useState, useMemo, useCallback, useRef } from "react";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CollapsibleCodeBlockProps {
  /** 代码内容 */
  children: React.ReactNode;
  /** 语言类型（用于标题显示） */
  language?: string;
  /** 折叠阈值（行数） */
  collapseThreshold?: number;
  /** 折叠时显示的行数 */
  visibleLines?: number;
  /** 是否为用户消息（影响颜色主题） */
  isUser?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 可折叠代码块
 *
 * 当内容超过阈值时自动折叠，提供展开/折叠按钮
 */
export const CollapsibleCodeBlock = memo(function CollapsibleCodeBlock({
  children,
  language,
  collapseThreshold = 15,
  visibleLines = 10,
  isUser = false,
  className,
}: CollapsibleCodeBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const contentRef = useRef<HTMLPreElement>(null);

  // 提取纯文本内容
  const textContent = useMemo(() => {
    if (typeof children === "string") return children;
    // 从 React 节点中提取文本
    const extractText = (node: React.ReactNode): string => {
      if (typeof node === "string") return node;
      if (typeof node === "number") return String(node);
      if (!node) return "";
      if (Array.isArray(node)) return node.map(extractText).join("");
      if (typeof node === "object" && "props" in node) {
        return extractText((node as React.ReactElement).props.children);
      }
      return "";
    };
    return extractText(children);
  }, [children]);

  // 计算行数
  const lines = useMemo(() => textContent.split("\n"), [textContent]);
  const totalLines = lines.length;
  const shouldCollapse = totalLines > collapseThreshold;
  const hiddenLines = totalLines - visibleLines;

  // 处理展开/折叠
  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // 处理复制
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // 静默失败
    }
  }, [textContent]);

  // 语言标签映射
  const languageLabel = useMemo(() => {
    if (!language) return null;
    const labels: Record<string, string> = {
      json: "JSON",
      javascript: "JavaScript",
      typescript: "TypeScript",
      python: "Python",
      html: "HTML",
      css: "CSS",
      sql: "SQL",
      bash: "Bash",
      shell: "Shell",
      yaml: "YAML",
      xml: "XML",
      markdown: "Markdown",
      md: "Markdown",
    };
    return labels[language.toLowerCase()] || language.toUpperCase();
  }, [language]);

  // 折叠状态下显示的内容
  const collapsedContent = useMemo(() => {
    if (isExpanded || !shouldCollapse) return textContent;
    return lines.slice(0, visibleLines).join("\n");
  }, [isExpanded, shouldCollapse, textContent, lines, visibleLines]);

  // 计算折叠高度（基于行数估算）
  const collapsedHeight = useMemo(() => {
    if (!shouldCollapse || isExpanded) return undefined;
    const lineHeight = 20; // 大约每行 20px
    return visibleLines * lineHeight + 24; // 加上 padding
  }, [shouldCollapse, isExpanded, visibleLines]);

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden group",
        isUser ? "bg-white/10" : "bg-gray-50 border border-gray-200",
        className,
      )}
    >
      {/* 顶部工具栏 */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-1.5 text-xs",
          isUser
            ? "bg-white/5 text-white/70"
            : "bg-gray-100 text-gray-500 border-b border-gray-200",
        )}
      >
        <span className="font-medium">
          {languageLabel || "代码"}
          {shouldCollapse && (
            <span className="ml-2 opacity-70">({totalLines} 行)</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {/* 复制按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity",
              isUser ? "hover:bg-white/10" : "hover:bg-gray-200",
            )}
            onClick={handleCopy}
          >
            {isCopied ? (
              <>
                <Check className="size-3 mr-1" />
                已复制
              </>
            ) : (
              <>
                <Copy className="size-3 mr-1" />
                复制
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 代码内容 */}
      <div className="relative">
        <pre
          ref={contentRef}
          className={cn(
            "p-3 text-xs font-mono overflow-x-auto transition-all duration-300",
            isUser ? "text-white/90" : "text-gray-800",
            shouldCollapse && !isExpanded && "overflow-hidden",
          )}
          style={{
            maxHeight:
              shouldCollapse && !isExpanded
                ? `${collapsedHeight || visibleLines * 20 + 24}px`
                : undefined,
          }}
        >
          <code>
            {isExpanded || !shouldCollapse ? children : collapsedContent}
          </code>
        </pre>

        {/* 渐变遮罩 */}
        {shouldCollapse && !isExpanded && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-16 pointer-events-none",
              isUser
                ? "bg-gradient-to-t from-white/10 to-transparent"
                : "bg-gradient-to-t from-gray-50 to-transparent",
            )}
          />
        )}
      </div>

      {/* 展开/折叠按钮 */}
      {shouldCollapse && (
        <div
          className={cn(
            "flex items-center justify-center py-2 cursor-pointer transition-colors",
            isUser
              ? "bg-white/5 hover:bg-white/10 text-white/80"
              : "bg-gray-100 hover:bg-gray-200 text-gray-600",
          )}
          onClick={handleToggle}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="size-4 mr-1" />
              <span className="text-xs font-medium">收起</span>
            </>
          ) : (
            <>
              <ChevronDown className="size-4 mr-1" />
              <span className="text-xs font-medium">
                展开剩余 {hiddenLines} 行
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
});

CollapsibleCodeBlock.displayName = "CollapsibleCodeBlock";

export default CollapsibleCodeBlock;
