/**
 * MD 阅读器目录同步 Hook
 * Spec: md-reader-upgrade / REQ-3
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { UseTOCSyncOptions, UseTOCSyncResult } from "../../types/reader";

/**
 * 防抖延迟（毫秒）
 */
const DEBOUNCE_DELAY = 100;

/**
 * IntersectionObserver 配置
 * - rootMargin: 视口顶部偏移 80px（避开工具栏）
 * - threshold: 标题进入视口 10% 时触发
 */
const OBSERVER_OPTIONS: IntersectionObserverInit = {
  rootMargin: "-80px 0px -70% 0px",
  threshold: 0.1,
};

/**
 * useTOCSync Hook
 *
 * 功能：
 * - 使用 IntersectionObserver 监听标题可见性
 * - 返回当前活动章节 ID
 * - 提供 scrollToHeading 方法实现平滑滚动
 * - 处理多个可见标题时选择最上方的
 * - 防抖更新避免频繁 re-render
 *
 * @example
 * ```tsx
 * function ReaderWithTOC() {
 *   const contentRef = useRef<HTMLDivElement>(null);
 *   const tocItems = extractTOCItems(content);
 *
 *   const { activeId, scrollToHeading } = useTOCSync({
 *     containerRef: contentRef,
 *     tocItems,
 *   });
 *
 *   return (
 *     <div ref={contentRef}>
 *       <TOC items={tocItems} activeId={activeId} onItemClick={scrollToHeading} />
 *       <MdRenderer content={content} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useTOCSync({
  containerRef,
  tocItems,
}: UseTOCSyncOptions): UseTOCSyncResult {
  // 当前活动的标题 ID - 使用第一个 TOC 项作为初始值
  const [activeId, setActiveId] = useState<string | null>(() =>
    tocItems.length > 0 ? tocItems[0].id : null,
  );

  // 跟踪可见的标题 ID 集合
  const visibleIdsRef = useRef<Set<string>>(new Set());

  // 防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Observer 引用
  const observerRef = useRef<IntersectionObserver | null>(null);

  /**
   * 根据可见标题更新活动 ID
   * 选择最上方的可见标题
   */
  const updateActiveId = useCallback(() => {
    if (visibleIdsRef.current.size === 0) {
      return;
    }

    // 按文档顺序找到最上方的可见标题
    for (const item of tocItems) {
      if (visibleIdsRef.current.has(item.id)) {
        setActiveId(item.id);
        return;
      }
    }
  }, [tocItems]);

  /**
   * 防抖更新活动 ID
   */
  const debouncedUpdateActiveId = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      updateActiveId();
    }, DEBOUNCE_DELAY);
  }, [updateActiveId]);

  /**
   * 滚动到指定标题
   */
  const scrollToHeading = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      // 平滑滚动，考虑工具栏高度
      const offset = 100; // 工具栏高度 + 间距
      const elementTop = element.getBoundingClientRect().top + window.scrollY;

      window.scrollTo({
        top: elementTop - offset,
        behavior: "smooth",
      });

      // 立即设置活动 ID
      setActiveId(id);
    }
  }, []);

  // 初始化 IntersectionObserver
  useEffect(() => {
    // SSR 安全检查
    if (typeof window === "undefined" || !containerRef.current) {
      return;
    }

    // 如果没有目录项，不需要观察
    if (tocItems.length === 0) {
      return;
    }

    // IntersectionObserver 回调
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        const id = entry.target.id;

        if (entry.isIntersecting) {
          visibleIdsRef.current.add(id);
        } else {
          visibleIdsRef.current.delete(id);
        }
      });

      debouncedUpdateActiveId();
    };

    // 创建 Observer
    observerRef.current = new IntersectionObserver(
      handleIntersection,
      OBSERVER_OPTIONS,
    );

    // 观察所有标题元素
    tocItems.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element && observerRef.current) {
        observerRef.current.observe(element);
      }
    });

    // 保存 ref 的当前值以便在清理函数中使用
    const visibleIds = visibleIdsRef.current;

    // 清理函数
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      visibleIds.clear();
    };
  }, [containerRef, tocItems, debouncedUpdateActiveId]);

  // 当 tocItems 变化时更新 activeId（如果当前 activeId 不在新的 tocItems 中）
  useEffect(() => {
    if (
      tocItems.length > 0 &&
      (!activeId || !tocItems.some((item) => item.id === activeId))
    ) {
      // 使用 requestAnimationFrame 避免 ESLint 警告
      requestAnimationFrame(() => {
        setActiveId(tocItems[0].id);
      });
    }
  }, [tocItems, activeId]);

  return {
    activeId,
    scrollToHeading,
  };
}

export default useTOCSync;
