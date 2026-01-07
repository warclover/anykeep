/**
 * MD 阅读器主题 Provider
 * Spec: md-reader-upgrade / REQ-1
 */

"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
  type CSSProperties,
} from "react";
import type {
  ReaderThemeContextValue,
  ThemeId,
  WithChildren,
  WithClassName,
} from "../../types/reader";
import {
  useReaderTheme,
  type UseReaderThemeOptions,
} from "../../hooks/reader/use-reader-theme";
import { themeToCssVariables } from "../../lib/reader/theme-config";
import { cn } from "@/lib/utils";

/**
 * 阅读器主题 Context
 */
const ReaderThemeContext = createContext<ReaderThemeContextValue | null>(null);

/**
 * 使用阅读器主题 Context
 *
 * @throws {Error} 如果在 ReaderThemeProvider 外部使用
 *
 * @example
 * ```tsx
 * function ThemedComponent() {
 *   const { theme, setTheme, themes } = useReaderThemeContext();
 *   return <div style={{ color: theme.colors.foreground }}>...</div>;
 * }
 * ```
 */
export function useReaderThemeContext(): ReaderThemeContextValue {
  const context = useContext(ReaderThemeContext);
  if (!context) {
    throw new Error(
      "[useReaderThemeContext] must be used within a ReaderThemeProvider",
    );
  }
  return context;
}

/**
 * ReaderThemeProvider Props
 */
export interface ReaderThemeProviderProps extends WithChildren, WithClassName {
  /** 主题 Hook 选项 */
  options?: UseReaderThemeOptions;
  /** 初始主题（优先级低于 localStorage） */
  initialTheme?: ThemeId;
}

/**
 * 阅读器主题 Provider
 *
 * 功能：
 * - 提供主题 Context
 * - 应用 CSS 变量到容器元素
 * - 支持 data-theme 属性用于 CSS 选择器
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ReaderThemeProvider className="min-h-screen">
 *       <ReaderContent />
 *     </ReaderThemeProvider>
 *   );
 * }
 * ```
 */
export function ReaderThemeProvider({
  children,
  className,
  options,
  initialTheme,
}: ReaderThemeProviderProps): ReactNode {
  const { theme, setTheme, themes, isMounted } = useReaderTheme({
    defaultTheme: initialTheme,
    ...options,
  });

  // Memoize context value to avoid unnecessary re-renders
  const contextValue = useMemo<ReaderThemeContextValue>(
    () => ({
      theme,
      setTheme,
      themes,
    }),
    [theme, setTheme, themes],
  );

  // Generate CSS variables from theme
  const cssVariables = useMemo(() => {
    return themeToCssVariables(theme);
  }, [theme]);

  // Build style object with CSS variables
  const containerStyle = useMemo<CSSProperties>(() => {
    const style: Record<string, string> = {};
    for (const [key, value] of Object.entries(cssVariables)) {
      style[key] = value;
    }
    // Apply background and foreground colors directly
    style.backgroundColor = theme.colors.background;
    style.color = theme.colors.foreground;
    return style as CSSProperties;
  }, [cssVariables, theme.colors]);

  // SSR: render with default styles to avoid hydration mismatch
  // Client: apply actual theme after mount
  if (!isMounted) {
    return (
      <ReaderThemeContext.Provider value={contextValue}>
        <div
          className={cn(
            "reader-theme-container transition-colors duration-200 h-full flex flex-col",
            className,
          )}
          data-theme="light"
          style={{
            backgroundColor: "#ffffff",
            color: "#1a1a1a",
          }}
        >
          {children}
        </div>
      </ReaderThemeContext.Provider>
    );
  }

  return (
    <ReaderThemeContext.Provider value={contextValue}>
      <div
        className={cn(
          "reader-theme-container transition-colors duration-200 h-full flex flex-col",
          className,
        )}
        data-theme={theme.id}
        style={containerStyle}
      >
        {children}
      </div>
    </ReaderThemeContext.Provider>
  );
}

export default ReaderThemeProvider;
