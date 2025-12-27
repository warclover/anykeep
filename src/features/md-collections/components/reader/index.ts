/**
 * MD 阅读器组件模块
 * Spec: md-reader-upgrade
 */

// 主题 Provider
export {
  ReaderThemeProvider,
  useReaderThemeContext,
} from "./reader-theme-provider";
export type { ReaderThemeProviderProps } from "./reader-theme-provider";

// 主题切换器
export { ThemeSwitcher } from "./theme-switcher";
export type { ThemeSwitcherProps } from "./theme-switcher";

// 阅读进度
export { ReadingProgress, ReadingProgressCompact } from "./reading-progress";
export type { ReadingProgressProps } from "./reading-progress";

// 位置恢复提示
export { PositionRestorePrompt } from "./position-restore-prompt";
export type { PositionRestorePromptProps } from "./position-restore-prompt";

// 专注模式
export {
  FocusModeProvider,
  FocusModeContainer,
  FocusModeToolbar,
  FocusModeToggle,
  useFocusModeContext,
} from "./focus-mode";
export type {
  FocusModeProviderProps,
  FocusModeContainerProps,
  FocusModeToolbarProps,
  FocusModeToggleProps,
} from "./focus-mode";

// 图片灯箱
export { ImageLightbox, useImageLightbox } from "./image-lightbox";
export type { UseImageLightboxResult } from "./image-lightbox";

// 增强代码块
export { CodeBlockEnhanced } from "./code-block-enhanced";

// 高亮工具栏
export { HighlightToolbar } from "./highlight-toolbar";

// 高亮 Provider
export { HighlightProvider, useHighlightContext } from "./highlight-provider";
export type { HighlightProviderProps } from "./highlight-provider";

// 键盘导航帮助
export { KeyboardNavHelp } from "./keyboard-nav-help";
export type { KeyboardNavHelpProps } from "./keyboard-nav-help";
