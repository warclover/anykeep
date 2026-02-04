/**
 * MD 阅读位置 Hook
 * Spec: md-reader-upgrade / REQ-4, REQ-5
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  ReadingPosition,
  UseReadingPositionOptions,
  UseReadingPositionResult,
} from "../../types/reader";
import { clientLogger } from "@/lib/client-logger";

/**
 * localStorage 键前缀
 */
const STORAGE_KEY_PREFIX = "md-reader-position-";

/**
 * 防抖延迟（毫秒）
 */
const DEBOUNCE_DELAY = 100;

/**
 * 位置数据过期时间（30 天，毫秒）
 */
const POSITION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 完成阈值百分比
 */
const COMPLETION_THRESHOLD = 95;

/**
 * useReadingPosition Hook
 *
 * 功能：
 * - 监听滚动计算进度百分比
 * - 计算剩余阅读时间
 * - localStorage 存储/恢复阅读位置
 * - 位置数据 30 天后过期
 *
 * @example
 * ```tsx
 * function Reader({ collectionId, readingTimeMinutes }) {
 *   const contentRef = useRef<HTMLDivElement>(null);
 *
 *   const {
 *     progress,
 *     remainingMinutes,
 *     savedPosition,
 *     savePosition,
 *     restorePosition,
 *   } = useReadingPosition({
 *     collectionId,
 *     contentRef,
 *     readingTimeMinutes,
 *   });
 *
 *   return (
 *     <div ref={contentRef}>
 *       <ProgressBar progress={progress} />
 *       <span>{remainingMinutes} 分钟</span>
 *       {savedPosition && (
 *         <button onClick={restorePosition}>继续阅读</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useReadingPosition({
  collectionId,
  contentRef,
  readingTimeMinutes,
  scrollContainerRef,
}: UseReadingPositionOptions): UseReadingPositionResult {
  // 当前进度百分比
  const [progress, setProgress] = useState(0);

  // 保存的阅读位置
  const [savedPosition, setSavedPosition] = useState<ReadingPosition | null>(
    null,
  );

  // 防抖定时器
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 使用 ref 存储最新函数引用，避免 effect 依赖导致频繁重渲染
  const calculateProgressRef = useRef<() => number>(() => 0);
  const savePositionRef = useRef<() => void>(() => {
    /* noop - initialized later */
  });
  const clearPositionRef = useRef<() => void>(() => {
    /* noop - initialized later */
  });

  // 生成 localStorage 键
  const storageKey = `${STORAGE_KEY_PREFIX}${collectionId}`;

  /**
   * 计算剩余阅读时间（分钟）
   */
  const remainingMinutes = Math.max(
    0,
    Math.ceil(readingTimeMinutes * (1 - progress / 100)),
  );

  /**
   * 获取当前滚动进度
   * 支持自定义滚动容器或 window
   */
  const calculateProgress = useCallback((): number => {
    const container = contentRef.current;
    if (!container) return 0;

    const scrollContainer = scrollContainerRef?.current;

    if (scrollContainer) {
      // 使用自定义滚动容器计算进度
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 0) return 100;
      return Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
    }

    // 使用 window 滚动计算进度（原有逻辑）
    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const contentHeight = container.scrollHeight || container.offsetHeight;

    if (contentHeight <= 0) return 0;

    if (rect.top >= viewportHeight) {
      return 0;
    }

    if (rect.bottom <= 0) {
      return 100;
    }

    const scrolledHeight = Math.max(0, -rect.top);
    const visibleHeight =
      Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    const readHeight = scrolledHeight + visibleHeight;
    const rawProgress = (readHeight / contentHeight) * 100;

    return Math.min(100, Math.max(0, rawProgress));
  }, [contentRef, scrollContainerRef]);

  /**
   * 保存当前阅读位置到 localStorage
   */
  const savePosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const scrollContainer = scrollContainerRef?.current;
    const currentProgress = calculateProgress();
    const scrollTop = scrollContainer
      ? scrollContainer.scrollTop
      : window.scrollY;

    const position: ReadingPosition = {
      scrollTop,
      progress: currentProgress,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(position));
      setSavedPosition(position);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        clientLogger.error(
          { error },
          "[use-reading-position] savePosition failed:",
        );
      }
    }
  }, [storageKey, calculateProgress, scrollContainerRef]);

  /**
   * 恢复到保存的阅读位置
   */
  const restorePosition = useCallback(() => {
    if (!savedPosition) return;

    const scrollContainer = scrollContainerRef?.current;

    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: savedPosition.scrollTop,
        behavior: "smooth",
      });
    } else {
      window.scrollTo({
        top: savedPosition.scrollTop,
        behavior: "smooth",
      });
    }
  }, [savedPosition, scrollContainerRef]);

  /**
   * 清除保存的阅读位置
   */
  const clearPosition = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(storageKey);
      setSavedPosition(null);
    } catch (error) {
      // localStorage 不可用
      if (process.env.NODE_ENV === "development") {
        clientLogger.error(
          { error },
          "[use-reading-position] clearPosition failed:",
        );
      }
    }
  }, [storageKey]);

  // 同步 refs 到最新函数引用
  useEffect(() => {
    calculateProgressRef.current = calculateProgress;
    savePositionRef.current = savePosition;
    clearPositionRef.current = clearPosition;
  });

  // 初始化时从 localStorage 读取保存的位置
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const position: ReadingPosition = JSON.parse(saved);

        // 检查是否过期
        if (Date.now() - position.timestamp < POSITION_EXPIRY_MS) {
          requestAnimationFrame(() => {
            setSavedPosition(position);
          });
        } else {
          // 清除过期数据
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      // localStorage 不可用或数据无效
      if (process.env.NODE_ENV === "development") {
        clientLogger.error({ error }, "[use-reading-position] init failed:");
      }
    }
  }, [storageKey]);

  // 监听滚动更新进度
  useEffect(() => {
    if (typeof window === "undefined") return;

    const scrollContainer = scrollContainerRef?.current;

    const handleScroll = () => {
      // 防抖
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const newProgress = calculateProgressRef.current();
        setProgress(newProgress);

        // 自动保存进度（每次滚动）
        if (newProgress > 0 && newProgress < COMPLETION_THRESHOLD) {
          savePositionRef.current();
        }

        // 阅读完成时清除位置记录
        if (newProgress >= COMPLETION_THRESHOLD) {
          clearPositionRef.current();
        }
      }, DEBOUNCE_DELAY);
    };

    // 初始计算 - 使用 requestAnimationFrame 避免 ESLint 警告
    requestAnimationFrame(() => {
      setProgress(calculateProgressRef.current());
    });

    // 根据是否有自定义滚动容器选择监听目标
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true,
      });
    } else {
      window.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      } else {
        window.removeEventListener("scroll", handleScroll);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [scrollContainerRef]); // 依赖 scrollContainerRef

  return {
    progress,
    remainingMinutes,
    savedPosition,
    savePosition,
    restorePosition,
    clearPosition,
  };
}

export default useReadingPosition;
