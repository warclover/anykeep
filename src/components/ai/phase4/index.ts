/**
 * Phase 4: 交互升级组件
 *
 * @version 1.3.0
 * @since 2025-12-25
 */

// 类型导出
export type {
  ToolType,
  ContextItem,
  ToolDefinition,
  ContextPanelState,
} from "./types";

// 工具选择器
export {
  ToolSelector,
  ToolSelectorCompact,
  ToolSelectorFull,
  useToolShortcuts,
  TOOLS,
} from "./tool-selector";
export type { ToolSelectorProps } from "./tool-selector";

// 工具下拉菜单（YouMind 风格）
export {
  ToolDropdown,
  TOOL_GROUPS,
  findToolInfo,
  getToolDisplayName,
  getToolIcon,
} from "./tool-dropdown";
export type { ToolDropdownProps, ToolGroup, SubTool } from "./tool-dropdown";

// 上下文面板
export {
  ContextIndicator,
  ContextPanel,
  useContextItems,
} from "./context-panel";
export type {
  ContextIndicatorProps,
  ContextPanelProps,
  ContextReferences,
  UseContextItemsOptions,
} from "./context-panel";

// 欢迎界面
export { AIWelcomeScreen } from "./ai-welcome-screen";
export type { AIWelcomeScreenProps } from "./ai-welcome-screen";

// 建议栏
export { AISuggestionBar } from "./ai-suggestion-bar";
export type { AISuggestionBarProps } from "./ai-suggestion-bar";

// 意图纠正对话框
export { IntentCorrectionDialog } from "./intent-correction-dialog";
