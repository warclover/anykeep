/**
 * MD 阅读增强代码块组件
 * Spec: md-reader-upgrade / REQ-8
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { CodeBlockEnhancedProps } from "../../types/reader";

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

// 动态导入样式
let darkTheme: Record<string, React.CSSProperties> = {};
let lightTheme: Record<string, React.CSSProperties> = {};

if (typeof window !== "undefined") {
  import("react-syntax-highlighter/dist/cjs/styles/prism").then((styles) => {
    darkTheme = styles.vscDarkPlus;
    lightTheme = styles.vs;
  });
}

/**
 * 默认折叠阈值（行数）
 */
const DEFAULT_COLLAPSE_THRESHOLD = 20;

/**
 * 折叠时显示的行数
 */
const COLLAPSED_LINES = 10;

/**
 * 增强代码块组件
 *
 * 功能：
 * - 长代码块默认折叠（> 20 行）
 * - 展开/折叠动画（300ms）
 * - 复制成功动画（按钮变 ✓，2 秒后恢复）
 * - 语言标签显示（右上角）
 *
 * @example
 * ```tsx
 * <CodeBlockEnhanced
 *   code="const x = 1;\nconst y = 2;\n// ... many lines"
 *   language="typescript"
 *   maxCollapsedLines={20}
 * />
 * ```
 */
export function CodeBlockEnhanced({
  code,
  language,
  maxCollapsedLines = DEFAULT_COLLAPSE_THRESHOLD,
}: CodeBlockEnhancedProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // 计算代码行数
  const lines = useMemo(() => code.split("\n"), [code]);
  const lineCount = lines.length;

  // 是否需要折叠
  const needsCollapse = lineCount > maxCollapsedLines;

  // 折叠后显示的代码
  const displayedCode = useMemo(() => {
    if (!needsCollapse || isExpanded) {
      return code;
    }
    return lines.slice(0, COLLAPSED_LINES).join("\n");
  }, [code, lines, needsCollapse, isExpanded]);

  // 复制代码
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 静默失败
    }
  }, [code]);

  // 切换展开/折叠
  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // 检测系统主题
  const isDarkMode =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  const syntaxStyle = isDarkMode ? darkTheme : lightTheme;

  return (
    <div className="group relative my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* 头部：语言标签 + 复制按钮 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
          {language || "text"}
        </span>
        <div className="flex items-center gap-2">
          {/* 行数显示 */}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {lineCount} 行
          </span>
          {/* 复制按钮 */}
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-1 text-xs transition-all duration-200",
              copied
                ? "text-green-500"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
            )}
            title="复制代码"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>已复制</span>
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
      </div>

      {/* 代码内容区域 */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          needsCollapse && !isExpanded && "max-h-[280px]",
        )}
      >
        <div className="overflow-auto">
          <SyntaxHighlighter
            language={language || "text"}
            style={syntaxStyle}
            showLineNumbers
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
              color: isDarkMode ? "#6b7280" : "#9ca3af",
              userSelect: "none",
            }}
          >
            {displayedCode}
          </SyntaxHighlighter>
        </div>
      </div>

      {/* 折叠渐变遮罩 */}
      {needsCollapse && !isExpanded && (
        <div className="absolute bottom-10 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 dark:from-gray-900 to-transparent pointer-events-none" />
      )}

      {/* 展开/折叠按钮 */}
      {needsCollapse && (
        <button
          onClick={toggleExpand}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2",
            "text-sm text-gray-500 dark:text-gray-400",
            "hover:text-gray-700 dark:hover:text-gray-200",
            "hover:bg-gray-50 dark:hover:bg-gray-800",
            "border-t border-gray-200 dark:border-gray-700",
            "transition-colors duration-200",
          )}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              <span>收起代码</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              <span>展开全部 ({lineCount} 行)</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default CodeBlockEnhanced;
