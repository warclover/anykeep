/**
 * HomePageContext 拆分版 - 索引文件
 *
 * Phase 2 性能优化：将原 591 行的 HomePageContext 拆分为 5 个独立 Context
 * 每个 Context 独立管理状态，只有订阅该 Context 的组件才会在其状态变化时重渲染
 *
 * ## 架构说明
 *
 * | Context | 职责 | 状态数 |
 * |---------|------|--------|
 * | ViewModeContext | 视图模式、布局模式、翻转卡片 | 3 |
 * | FilterContext | 平台、文件夹、用途标签筛选 | 5 |
 * | DialogContext | 对话框打开状态 | 1 |
 * | SelectionContext | 批量选择模式 | 1 |
 * | AIPanelContext | AI 面板、筛选面板、创建面板 | 3 |
 *
 * ## 使用方式
 *
 * ```tsx
 * // 细粒度订阅（推荐）
 * import { useViewMode, useFilter } from "@/contexts/home-page";
 *
 * // 兼容层（逐步迁移）
 * import { useHomePageContext } from "@/contexts/home-page";
 * ```
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

// 导出各个独立 Context
export {
  ViewModeContext,
  ViewModeProvider,
  useViewMode,
  useViewModeSafe,
  type ViewModeContextType,
  type ViewModeContextState,
  type ViewModeContextActions,
} from "./view-mode-context";

export {
  FilterContext,
  FilterProvider,
  useFilter,
  useFilterSafe,
  type FilterContextType,
  type FilterContextState,
  type FilterContextActions,
} from "./filter-context";

export {
  DialogContext,
  DialogProvider,
  useDialog,
  useDialogSafe,
  type DialogContextType,
  type DialogContextState,
  type DialogContextActions,
} from "./dialog-context";

export {
  SelectionContext,
  SelectionProvider,
  useSelection,
  useSelectionSafe,
  type SelectionContextType,
  type SelectionContextState,
  type SelectionContextActions,
} from "./selection-context";

export {
  AIPanelContext,
  AIPanelProvider,
  useAIPanel,
  useAIPanelSafe,
  type AIPanelContextType,
  type AIPanelContextState,
  type AIPanelContextActions,
} from "./ai-panel-context";

// 导出组合 Provider 和兼容层
export {
  HomePageProviderV2,
  useHomePageContextV2,
  useHomePageSafeV2,
  type HomePageContextTypeV2,
} from "./combined-provider";
