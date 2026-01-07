/**
 * MD 专业阅读视图
 * P2-007: Markdown 内容收藏 - 沉浸式阅读体验
 * Spec: md-reader-upgrade - 完整功能集成
 *
 * 集成功能：
 * - REQ-1: 主题切换（light/dark/sepia/paper）
 * - REQ-3: 目录同步高亮
 * - REQ-4/5: 阅读进度与位置记忆
 * - REQ-6: 专注模式
 * - REQ-7: 图片放大（Lightbox）
 * - REQ-9: 键盘导航
 * - REQ-10: 文字高亮
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
  Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MdCollection } from "../types";
import type {
  TOCItem,
  KeyboardShortcut,
  TextHighlight,
  HighlightToolbarPosition,
} from "../types/reader";
import { CONTENT_TYPE_CONFIG, DEFAULT_CONTENT_TYPE_CONFIG } from "../constants";

// 阅读器组件导入
import {
  ReaderThemeProvider,
  useReaderThemeContext,
  ThemeSwitcher,
  FocusModeProvider,
  FocusModeContainer,
  FocusModeToggle,
  FocusModeToolbar,
  useFocusModeContext,
  HighlightProvider,
  HighlightToolbar,
  useHighlightContext,
  PositionRestorePrompt,
  ReadingProgressCompact,
  ImageLightbox,
  useImageLightbox,
  KeyboardNavHelp,
} from "./reader";

// 阅读器 Hooks 导入
import {
  useTOCSync,
  useReadingPosition,
  useKeyboardNav,
} from "../hooks/reader";

// ============================================
// 常量
// ============================================

// 目录宽度配置
const TOC_WIDTH = {
  min: 180,
  max: 400,
  default: 256,
  storageKey: "md-reader-toc-width",
};

// ============================================
// Props 类型
// ============================================

interface MdReaderViewProps {
  /** MD 收藏数据 */
  collection: MdCollection;
  /** 返回操作 */
  onBack?: () => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 工具函数
// ============================================

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

// ============================================
// 内部阅读器组件
// ============================================

interface InternalReaderProps {
  collection: MdCollection;
  onBack?: () => void;
  className?: string;
  contentRef: React.RefObject<HTMLDivElement>;
}

/**
 * 内部阅读器（在所有 Provider 内部）
 */
function InternalReader({
  collection,
  onBack,
  className,
  contentRef,
}: InternalReaderProps) {
  // ============================================
  // Context Hooks
  // ============================================
  const { theme } = useReaderThemeContext();
  const { isFocusMode, toggleFocusMode, exitFocusMode } = useFocusModeContext();
  const {
    highlights,
    toolbarPosition,
    editingHighlightId,
    setToolbarPosition,
    setEditingHighlight,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    selectedRange,
    clearSelection,
  } = useHighlightContext();

  // ============================================
  // 状态
  // ============================================
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">(
    "medium",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showTOC, setShowTOC] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // 目录宽度状态
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

  // ============================================
  // Refs
  // ============================================
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const tocItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // ============================================
  // 解析数据
  // ============================================
  const tableOfContents = useMemo(
    () => parseTableOfContents(collection.raw_content),
    [collection.raw_content],
  );

  const hasTOC = tableOfContents.length > 0;

  const contentTypeConfig =
    (collection.content_type && CONTENT_TYPE_CONFIG[collection.content_type]) ??
    DEFAULT_CONTENT_TYPE_CONFIG;

  // ============================================
  // 图片灯箱
  // ============================================
  const {
    images: lightboxImages,
    isOpen: isLightboxOpen,
    currentIndex: lightboxIndex,
    openLightbox,
    closeLightbox,
    setImages: setLightboxImages,
  } = useImageLightbox();

  // ============================================
  // 目录同步
  // ============================================
  const { activeId, scrollToHeading: _originalScrollToHeading } = useTOCSync({
    containerRef: contentRef,
    tocItems: tableOfContents,
  });

  // 自定义滚动函数 - 滚动到 scrollContainerRef 而不是 window
  const scrollToHeading = useCallback((id: string) => {
    const element = document.getElementById(id);
    const scrollContainer = scrollContainerRef.current;
    if (element && scrollContainer) {
      const offset = 24; // 顶部间距
      const elementTop = element.offsetTop - offset;
      scrollContainer.scrollTo({
        top: elementTop,
        behavior: "smooth",
      });
    }
  }, []);

  // ============================================
  // 阅读位置
  // ============================================
  const {
    progress,
    remainingMinutes: _remainingMinutes,
    savedPosition,
    restorePosition,
    clearPosition,
  } = useReadingPosition({
    collectionId: collection.id,
    contentRef: contentRef,
    readingTimeMinutes: collection.reading_time_minutes || 5,
    scrollContainerRef: scrollContainerRef,
  });

  // ============================================
  // 键盘导航
  // ============================================
  const keyboardShortcuts: KeyboardShortcut[] = useMemo(
    () => [
      // 导航
      {
        key: "j",
        description: "下一章节",
        action: () => {
          if (!tableOfContents.length) return;
          const currentIndex = tableOfContents.findIndex(
            (item) => item.id === activeId,
          );
          const nextIndex = Math.min(
            currentIndex + 1,
            tableOfContents.length - 1,
          );
          scrollToHeading(tableOfContents[nextIndex].id);
        },
      },
      {
        key: "arrowdown",
        description: "下一章节",
        action: () => {
          if (!tableOfContents.length) return;
          const currentIndex = tableOfContents.findIndex(
            (item) => item.id === activeId,
          );
          const nextIndex = Math.min(
            currentIndex + 1,
            tableOfContents.length - 1,
          );
          scrollToHeading(tableOfContents[nextIndex].id);
        },
      },
      {
        key: "k",
        description: "上一章节",
        action: () => {
          if (!tableOfContents.length) return;
          const currentIndex = tableOfContents.findIndex(
            (item) => item.id === activeId,
          );
          const prevIndex = Math.max(currentIndex - 1, 0);
          scrollToHeading(tableOfContents[prevIndex].id);
        },
      },
      {
        key: "arrowup",
        description: "上一章节",
        action: () => {
          if (!tableOfContents.length) return;
          const currentIndex = tableOfContents.findIndex(
            (item) => item.id === activeId,
          );
          const prevIndex = Math.max(currentIndex - 1, 0);
          scrollToHeading(tableOfContents[prevIndex].id);
        },
      },
      // 模式切换
      {
        key: "t",
        description: "切换目录",
        action: () => setShowTOC((prev) => !prev),
      },
      {
        key: "f",
        description: "切换专注模式",
        action: toggleFocusMode,
      },
      {
        key: "escape",
        description: "退出当前模式",
        action: () => {
          if (isHelpOpen) {
            setIsHelpOpen(false);
          } else if (isLightboxOpen) {
            closeLightbox();
          } else if (isFocusMode) {
            exitFocusMode();
          } else if (toolbarPosition) {
            setToolbarPosition(null);
            setEditingHighlight(null);
            clearSelection();
          }
        },
      },
      // 帮助
      {
        key: "?",
        description: "快捷键帮助",
        modifiers: { shift: true },
        action: () => setIsHelpOpen(true),
      },
      // 字体大小
      {
        key: "1",
        description: "小字体",
        action: () => setFontSize("small"),
      },
      {
        key: "2",
        description: "中字体",
        action: () => setFontSize("medium"),
      },
      {
        key: "3",
        description: "大字体",
        action: () => setFontSize("large"),
      },
    ],
    [
      tableOfContents,
      activeId,
      scrollToHeading,
      toggleFocusMode,
      exitFocusMode,
      isFocusMode,
      isHelpOpen,
      isLightboxOpen,
      closeLightbox,
      toolbarPosition,
      setToolbarPosition,
      setEditingHighlight,
      clearSelection,
    ],
  );

  useKeyboardNav({
    shortcuts: keyboardShortcuts,
    enabled: !isHelpOpen, // 帮助弹窗打开时禁用
  });

  // ============================================
  // 副作用
  // ============================================

  // 保存目录宽度
  useEffect(() => {
    if (!isResizing) {
      localStorage.setItem(TOC_WIDTH.storageKey, tocWidth.toString());
    }
  }, [tocWidth, isResizing]);

  // 目录拖拽
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

  // 目录项滚动
  useEffect(() => {
    if (!activeId) return;
    const activeElement = tocItemRefs.current.get(activeId);
    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeId]);

  // 滚动进度
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop;
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

  // ============================================
  // 高亮处理
  // ============================================
  const handleHighlightColorSelect = useCallback(
    async (color: Parameters<typeof createHighlight>[1]) => {
      if (editingHighlightId) {
        // 编辑模式：更新颜色
        await updateHighlight(editingHighlightId, color);
      } else if (selectedRange) {
        // 创建模式：创建新高亮
        await createHighlight(selectedRange, color);
      }
      setToolbarPosition(null);
      setEditingHighlight(null);
      clearSelection();
    },
    [
      editingHighlightId,
      selectedRange,
      createHighlight,
      updateHighlight,
      setToolbarPosition,
      setEditingHighlight,
      clearSelection,
    ],
  );

  const handleHighlightDelete = useCallback(async () => {
    if (editingHighlightId) {
      await deleteHighlight(editingHighlightId);
      setToolbarPosition(null);
      setEditingHighlight(null);
    }
  }, [
    editingHighlightId,
    deleteHighlight,
    setToolbarPosition,
    setEditingHighlight,
  ]);

  const handleHighlightClick = useCallback(
    (highlight: TextHighlight, position: HighlightToolbarPosition) => {
      // MdRenderer 传来的高亮点击
      setEditingHighlight(highlight.id);
      setToolbarPosition(position);
    },
    [setEditingHighlight, setToolbarPosition],
  );

  // ============================================
  // 字体大小
  // ============================================
  const fontSizeClass = {
    small: "text-sm",
    medium: "text-base",
    large: "text-lg",
  };

  // ============================================
  // 主题 CSS 变量
  // ============================================
  const themeStyles = useMemo(
    () =>
      ({
        "--reader-bg": theme.colors.background,
        "--reader-fg": theme.colors.foreground,
        "--reader-accent": theme.colors.accent,
        "--reader-muted": theme.colors.muted,
        "--reader-border": theme.colors.border,
      }) as React.CSSProperties,
    [theme],
  );

  // ============================================
  // 编辑中的高亮信息
  // ============================================
  const editingHighlight = useMemo(
    () => highlights.find((h) => h.id === editingHighlightId),
    [highlights, editingHighlightId],
  );

  return (
    <FocusModeContainer
      className={cn("relative h-full flex flex-col overflow-hidden", className)}
    >
      {/* 位置恢复提示 - 浮动在顶部 */}
      <PositionRestorePrompt
        savedPosition={savedPosition}
        onRestore={() => {
          restorePosition();
          clearPosition();
        }}
        onStartOver={clearPosition}
      />

      {/* 顶部工具栏 - 固定不滚动 */}
      <FocusModeToolbar className="shrink-0 z-40">
        <header
          className="w-full border-b"
          style={{
            backgroundColor: "var(--reader-bg)",
            borderColor: "var(--reader-border)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            {/* 左侧：返回按钮 */}
            <div className="flex items-center gap-3 shrink-0">
              {onBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  style={{ color: "var(--reader-fg)" }}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  返回
                </Button>
              )}
            </div>

            {/* 中间：标题 + 进度 */}
            <div className="flex-1 flex items-center gap-4 min-w-0">
              <h1
                className="text-sm font-medium truncate"
                style={{ color: "var(--reader-accent)" }}
                title={collection.title}
              >
                {collection.title}
              </h1>

              {/* 进度组件 */}
              <div className="hidden sm:block">
                <ReadingProgressCompact progress={progress} />
              </div>
            </div>

            {/* 右侧：工具按钮 */}
            <div className="flex items-center gap-1 shrink-0">
              {/* 主题切换 */}
              <ThemeSwitcher />

              {/* 专注模式 */}
              <FocusModeToggle />

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

              {/* 键盘帮助 */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsHelpOpen(true)}
                title="键盘快捷键"
                className="hidden md:flex"
              >
                <Keyboard className="w-4 h-4" />
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
      </FocusModeToolbar>

      {/* 内容区域 - flex-1 填充剩余空间 */}
      <div
        className="flex-1 flex min-h-0 overflow-hidden"
        style={{
          ...themeStyles,
          backgroundColor: "var(--reader-bg)",
          color: "var(--reader-fg)",
        }}
      >
        {/* 左侧目录 - 固定宽度，独立滚动 */}
        {hasTOC && showTOC && (
          <aside
            ref={sidebarRef}
            className="hidden lg:flex flex-col shrink-0 border-r relative"
            style={{
              width: tocWidth,
              borderColor: "var(--reader-border)",
              backgroundColor: "var(--reader-bg)",
            }}
          >
            <div className="flex-1 overflow-y-auto md-toc-scroll">
              <div className="p-4">
                <h3
                  className="font-medium mb-3 flex items-center gap-2"
                  style={{ color: "var(--reader-accent)" }}
                >
                  <List className="w-4 h-4" />
                  目录
                </h3>
                <nav className="space-y-1">
                  {tableOfContents.map((item, index) => {
                    const isActive = activeId === item.id;
                    return (
                      <button
                        key={`${item.id}-${index}`}
                        ref={(el) => {
                          if (el) {
                            tocItemRefs.current.set(item.id, el);
                          } else {
                            tocItemRefs.current.delete(item.id);
                          }
                        }}
                        onClick={() => scrollToHeading(item.id)}
                        className={cn(
                          "block w-full text-left px-3 py-1.5 text-sm rounded-md transition-all duration-200",
                          isActive && "font-medium",
                        )}
                        style={{
                          paddingLeft: `${(item.level - 1) * 12 + 12}px`,
                          backgroundColor: isActive
                            ? "var(--reader-muted)"
                            : "transparent",
                          color: isActive
                            ? "var(--reader-accent)"
                            : "var(--reader-fg)",
                          opacity: isActive ? 1 : 0.7,
                        }}
                      >
                        {item.text}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* 拖动把手 */}
            <div
              className={cn(
                "absolute top-0 right-0 w-1 h-full cursor-col-resize group",
                "transition-colors",
                isResizing && "opacity-50",
              )}
              style={{
                backgroundColor: isResizing
                  ? "var(--reader-accent)"
                  : "transparent",
              }}
              onMouseDown={handleMouseDown}
            >
              <div className="absolute top-1/2 -translate-y-1/2 right-0 w-4 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical
                  className="w-3 h-3"
                  style={{ color: "var(--reader-fg)" }}
                />
              </div>
            </div>
          </aside>
        )}

        {/* 主内容区 - 独立滚动 */}
        <main
          ref={scrollContainerRef}
          className="flex-1 min-w-0 overflow-y-auto"
        >
          <div ref={contentRef} className="px-4 py-8 max-w-4xl mx-auto">
            {/* 文章头部 */}
            <header className="mb-8">
              <span
                className={cn(
                  "inline-block px-2 py-1 text-xs font-medium rounded mb-4",
                  contentTypeConfig.color,
                )}
              >
                {contentTypeConfig.label}
              </span>

              <h1
                className="text-3xl md:text-4xl font-bold mb-4 leading-tight"
                style={{ color: "var(--reader-accent)" }}
              >
                {collection.title}
              </h1>

              <div
                className="flex flex-wrap items-center gap-4 text-sm"
                style={{ color: "var(--reader-fg)", opacity: 0.6 }}
              >
                <span className="flex items-center gap-1">
                  <Type className="w-4 h-4" />
                  {collection.word_count?.toLocaleString() || 0} 字
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {collection.reading_time_minutes || 1} 分钟阅读
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(collection.created_at).toLocaleDateString("zh-CN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>

              {collection.ai_summary && (
                <div
                  className="mt-6 p-4 rounded-lg border"
                  style={{
                    backgroundColor: "var(--reader-muted)",
                    borderColor: "var(--reader-border)",
                  }}
                >
                  <p
                    className="text-sm font-medium mb-2"
                    style={{ color: "var(--reader-accent)" }}
                  >
                    AI 摘要
                  </p>
                  <p className="leading-relaxed">{collection.ai_summary}</p>
                </div>
              )}

              {collection.ai_tags && collection.ai_tags.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Tag className="w-4 h-4" style={{ opacity: 0.5 }} />
                  {collection.ai_tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs rounded"
                      style={{
                        backgroundColor: "var(--reader-muted)",
                        color: "var(--reader-fg)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            <hr
              className="mb-8"
              style={{ borderColor: "var(--reader-border)" }}
            />

            {/* Markdown 内容 */}
            <div className={fontSizeClass[fontSize]}>
              <MdRenderer
                content={collection.raw_content}
                showLineNumbers={true}
                theme={theme.id === "dark" ? "dark" : "light"}
                onImageClick={(_image, index) => openLightbox(index)}
                onImagesCollected={setLightboxImages}
                highlights={highlights}
                onHighlightClick={handleHighlightClick}
                contentRef={contentRef}
              />
            </div>

            <footer
              className="mt-12 pt-8 border-t"
              style={{ borderColor: "var(--reader-border)" }}
            >
              <p
                className="text-center text-sm"
                style={{ color: "var(--reader-fg)", opacity: 0.5 }}
              >
                — 文章结束 —
              </p>
            </footer>
          </div>
        </main>
      </div>

      {/* 回到顶部 */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-40 w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center transition-all hover:opacity-90"
          style={{ backgroundColor: "var(--reader-accent)" }}
          title="回到顶部"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}

      {/* 高亮工具栏 */}
      <HighlightToolbar
        position={toolbarPosition}
        onColorSelect={handleHighlightColorSelect}
        onClose={() => {
          setToolbarPosition(null);
          setEditingHighlight(null);
          clearSelection();
        }}
        existingColor={editingHighlight?.color}
        onDelete={editingHighlightId ? handleHighlightDelete : undefined}
      />

      {/* 图片灯箱 */}
      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={isLightboxOpen}
        onClose={closeLightbox}
      />

      {/* 键盘帮助 */}
      <KeyboardNavHelp
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </FocusModeContainer>
  );
}

// ============================================
// 主组件
// ============================================

/**
 * MD 专业阅读视图
 * 集成所有阅读增强功能
 */
export function MdReaderView({
  collection,
  onBack,
  className,
}: MdReaderViewProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <ReaderThemeProvider>
      <FocusModeProvider>
        <HighlightProvider collectionId={collection.id} contentRef={contentRef}>
          <InternalReader
            collection={collection}
            onBack={onBack}
            className={className}
            contentRef={contentRef}
          />
        </HighlightProvider>
      </FocusModeProvider>
    </ReaderThemeProvider>
  );
}

export default MdReaderView;
