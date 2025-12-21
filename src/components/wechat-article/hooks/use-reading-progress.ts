/**
 * 阅读进度 Hook
 *
 * @module wechat-article/hooks
 * @description 追踪文章阅读进度
 *
 * Phase 4 升级：UX 优化 - 阅读进度指示
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// =============================================================================
// 类型定义
// =============================================================================

export interface UseReadingProgressOptions {
  /** 滚动容器选择器或元素引用 */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** 防抖延迟 (ms) */
  throttleMs?: number;
}

export interface UseReadingProgressReturn {
  /** 当前阅读进度 (0-100) */
  progress: number;
  /** 是否已阅读完成 (进度 > 90%) */
  isCompleted: boolean;
  /** 滚动到指定进度 */
  scrollToProgress: (targetProgress: number) => void;
  /** 重置进度 */
  resetProgress: () => void;
}

// =============================================================================
// Hook 实现
// =============================================================================

/**
 * 阅读进度追踪 Hook
 *
 * 功能：
 * - 实时追踪滚动位置
 * - 计算阅读百分比
 * - 支持滚动到指定位置
 */
export function useReadingProgress(
  options: UseReadingProgressOptions = {},
): UseReadingProgressReturn {
  const { containerRef, throttleMs = 100 } = options;
  const [progress, setProgress] = useState(0);
  const lastUpdateRef = useRef(0);

  // 计算进度
  const calculateProgress = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current < throttleMs) {
      return;
    }
    lastUpdateRef.current = now;

    const container = containerRef?.current;

    if (container) {
      // 使用容器内的滚动
      const { scrollTop, scrollHeight, clientHeight } = container;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 0) {
        setProgress(100);
        return;
      }

      const currentProgress = Math.min(
        100,
        Math.round((scrollTop / maxScroll) * 100),
      );
      setProgress(currentProgress);
    } else {
      // 使用 window 滚动
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const maxScroll = docHeight - winHeight;

      if (maxScroll <= 0) {
        setProgress(100);
        return;
      }

      const currentProgress = Math.min(
        100,
        Math.round((scrollTop / maxScroll) * 100),
      );
      setProgress(currentProgress);
    }
  }, [containerRef, throttleMs]);

  // 监听滚动事件
  useEffect(() => {
    const container = containerRef?.current;
    const target = container || window;

    target.addEventListener("scroll", calculateProgress, { passive: true });
    // 使用 queueMicrotask 延迟初始计算，避免同步 setState
    queueMicrotask(calculateProgress);

    return () => {
      target.removeEventListener("scroll", calculateProgress);
    };
  }, [containerRef, calculateProgress]);

  // 滚动到指定进度
  const scrollToProgress = useCallback(
    (targetProgress: number) => {
      const container = containerRef?.current;

      if (container) {
        const { scrollHeight, clientHeight } = container;
        const maxScroll = scrollHeight - clientHeight;
        const targetScroll = (targetProgress / 100) * maxScroll;
        container.scrollTo({ top: targetScroll, behavior: "smooth" });
      } else {
        const docHeight = document.documentElement.scrollHeight;
        const winHeight = window.innerHeight;
        const maxScroll = docHeight - winHeight;
        const targetScroll = (targetProgress / 100) * maxScroll;
        window.scrollTo({ top: targetScroll, behavior: "smooth" });
      }
    },
    [containerRef],
  );

  // 重置进度
  const resetProgress = useCallback(() => {
    const container = containerRef?.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setProgress(0);
  }, [containerRef]);

  return {
    progress,
    isCompleted: progress >= 90,
    scrollToProgress,
    resetProgress,
  };
}
