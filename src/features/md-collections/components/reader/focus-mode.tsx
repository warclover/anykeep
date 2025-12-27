/**
 * MD 阅读专注模式组件
 * Spec: md-reader-upgrade / REQ-6
 */

"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  useFocusMode,
  type UseFocusModeOptions,
} from "../../hooks/reader/use-focus-mode";
import type { FocusModeContextValue } from "../../types/reader";

// ============================================
// Context
// ============================================

const FocusModeContext = createContext<FocusModeContextValue | null>(null);

/**
 * 使用专注模式 Context
 * @throws 如果在 FocusModeProvider 外部使用则抛出错误
 */
export function useFocusModeContext(): FocusModeContextValue {
  const context = useContext(FocusModeContext);
  if (!context) {
    throw new Error(
      "useFocusModeContext must be used within a FocusModeProvider",
    );
  }
  return context;
}

// ============================================
// Provider
// ============================================

export interface FocusModeProviderProps extends UseFocusModeOptions {
  children: ReactNode;
}

/**
 * 专注模式 Provider
 *
 * 提供专注模式状态管理，包括：
 * - 专注模式开关状态
 * - 工具栏可见性
 * - 相关操作方法
 *
 * @example
 * ```tsx
 * function ReaderPage() {
 *   return (
 *     <FocusModeProvider>
 *       <Reader />
 *     </FocusModeProvider>
 *   );
 * }
 * ```
 */
export function FocusModeProvider({
  children,
  ...options
}: FocusModeProviderProps) {
  const focusModeState = useFocusMode(options);

  const value = useMemo<FocusModeContextValue>(
    () => focusModeState,
    [focusModeState],
  );

  return (
    <FocusModeContext.Provider value={value}>
      {children}
    </FocusModeContext.Provider>
  );
}

// ============================================
// Container Component
// ============================================

export interface FocusModeContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * 专注模式容器
 *
 * 当进入专注模式时：
 * - 全屏显示
 * - 内容居中
 * - 背景变暗
 *
 * @example
 * ```tsx
 * function Reader() {
 *   return (
 *     <FocusModeProvider>
 *       <FocusModeContainer>
 *         <Content />
 *       </FocusModeContainer>
 *     </FocusModeProvider>
 *   );
 * }
 * ```
 */
export function FocusModeContainer({
  children,
  className,
}: FocusModeContainerProps) {
  const { isFocusMode } = useFocusModeContext();

  return (
    <div
      className={cn(
        "transition-all duration-300 ease-out",
        isFocusMode && ["fixed inset-0 z-50", "bg-background", "overflow-auto"],
        className,
      )}
    >
      <div
        className={cn(
          "transition-all duration-300 ease-out",
          isFocusMode && ["max-w-4xl mx-auto", "px-4 py-8"],
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================
// Toolbar Wrapper
// ============================================

export interface FocusModeToolbarProps {
  children: ReactNode;
  className?: string;
  /** 位置：顶部或底部（默认顶部） */
  position?: "top" | "bottom";
}

/**
 * 专注模式工具栏包装器
 *
 * 在专注模式下，工具栏会在 3 秒无活动后自动淡出，
 * 鼠标移动或滚动时重新显示。
 *
 * @example
 * ```tsx
 * function Reader() {
 *   const { toggleFocusMode } = useFocusModeContext();
 *
 *   return (
 *     <FocusModeToolbar position="top">
 *       <button onClick={toggleFocusMode}>退出专注</button>
 *     </FocusModeToolbar>
 *   );
 * }
 * ```
 */
export function FocusModeToolbar({
  children,
  className,
  position = "top",
}: FocusModeToolbarProps) {
  const { isFocusMode, isToolbarVisible, showToolbar } = useFocusModeContext();

  // 非专注模式时正常显示
  if (!isFocusMode) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn(
        // 固定定位
        "fixed left-0 right-0 z-[51]",
        position === "top" ? "top-0" : "bottom-0",
        // 背景和阴影
        "bg-background/95 backdrop-blur-sm",
        position === "top"
          ? "shadow-md"
          : "shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]",
        // 过渡动画
        "transition-all duration-500 ease-out",
        // 可见性控制
        isToolbarVisible
          ? "opacity-100 translate-y-0"
          : position === "top"
            ? "opacity-0 -translate-y-full pointer-events-none"
            : "opacity-0 translate-y-full pointer-events-none",
        className,
      )}
      onMouseEnter={showToolbar}
      onMouseMove={showToolbar}
    >
      {children}
    </div>
  );
}

// ============================================
// Toggle Button
// ============================================

export interface FocusModeToggleProps {
  className?: string;
  /** 自定义标签 */
  labels?: {
    enter?: string;
    exit?: string;
  };
}

/**
 * 专注模式切换按钮
 *
 * @example
 * ```tsx
 * <FocusModeToggle labels={{ enter: "专注阅读", exit: "退出专注" }} />
 * ```
 */
export function FocusModeToggle({
  className,
  labels = { enter: "专注阅读", exit: "退出专注" },
}: FocusModeToggleProps) {
  const { isFocusMode, toggleFocusMode } = useFocusModeContext();

  return (
    <button
      type="button"
      onClick={toggleFocusMode}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5",
        "text-sm font-medium",
        "rounded-md border",
        "hover:bg-accent hover:text-accent-foreground",
        "transition-colors",
        className,
      )}
      title={isFocusMode ? "按 Esc 退出专注模式" : "进入专注模式"}
    >
      {isFocusMode ? (
        <>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          {labels.exit}
        </>
      ) : (
        <>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
          {labels.enter}
        </>
      )}
    </button>
  );
}

// ============================================
// Exports
// ============================================

export { FocusModeContext };
