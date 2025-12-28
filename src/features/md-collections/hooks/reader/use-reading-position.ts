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
  const savePositionRef = useRef<() => void>(() => {});
  const clearPositionRef = useRef<() => void>(() => {});

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
   * 使用 getBoundingClientRect 获取准确的视口相对位置
   */
  const calculateProgress = useCallback((): number => {
    const container = contentRef.current;
    if (!container) return 0;

    const rect = container.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const contentHeight = container.scrollHeight || container.offsetHeight;

    if (contentHeight <= 0) return 0;

    // 计算已阅读的内容高度
    // rect.top < 0 表示内容顶部已滚出视口
    // rect.top >= viewportHeight 表示内容还未进入视口
    if (rect.top >= viewportHeight) {
      return 0; // 内容还未进入视口
    }

    if (rect.bottom <= 0) {
      return 100; // 内容已完全滚出视口
    }

    // 已滚过的内容高度 = 内容顶部滚出视口的部分
    const scrolledHeight = Math.max(0, -rect.top);
    // 可见的内容高度
    const visibleHeight =
      Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    // 总阅读进度 = 已滚过 + 当前可见
    const readHeight = scrolledHeight + visibleHeight;
    const rawProgress = (readHeight / contentHeight) * 100;

    return Math.min(100, Math.max(0, rawProgress));
  }, [contentRef]);

  /**
   * 保存当前阅读位置到 localStorage
   */
  const savePosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const currentProgress = calculateProgress();
    const position: ReadingPosition = {
      scrollTop: window.scrollY,
      progress: currentProgress,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(position));
      setSavedPosition(position);
    } catch (error) {
      // localStorage 不可用或配额已满
      if (process.env.NODE_ENV === "development") {
        console.error("[use-reading-position] savePosition failed:", error);
      }
    }
  }, [storageKey, calculateProgress]);

  /**
   * 恢复到保存的阅读位置
   */
  const restorePosition = useCallback(() => {
    if (!savedPosition) return;

    window.scrollTo({
      top: savedPosition.scrollTop,
      behavior: "smooth",
    });
  }, [savedPosition]);

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
        console.error("[use-reading-position] clearPosition failed:", error);
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
        console.error("[use-reading-position] init failed:", error);
      }
    }
  }, [storageKey]);

  // 监听滚动更新进度
  useEffect(() => {
    if (typeof window === "undefined") return;

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

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []); // 空依赖数组 - 使用 refs 避免重新订阅

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
