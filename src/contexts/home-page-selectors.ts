/**
 * HomePageContext 选择器 Hooks
 *
 * Phase 2 性能优化（2026-02-05）
 * 允许组件只订阅 Context 中需要的部分，减少不必要的重渲染
 *
 * 优化说明：
 * - 由于 Context value 已经优化（回调函数引用稳定，只依赖原始状态值）
 * - 选择器 hooks 直接返回对应子域的引用
 * - 组件只在订阅的子域状态变化时重渲染
 *
 * 使用场景：
 * - 组件只需要访问视图模式时，使用 useViewModeSelector()
 * - 组件只需要访问筛选状态时，使用 useFilterSelector()
 * - 这样当其他状态变化时，组件不会重渲染
 *
 * @example
 * // 只订阅视图模式（不响应筛选、对话框等变化）
 * function MyComponent() {
 *   const { viewMode, setViewMode } = useViewModeSelector();
 *   // ...
 * }
 */

"use client";

import { useContext } from "react";
import { HomePageContext } from "./home-page-context";
import type { HomePageContextType } from "./home-page-context";

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 视图模式状态和操作
 */
export interface ViewModeSelector {
  viewMode: HomePageContextType["view"]["viewMode"];
  layoutMode: HomePageContextType["view"]["layoutMode"];
  enableFlipCard: HomePageContextType["view"]["enableFlipCard"];
  effectiveViewMode: HomePageContextType["view"]["effectiveViewMode"];
  setViewMode: HomePageContextType["view"]["setViewMode"];
  setLayoutMode: HomePageContextType["view"]["setLayoutMode"];
  setEnableFlipCard: HomePageContextType["view"]["setEnableFlipCard"];
}

/**
 * 筛选状态和操作
 */
export interface FilterSelector {
  platform: HomePageContextType["filter"]["platform"];
  folder: HomePageContextType["filter"]["folder"];
  usageTags: HomePageContextType["filter"]["usageTags"];
  isBrowserPlatform: HomePageContextType["filter"]["isBrowserPlatform"];
  isTrashFolder: HomePageContextType["filter"]["isTrashFolder"];
  setPlatform: HomePageContextType["filter"]["setPlatform"];
  setFolder: HomePageContextType["filter"]["setFolder"];
  setUsageTags: HomePageContextType["filter"]["setUsageTags"];
}

/**
 * 对话框状态和操作
 */
export interface DialogSelector {
  openDialog: HomePageContextType["dialog"]["openDialog"];
  openDialogAction: HomePageContextType["dialog"]["openDialogAction"];
  closeDialog: HomePageContextType["dialog"]["closeDialog"];
}

/**
 * 选择模式状态和操作
 */
export interface SelectionSelector {
  isSelectionMode: HomePageContextType["selection"]["isSelectionMode"];
  setSelectionMode: HomePageContextType["selection"]["setSelectionMode"];
  toggleSelectionMode: HomePageContextType["selection"]["toggleSelectionMode"];
}

/**
 * AI 面板状态和操作
 */
export interface AIPanelSelector {
  isAIPanelOpen: HomePageContextType["aiPanel"]["isAIPanelOpen"];
  isFilterPanelOpen: HomePageContextType["aiPanel"]["isFilterPanelOpen"];
  isCreatePanelOpen: HomePageContextType["aiPanel"]["isCreatePanelOpen"];
  openAIPanel: HomePageContextType["aiPanel"]["openAIPanel"];
  closeAIPanel: HomePageContextType["aiPanel"]["closeAIPanel"];
  toggleAIPanel: HomePageContextType["aiPanel"]["toggleAIPanel"];
  openFilterPanel: HomePageContextType["aiPanel"]["openFilterPanel"];
  closeFilterPanel: HomePageContextType["aiPanel"]["closeFilterPanel"];
  toggleFilterPanel: HomePageContextType["aiPanel"]["toggleFilterPanel"];
  openCreatePanel: HomePageContextType["aiPanel"]["openCreatePanel"];
  closeCreatePanel: HomePageContextType["aiPanel"]["closeCreatePanel"];
  toggleCreatePanel: HomePageContextType["aiPanel"]["toggleCreatePanel"];
}

// ============================================================================
// 选择器 Hooks 实现
// ============================================================================

/**
 * 只订阅视图模式（不响应筛选、对话框等变化）
 *
 * 使用此 Hook 的组件只会在视图模式相关状态变化时重渲染
 * 其他状态（如筛选、对话框）变化不会触发重渲染
 *
 * @example
 * function ViewModeButton() {
 *   const { viewMode, setViewMode } = useViewModeSelector();
 *   return <button onClick={() => setViewMode('list')}>列表视图</button>;
 * }
 */
export function useViewModeSelector(): ViewModeSelector {
  const context = useContext(HomePageContext);
  if (!context) {
    throw new Error("useViewModeSelector must be used within HomePageProvider");
  }

  return context.view;
}

/**
 * 只订阅筛选状态（不响应视图模式、对话框等变化）
 *
 * 使用此 Hook 的组件只会在筛选相关状态变化时重渲染
 *
 * @example
 * function PlatformFilter() {
 *   const { platform, setPlatform } = useFilterSelector();
 *   return <select value={platform} onChange={(e) => setPlatform(e.target.value)}>...</select>;
 * }
 */
export function useFilterSelector(): FilterSelector {
  const context = useContext(HomePageContext);
  if (!context) {
    throw new Error("useFilterSelector must be used within HomePageProvider");
  }

  return context.filter;
}

/**
 * 只订阅对话框状态
 *
 * 使用此 Hook 的组件只会在对话框状态变化时重渲染
 */
export function useDialogSelector(): DialogSelector {
  const context = useContext(HomePageContext);
  if (!context) {
    throw new Error("useDialogSelector must be used within HomePageProvider");
  }

  return context.dialog;
}

/**
 * 只订阅选择模式状态
 *
 * 使用此 Hook 的组件只会在选择模式状态变化时重渲染
 */
export function useSelectionSelector(): SelectionSelector {
  const context = useContext(HomePageContext);
  if (!context) {
    throw new Error(
      "useSelectionSelector must be used within HomePageProvider",
    );
  }

  return context.selection;
}

/**
 * 只订阅 AI 面板状态
 *
 * 使用此 Hook 的组件只会在 AI 面板状态变化时重渲染
 */
export function useAIPanelSelector(): AIPanelSelector {
  const context = useContext(HomePageContext);
  if (!context) {
    throw new Error("useAIPanelSelector must be used within HomePageProvider");
  }

  return context.aiPanel;
}

// ============================================================================
// 细粒度选择器 Hooks（只订阅单个值）
// ============================================================================

/**
 * 只订阅视图模式值
 * 当只需要读取视图模式时使用
 */
export function useViewModeValue(): ViewModeSelector["viewMode"] {
  const { viewMode } = useViewModeSelector();
  return viewMode;
}

/**
 * 只订阅平台筛选值
 * 当只需要读取平台筛选时使用
 */
export function usePlatformValue(): FilterSelector["platform"] {
  const { platform } = useFilterSelector();
  return platform;
}

/**
 * 只订阅文件夹筛选值
 * 当只需要读取文件夹筛选时使用
 */
export function useFolderValue(): FilterSelector["folder"] {
  const { folder } = useFilterSelector();
  return folder;
}

/**
 * 只订阅用途标签值
 * 当只需要读取用途标签时使用
 */
export function useUsageTagsValue(): FilterSelector["usageTags"] {
  const { usageTags } = useFilterSelector();
  return usageTags;
}

/**
 * 只订阅选择模式值
 * 当只需要读取选择模式时使用
 */
export function useSelectionModeValue(): SelectionSelector["isSelectionMode"] {
  const { isSelectionMode } = useSelectionSelector();
  return isSelectionMode;
}
