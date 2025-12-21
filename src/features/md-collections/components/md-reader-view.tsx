/**
 * MD 专业阅读视图
 * P2-007: Markdown 内容收藏 - 沉浸式阅读体验
 */

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MdRenderer } from "./md-renderer";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Clock,
  Calendar,
  Tag,
  ChevronUp,
  List,
  Maximize2,
  Minimize2,
  Type,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MdCollection } from "../types";
import { CONTENT_TYPE_CONFIG, DEFAULT_CONTENT_TYPE_CONFIG } from "../constants";
import { useSafeSidebar, SIDEBAR_WIDTH } from "@/contexts/sidebar-context";

// 普鲁士蓝主题色
const PRUSSIAN_BLUE = "#00324D";

// 目录宽度配置
const TOC_WIDTH = {
  min: 180,
  max: 400,
  default: 256,
  storageKey: "md-reader-toc-width",
};

interface MdReaderViewProps {
  /** MD 收藏数据 */
  collection: MdCollection;
  /** 返回操作 */
  onBack?: () => void;
  /** 自定义类名 */
  className?: string;
}

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

/**
 * 解析 Markdown 目录
 */
function parseTableOfContents(content: string): TOCItem[] {
  const headingRegex = /^(#{1,4})\s+(.+)$/gm;
  const items: TOCItem[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    // 生成 slug（与 rehype-slug 保持一致）
    const id = text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff-]/g, "")
      .replace(/\s+/g, "-");

    items.push({ id, text, level });
  }

  return items;
}

/**
 * MD 专业阅读视图
 */
export function MdReaderView({
  collection,
  onBack,
  className,
}: MdReaderViewProps) {
  // 获取全局侧边栏宽度（用于计算目录位置）
  const sidebarContext = useSafeSidebar();
  const globalSidebarWidth =
    sidebarContext?.displayWidth ?? SIDEBAR_WIDTH.expanded;

  // 阅读设置状态
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">(
    "medium",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 目录宽度状态（从 localStorage 初始化）
  const [tocWidth, setTocWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const savedWidth = localStorage.getItem(TOC_WIDTH.storageKey);
      if (savedWidth) {
        const width = parseInt(savedWidth, 10);
        if (width >= TOC_WIDTH.min && width <= TOC_WIDTH.max) {
          return width;
        }
      }
    }
    return TOC_WIDTH.default;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // 保存目录宽度到 localStorage
  useEffect(() => {
    if (!isResizing) {
      localStorage.setItem(TOC_WIDTH.storageKey, tocWidth.toString());
    }
  }, [tocWidth, isResizing]);

  // 处理拖拽调整宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      if (newWidth >= TOC_WIDTH.min && newWidth <= TOC_WIDTH.max) {
        setTocWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // 解析目录
  const tableOfContents = useMemo(
    () => parseTableOfContents(collection.raw_content),
    [collection.raw_content],
  );

  // 滚动容器 ref（自身作为滚动容器，让 sticky header 正常工作）
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 监听滚动进度（直接监听自身容器）
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight =
        scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      setScrollProgress(progress);
      setShowBackToTop(scrollTop > 300);
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  // 全屏切换
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 滚动到顶部
  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // 滚动到锚点
  const scrollToHeading = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // 内容类型配置
  const contentTypeConfig =
    (collection.content_type && CONTENT_TYPE_CONFIG[collection.content_type]) ??
    DEFAULT_CONTENT_TYPE_CONFIG;

  // 字体大小映射
  const fontSizeClass = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg",
  };

  // 是否显示左侧目录
  const hasTOC = tableOfContents.length > 0;

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "relative h-full overflow-y-auto bg-white dark:bg-gray-950",
        className,
      )}
    >
      {/* 阅读进度条 */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200 dark:bg-gray-800">
        <div
          className="h-full transition-all duration-150"
          style={{
            width: `${scrollProgress}%`,
            backgroundColor: PRUSSIAN_BLUE,
          }}
        />
      </div>

      {/* 顶部工具栏 */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* 返回按钮 */}
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-gray-600 dark:text-gray-400"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回
              </Button>
            )}
          </div>

          {/* 工具按钮 */}
          <div className="flex items-center gap-1">
            {/* 字体大小 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const sizes: ("small" | "medium" | "large")[] = [
                  "small",
                  "medium",
                  "large",
                ];
                const currentIndex = sizes.indexOf(fontSize);
                setFontSize(sizes[(currentIndex + 1) % sizes.length]);
              }}
              title={`字体大小: ${fontSize}`}
            >
              <Type className="w-4 h-4" />
            </Button>

            {/* 全屏 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              title={isFullscreen ? "退出全屏" : "全屏阅读"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* 左侧目录 - fixed 定位，不受内容滚动影响 */}
      {hasTOC && (
        <aside
          ref={sidebarRef}
          className="hidden lg:block fixed top-28 h-[calc(100%-7rem)] overflow-y-auto border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 z-30"
          style={{ width: tocWidth, left: globalSidebarWidth }}
        >
          <div className="p-4">
            <h3
              className="font-medium mb-3 flex items-center gap-2"
              style={{ color: PRUSSIAN_BLUE }}
            >
              <List className="w-4 h-4" />
              目录
            </h3>
            <nav className="space-y-1">
              {tableOfContents.map((item, index) => (
                <button
                  key={`${item.id}-${index}`}
                  onClick={() => scrollToHeading(item.id)}
                  className={cn(
                    "block w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors",
                    "hover:bg-[#00324D]/10 dark:hover:bg-[#00324D]/30",
                    "text-gray-600 dark:text-gray-400",
                  )}
                  style={{
                    paddingLeft: `${(item.level - 1) * 12 + 12}px`,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = PRUSSIAN_BLUE)
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.color = "")}
                >
                  {item.text}
                </button>
              ))}
            </nav>
          </div>

          {/* 拖动调节把手 */}
          <div
            className={cn(
              "absolute top-0 right-0 w-1 h-full cursor-col-resize group",
              "hover:bg-[#00324D]/30 transition-colors",
              isResizing && "bg-[#00324D]/50",
            )}
            onMouseDown={handleMouseDown}
          >
            <div className="absolute top-1/2 -translate-y-1/2 right-0 w-4 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-3 h-3 text-gray-400" />
            </div>
          </div>
        </aside>
      )}

      {/* 主内容区 - 使用 margin-left 为目录留出空间 */}
      <main
        className={cn("flex-1 px-4 py-8 max-w-4xl mx-auto")}
        style={hasTOC ? { marginLeft: tocWidth } : undefined}
      >
        {/* 文章头部 */}
        <header className="mb-8">
          {/* 内容类型标签 */}
          <span
            className={cn(
              "inline-block px-2 py-1 text-xs font-medium rounded mb-4",
              contentTypeConfig.color,
            )}
          >
            {contentTypeConfig.label}
          </span>

          {/* 标题 */}
          <h1
            className="text-3xl md:text-4xl font-bold mb-4 leading-tight dark:text-gray-100"
            style={{ color: PRUSSIAN_BLUE }}
          >
            {collection.title}
          </h1>

          {/* 元信息 */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            {/* 字数 */}
            <span className="flex items-center gap-1">
              <Type className="w-4 h-4" />
              {collection.word_count?.toLocaleString() || 0} 字
            </span>

            {/* 阅读时间 */}
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {collection.reading_time_minutes || 1} 分钟阅读
            </span>

            {/* 创建时间 */}
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(collection.created_at).toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>

          {/* AI 摘要 */}
          {collection.ai_summary && (
            <div className="mt-6 p-4 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-lg border border-sky-200 dark:border-sky-800">
              <p
                className="text-sm font-medium mb-2"
                style={{ color: PRUSSIAN_BLUE }}
              >
                AI 摘要
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                {collection.ai_summary}
              </p>
            </div>
          )}

          {/* AI 标签 */}
          {collection.ai_tags && collection.ai_tags.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400" />
              {collection.ai_tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* 分隔线 */}
        <hr className="mb-8 border-gray-200 dark:border-gray-800" />

        {/* Markdown 内容 */}
        <div className={fontSizeClass[fontSize]}>
          <MdRenderer content={collection.raw_content} showLineNumbers={true} />
        </div>

        {/* 文章底部 */}
        <footer className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            — 文章结束 —
          </p>
        </footer>
      </main>

      {/* 回到顶部按钮 */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-40 w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center transition-all hover:opacity-90"
          style={{ backgroundColor: PRUSSIAN_BLUE }}
          title="回到顶部"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

export default MdReaderView;
