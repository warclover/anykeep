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
import {
  READER_THEMES,
  DEFAULT_THEME_ID,
  themeToCssVariables,
} from "../../lib/reader/theme-config";
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

  // Build style object with CSS variables only
  // 不直接设置 color/backgroundColor，通过 CSS 变量在 .reader-theme-container 类中引用
  // 这样后代元素的 CSS 类（如 .reading-prose）不会被内联 style 覆盖
  const containerStyle = useMemo<CSSProperties>(() => {
    const style: Record<string, string> = {};
    for (const [key, value] of Object.entries(cssVariables)) {
      style[key] = value;
    }
    return style as CSSProperties;
  }, [cssVariables]);

  // SSR 默认主题的 CSS 变量（与 useState(defaultTheme) 保持一致，消除 hydration mismatch）
  const defaultCssVariables = useMemo(
    () => themeToCssVariables(READER_THEMES[DEFAULT_THEME_ID]),
    [],
  );

  // SSR: render with CSS variables for default theme to avoid hydration mismatch
  // Client: apply actual theme CSS variables after mount
  if (!isMounted) {
    return (
      <ReaderThemeContext.Provider value={contextValue}>
        <div
          className={cn(
            "reader-theme-container transition-colors duration-200 h-full flex flex-col",
            className,
          )}
          data-theme={DEFAULT_THEME_ID}
          style={defaultCssVariables as unknown as CSSProperties}
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
