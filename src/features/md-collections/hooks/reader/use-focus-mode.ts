/**
 * MD 阅读专注模式 Hook
 * Spec: md-reader-upgrade / REQ-6
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { UseFocusModeResult } from "../../types/reader";

/**
 * 工具栏自动隐藏延迟（毫秒）
 */
const TOOLBAR_HIDE_DELAY = 3000;

/**
 * useFocusMode Hook 选项
 */
export interface UseFocusModeOptions {
  /** 初始专注模式状态（默认 false） */
  initialFocusMode?: boolean;
  /** 是否启用 Esc 键退出（默认 true） */
  enableEscapeExit?: boolean;
  /** 工具栏自动隐藏延迟毫秒（默认 3000） */
  hideDelay?: number;
}

/**
 * useFocusMode Hook
 *
 * 管理专注模式状态，包括：
 * - 专注模式开关
 * - 工具栏 3 秒自动隐藏
 * - 鼠标移动/滚动时显示工具栏
 * - Esc 键退出专注模式
 *
 * @example
 * ```tsx
 * function Reader() {
 *   const {
 *     isFocusMode,
 *     toggleFocusMode,
 *     exitFocusMode,
 *     isToolbarVisible,
 *     showToolbar,
 *   } = useFocusMode();
 *
 *   return (
 *     <div className={isFocusMode ? 'focus-mode' : ''}>
 *       <Toolbar
 *         visible={!isFocusMode || isToolbarVisible}
 *         onMouseEnter={showToolbar}
 *       />
 *       <button onClick={toggleFocusMode}>
 *         {isFocusMode ? '退出专注' : '专注阅读'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusMode(
  options: UseFocusModeOptions = {},
): UseFocusModeResult {
  const {
    initialFocusMode = false,
    enableEscapeExit = true,
    hideDelay = TOOLBAR_HIDE_DELAY,
  } = options;

  // 专注模式状态
  const [isFocusMode, setIsFocusMode] = useState(initialFocusMode);

  // 工具栏可见状态
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  // 自动隐藏定时器
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 最后活动时间 - 初始化为 0，在 showToolbar 时更新
  const lastActivityRef = useRef<number>(0);

  /**
   * 清除隐藏定时器
   */
  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  /**
   * 启动隐藏定时器
   */
  const startHideTimer = useCallback(() => {
    clearHideTimer();

    hideTimerRef.current = setTimeout(() => {
      setIsToolbarVisible(false);
    }, hideDelay);
  }, [clearHideTimer, hideDelay]);

  /**
   * 显示工具栏并重置隐藏定时器
   */
  const showToolbar = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsToolbarVisible(true);

    if (isFocusMode) {
      startHideTimer();
    }
  }, [isFocusMode, startHideTimer]);

  /**
   * 切换专注模式
   */
  const toggleFocusMode = useCallback(() => {
    setIsFocusMode((prev) => {
      const newValue = !prev;
      if (newValue) {
        // 进入专注模式：显示工具栏并启动定时器
        setIsToolbarVisible(true);
        startHideTimer();
      } else {
        // 退出专注模式：显示工具栏并清除定时器
        setIsToolbarVisible(true);
        clearHideTimer();
      }
      return newValue;
    });
  }, [startHideTimer, clearHideTimer]);

  /**
   * 退出专注模式
   */
  const exitFocusMode = useCallback(() => {
    setIsFocusMode(false);
    setIsToolbarVisible(true);
    clearHideTimer();
  }, [clearHideTimer]);

  // 监听鼠标移动和滚动事件
  useEffect(() => {
    if (!isFocusMode) return;

    const handleActivity = () => {
      showToolbar();
    };

    // 使用 passive 监听器提升性能
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("scroll", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });

    // 初始启动隐藏定时器
    startHideTimer();

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      clearHideTimer();
    };
  }, [isFocusMode, showToolbar, startHideTimer, clearHideTimer]);

  // 监听 Esc 键退出专注模式
  useEffect(() => {
    if (!isFocusMode || !enableEscapeExit) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exitFocusMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFocusMode, enableEscapeExit, exitFocusMode]);

  // 清理定时器
  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, [clearHideTimer]);

  return {
    isFocusMode,
    toggleFocusMode,
    exitFocusMode,
    isToolbarVisible,
    showToolbar,
  };
}

export default useFocusMode;
