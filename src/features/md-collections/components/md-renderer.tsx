/**
 * Markdown 渲染器组件
 * P2-007: 专业阅读视图 - 支持代码高亮、GFM、目录锚点
 * Spec: md-reader-upgrade / REQ-2 - 排版优化
 * Spec: md-reader-upgrade / REQ-7 - 图片查看增强
 * Spec: md-reader-upgrade / REQ-10 - 文字高亮
 */

"use client";

import {
  memo,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
} from "react";
import dynamic from "next/dynamic";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { cn } from "@/lib/utils";
import { Copy, Check, Link as LinkIcon, ZoomIn } from "lucide-react";
import {
  TYPOGRAPHY_BASE,
  FONT_STACKS,
  typographyToCssVariables,
} from "../lib/reader/typography";
import { restoreRange, fuzzyMatchAnchor } from "../lib/reader/highlight-utils";
import { getHighlightStyle } from "../lib/reader/highlight-config";
import type {
  FontSizePreset,
  ImageInfo,
  TextHighlight,
  HighlightColor,
  HighlightToolbarPosition,
} from "../types/reader";

// 普鲁士蓝主题色
const PRUSSIAN_BLUE = "#00324D";

// 动态导入 prism-light 构建（按需注册 16 种常用语言，减少 300-500 kB）
const SyntaxHighlighter = dynamic(
  () =>
    import("../lib/syntax-highlighter").then((mod) => ({
      default: mod.SyntaxHighlighter,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse">
        加载中...
      </div>
    ),
  },
);

// 样式通过共享模块 ESM 导入（替代动态 CJS 导入）
let oneDark: Record<string, React.CSSProperties> = {};
let oneLight: Record<string, React.CSSProperties> = {};

if (typeof window !== "undefined") {
  import("../lib/syntax-highlighter").then((mod) => {
    oneDark = mod.darkTheme;
    oneLight = mod.lightTheme;
  });
}

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
  /** 字体大小预设 */
  fontSize?: FontSizePreset;
  /** 是否应用阅读排版优化 */
  enableTypography?: boolean;
  /** 图片点击回调（用于打开 Lightbox） */
  onImageClick?: (image: ImageInfo, index: number) => void;
  /** 图片列表收集完成回调 */
  onImagesCollected?: (images: ImageInfo[]) => void;
  /** 高亮列表（REQ-10） */
  highlights?: TextHighlight[];
  /** 高亮点击回调（用于编辑高亮） */
  onHighlightClick?: (
    highlight: TextHighlight,
    position: HighlightToolbarPosition,
  ) => void;
  /** 内容容器 ref（用于高亮定位） */
  contentRef?: React.RefObject<HTMLElement>;
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
  fontSize = "medium",
  enableTypography = true,
  onImageClick,
  onImagesCollected,
  highlights = [],
  onHighlightClick,
  contentRef: externalContentRef,
}: MdRendererProps) {
  // 图片收集器
  const imagesRef = useRef<ImageInfo[]>([]);
  const imageIndexRef = useRef(0);

  // 内部容器 ref（如果外部没有提供）
  const internalContentRef = useRef<HTMLElement>(null);
  const contentRef = externalContentRef || internalContentRef;

  // 已应用的高亮 mark 元素及其事件监听器
  const highlightMarksRef = useRef<Map<string, HTMLElement>>(new Map());
  // 存储事件监听器引用以便清理
  const highlightListenersRef = useRef<Map<string, () => void>>(new Map());

  // 重置图片收集器（当内容变化时）
  useEffect(() => {
    imagesRef.current = [];
    imageIndexRef.current = 0;
  }, [content]);

  // ============================================
  // 高亮应用逻辑 (REQ-10)
  // ============================================

  /**
   * 清除所有已应用的高亮（包括事件监听器）
   */
  const clearHighlightMarks = useCallback(() => {
    // 移除所有事件监听器
    highlightListenersRef.current.forEach((listener, id) => {
      const mark = highlightMarksRef.current.get(id);
      if (mark) {
        mark.removeEventListener("click", listener);
      }
    });
    highlightListenersRef.current.clear();

    // 移除所有 mark 元素
    highlightMarksRef.current.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
      }
    });
    highlightMarksRef.current.clear();
  }, []);

  /**
   * 应用单个高亮
   * @returns 创建的 mark 元素，失败返回 null
   */
  const applyHighlight = useCallback(
    (highlight: TextHighlight): HTMLElement | null => {
      const container = contentRef.current;
      if (!container) return null;

      // 尝试恢复 Range
      let range = restoreRange(
        container,
        highlight.start_offset,
        highlight.end_offset,
      );

      // 如果失败，尝试模糊匹配
      if (!range && highlight.anchor_text) {
        const fuzzyResult = fuzzyMatchAnchor(
          container,
          highlight.anchor_text,
          highlight.start_offset,
        );
        if (fuzzyResult) {
          range = restoreRange(
            container,
            fuzzyResult.startOffset,
            fuzzyResult.endOffset,
          );
        }
      }

      if (!range) return null;

      try {
        // 创建 mark 元素
        const mark = document.createElement("mark");
        mark.dataset.highlightId = highlight.id;
        mark.dataset.highlightColor = highlight.color;

        // 应用样式
        const style = getHighlightStyle(highlight.color as HighlightColor);
        Object.assign(mark.style, style);

        // 添加点击事件（保存引用以便清理）
        if (onHighlightClick) {
          const clickHandler = (e: Event) => {
            e.stopPropagation();
            const rect = mark.getBoundingClientRect();
            onHighlightClick(highlight, {
              x: rect.left + rect.width / 2,
              y: rect.top,
            });
          };
          mark.addEventListener("click", clickHandler);
          // 保存事件监听器引用
          highlightListenersRef.current.set(
            highlight.id,
            clickHandler as () => void,
          );
        }

        // 包裹选中内容
        range.surroundContents(mark);

        return mark;
      } catch {
        // surroundContents 可能会失败（如跨多个元素）
        // 这种情况需要更复杂的处理，暂时跳过
        return null;
      }
    },
    [contentRef, onHighlightClick],
  );

  /**
   * 应用所有高亮的核心逻辑
   */
  const applyAllHighlights = useCallback(() => {
    // 先清除旧的高亮
    clearHighlightMarks();

    // 应用新的高亮（按 start_offset 排序，从后往前应用避免偏移变化）
    const sortedHighlights = [...highlights].sort(
      (a, b) => b.start_offset - a.start_offset,
    );

    for (const highlight of sortedHighlights) {
      const mark = applyHighlight(highlight);
      if (mark) {
        highlightMarksRef.current.set(highlight.id, mark);
      }
    }
  }, [highlights, applyHighlight, clearHighlightMarks]);

  /**
   * 使用 MutationObserver 监听 DOM 渲染完成后应用高亮
   * 替代不可靠的硬编码延迟
   */
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    // 如果没有高亮需要应用，直接返回
    if (highlights.length === 0) {
      clearHighlightMarks();
      return;
    }

    // 标记是否已经应用过高亮
    let hasApplied = false;
    let applyTimer: NodeJS.Timeout | null = null;

    /**
     * 防抖应用高亮
     * 等待 DOM 稳定后再应用，避免频繁触发
     */
    const debouncedApply = () => {
      if (applyTimer) {
        clearTimeout(applyTimer);
      }
      applyTimer = setTimeout(() => {
        if (!hasApplied) {
          hasApplied = true;
          applyAllHighlights();
        }
      }, 50); // 短暂防抖，等待批量 DOM 更新完成
    };

    // 创建 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver((mutations) => {
      // 检查是否有实质性的内容变化
      const hasContentChange = mutations.some(
        (mutation) =>
          mutation.type === "childList" &&
          (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0),
      );

      if (hasContentChange) {
        // 重置已应用标记，允许重新应用
        hasApplied = false;
        debouncedApply();
      }
    });

    // 监听容器内的 DOM 变化
    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    // 初始应用（使用 requestIdleCallback 或 setTimeout 回退）
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => {
        if (!hasApplied) {
          hasApplied = true;
          applyAllHighlights();
        }
      });
    } else {
      // 浏览器不支持 requestIdleCallback 时使用 setTimeout 回退
      setTimeout(() => {
        if (!hasApplied) {
          hasApplied = true;
          applyAllHighlights();
        }
      }, 100);
    }

    // 清理函数
    return () => {
      observer.disconnect();
      if (applyTimer) {
        clearTimeout(applyTimer);
      }
    };
  }, [
    highlights,
    content,
    applyAllHighlights,
    clearHighlightMarks,
    contentRef,
  ]);

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

  // 排版样式配置
  const typographyStyles = useMemo<CSSProperties>(() => {
    if (!enableTypography) return {};

    const cssVars = typographyToCssVariables(fontSize);
    const styles: Record<string, string> = {};

    // 转换 CSS 变量为 React style 对象
    for (const [key, value] of Object.entries(cssVars)) {
      styles[key] = value;
    }

    return {
      ...styles,
      lineHeight: TYPOGRAPHY_BASE.lineHeight,
      maxWidth: TYPOGRAPHY_BASE.maxWidth,
      fontFamily: FONT_STACKS.readingCn,
    } as CSSProperties;
  }, [enableTypography, fontSize]);

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
      img: ({ src, alt }: { src?: string; alt?: string }) => {
        // 收集图片信息
        const imageInfo: ImageInfo = { src: src || "", alt };
        const currentIndex = imagesRef.current.findIndex(
          (img) => img.src === src,
        );
        let index: number;

        if (currentIndex === -1 && src) {
          // 新图片，添加到列表
          index = imagesRef.current.length;
          imagesRef.current.push(imageInfo);

          // 异步通知图片列表更新（避免渲染期间调用 setState）
          if (onImagesCollected) {
            setTimeout(() => {
              onImagesCollected([...imagesRef.current]);
            }, 0);
          }
        } else {
          index = currentIndex;
        }

        const handleClick = () => {
          if (onImageClick && src) {
            onImageClick(imageInfo, index);
          }
        };

        return (
          <span className="group relative block my-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt || ""}
              className={cn(
                "max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700",
                onImageClick &&
                  "cursor-zoom-in hover:opacity-90 transition-opacity",
              )}
              loading="lazy"
              onClick={handleClick}
            />
            {alt && (
              <span className="block mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
                {alt}
              </span>
            )}
            {/* 放大图标提示 */}
            {onImageClick && (
              <span className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="w-4 h-4" />
              </span>
            )}
          </span>
        );
      },

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
    [
      showLineNumbers,
      maxCodeHeight,
      resolvedTheme,
      onImageClick,
      onImagesCollected,
    ],
  );

  return (
    <article
      ref={contentRef as React.RefObject<HTMLElement>}
      className={cn(
        "prose prose-gray dark:prose-invert max-w-none",
        "prose-headings:scroll-mt-20", // 锚点滚动偏移
        enableTypography && [
          // 阅读排版优化
          "prose-p:my-[1.5em]", // 段落间距
          "prose-p:leading-[1.8]", // 行高
          "prose-li:leading-[1.8]", // 列表行高
          "prose-headings:mt-[2em]", // 标题上间距
          "prose-headings:mb-[1em]", // 标题下间距
          "mx-auto", // 居中
        ],
        className,
      )}
      style={enableTypography ? typographyStyles : undefined}
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
