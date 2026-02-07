/**
 * 首页状态 Context（兼容层）
 *
 * ⚠️ 重要：此文件现在是兼容层，实际实现已拆分到 src/contexts/home-page/
 *
 * Phase 2 性能优化（2026-02-07）：
 * - 将 591 行的巨型 Context 拆分为 5 个独立 Context
 * - 每个 Context 独立管理状态，减少不必要的重渲染
 * - 此文件保留向后兼容，逐步迁移到细粒度 Hook
 *
 * 推荐迁移路径：
 * - useHomeViewMode() → useViewMode() from "@/contexts/home-page"
 * - useHomeFilter() → useFilter() from "@/contexts/home-page"
 * - useHomeDialogs() → useDialog() from "@/contexts/home-page"
 * - useHomeSelection() → useSelection() from "@/contexts/home-page"
 * - useHomeAIPanel() → useAIPanel() from "@/contexts/home-page"
 *
 * @version 5.0.0
 * @since 2026-02-07
 */

"use client";

import type { ReactNode } from "react";

// 重新导出新的拆分 Context
export {
  // Provider
  HomePageProviderV2 as HomePageProvider,
  // 兼容层 Hook
  useHomePageContextV2 as useHomePageContext,
  useHomePageSafeV2 as useHomePageSafe,
  // 细粒度 Hook（推荐）
  useViewMode as useHomeViewMode,
  useFilter as useHomeFilter,
  useDialog as useHomeDialogs,
  useSelection as useHomeSelection,
  useAIPanel as useHomeAIPanel,
  // Context（供高级用例）
  ViewModeContext,
  FilterContext,
  DialogContext,
  SelectionContext,
  AIPanelContext,
} from "./home-page";

// 重新导出类型
export type {
  HomePageContextTypeV2 as HomePageContextType,
  ViewModeContextType,
  FilterContextType,
  DialogContextType,
  SelectionContextType,
  AIPanelContextType,
} from "./home-page";

// 保留旧的 Context 引用（向后兼容）
import { ViewModeContext } from "./home-page";
export const HomePageContext = ViewModeContext;

// 兼容层 Provider Props
export interface HomePageProviderProps {
  children: ReactNode;
  initialPlatform?: string;
  initialFolder?: string;
  initialUsageTags?: string[];
  enableEventBridge?: boolean;
}
