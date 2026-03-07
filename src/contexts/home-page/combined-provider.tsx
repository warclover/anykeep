/**
 * 组合 Provider 和兼容层
 *
 * Phase 2 性能优化：提供向后兼容的 API，支持渐进式迁移
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { useContext, useMemo, type ReactNode } from "react";
import {
  ViewModeProvider,
  useViewMode,
  ViewModeContext,
} from "./view-mode-context";
import { FilterProvider, useFilter, FilterContext } from "./filter-context";
import { DialogProvider, useDialog, DialogContext } from "./dialog-context";
import {
  SelectionProvider,
  useSelection,
  SelectionContext,
} from "./selection-context";
import {
  AIPanelProvider,
  useAIPanel,
  AIPanelContext,
} from "./ai-panel-context";

import type { ViewModeContextType } from "./view-mode-context";
import type { FilterContextType } from "./filter-context";
import type { DialogContextType } from "./dialog-context";
import type { SelectionContextType } from "./selection-context";
import type { AIPanelContextType } from "./ai-panel-context";

// ============================================================================
// 组合类型定义（兼容层）
// ============================================================================

export interface HomePageContextTypeV2 {
  view: ViewModeContextType;
  filter: FilterContextType;
  dialog: DialogContextType;
  selection: SelectionContextType;
  aiPanel: AIPanelContextType;
}

// ============================================================================
// 组合 Provider
// ============================================================================

interface HomePageProviderV2Props {
  children: ReactNode;
  initialPlatform?: string;
  initialFolder?: string;
  initialUsageTags?: string[];
}

/**
 * 组合 Provider（V2 版本）
 *
 * 将 5 个独立 Context Provider 组合在一起，提供统一的入口
 * 可以替换原有的 HomePageProvider
 */
export function HomePageProviderV2({
  children,
  initialPlatform = "",
  initialFolder = "",
  initialUsageTags = [],
}: HomePageProviderV2Props) {
  return (
    <ViewModeProvider>
      <FilterProvider
        initialPlatform={initialPlatform}
        initialFolder={initialFolder}
        initialUsageTags={initialUsageTags}
      >
        <DialogProvider>
          <SelectionProvider>
            <AIPanelProvider>{children}</AIPanelProvider>
          </SelectionProvider>
        </DialogProvider>
      </FilterProvider>
    </ViewModeProvider>
  );
}

// ============================================================================
// 兼容层 Hooks
// ============================================================================

/**
 * 兼容层：获取完整的首页 Context（V2 版本）
 *
 * 这是一个兼容层 Hook，将 5 个独立 Context 组合成原有的 API 结构
 * 推荐逐步迁移到细粒度 Hook（useViewMode, useFilter 等）
 *
 * @deprecated 推荐使用细粒度 Hook: useViewMode, useFilter, useDialog, useSelection, useAIPanel
 */
export function useHomePageContextV2(): HomePageContextTypeV2 {
  const view = useViewMode();
  const filter = useFilter();
  const dialog = useDialog();
  const selection = useSelection();
  const aiPanel = useAIPanel();

  return useMemo(
    () => ({
      view,
      filter,
      dialog,
      selection,
      aiPanel,
    }),
    [view, filter, dialog, selection, aiPanel],
  );
}

/**
 * 安全版本的兼容层
 *
 * 直接使用 useContext 读取各 Context，避免调用会 throw 的强类型 Hook，
 * 确保 Hooks 调用次数在每次渲染中保持一致（符合 Rules of Hooks）
 */
export function useHomePageSafeV2(): HomePageContextTypeV2 | null {
  const view = useContext(ViewModeContext);
  const filter = useContext(FilterContext);
  const dialog = useContext(DialogContext);
  const selection = useContext(SelectionContext);
  const aiPanel = useContext(AIPanelContext);

  if (!view || !filter || !dialog || !selection || !aiPanel) return null;

  return { view, filter, dialog, selection, aiPanel };
}
