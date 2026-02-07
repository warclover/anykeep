/**
 * HomePageContext 选择器 Hooks
 *
 * Phase 2 性能优化（2026-02-07）
 * 已重构为直接使用拆分后的独立 Context
 *
 * ⚠️ 推荐直接使用新的细粒度 Hook：
 * - useViewMode() from "@/contexts/home-page"
 * - useFilter() from "@/contexts/home-page"
 * - useDialog() from "@/contexts/home-page"
 * - useSelection() from "@/contexts/home-page"
 * - useAIPanel() from "@/contexts/home-page"
 *
 * @version 2.0.0
 * @since 2026-02-07
 */

"use client";

// 直接重新导出新的细粒度 Hook
export {
  useViewMode as useViewModeSelector,
  useFilter as useFilterSelector,
  useDialog as useDialogSelector,
  useSelection as useSelectionSelector,
  useAIPanel as useAIPanelSelector,
  type ViewModeContextType as ViewModeSelector,
  type FilterContextType as FilterSelector,
  type DialogContextType as DialogSelector,
  type SelectionContextType as SelectionSelector,
  type AIPanelContextType as AIPanelSelector,
} from "./home-page";

// ============================================================================
// 细粒度选择器 Hooks（只订阅单个值）
// ============================================================================

import { useViewMode, useFilter, useSelection } from "./home-page";

/**
 * 只订阅视图模式值
 */
export function useViewModeValue() {
  const { viewMode } = useViewMode();
  return viewMode;
}

/**
 * 只订阅平台筛选值
 */
export function usePlatformValue() {
  const { platform } = useFilter();
  return platform;
}

/**
 * 只订阅文件夹筛选值
 */
export function useFolderValue() {
  const { folder } = useFilter();
  return folder;
}

/**
 * 只订阅用途标签值
 */
export function useUsageTagsValue() {
  const { usageTags } = useFilter();
  return usageTags;
}

/**
 * 只订阅选择模式值
 */
export function useSelectionModeValue() {
  const { isSelectionMode } = useSelection();
  return isSelectionMode;
}
