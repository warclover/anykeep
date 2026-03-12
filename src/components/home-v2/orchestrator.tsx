/**
 * Home V2 Orchestrator
 *
 * 设计原则：
 * - 零业务逻辑 hooks，纯组合层（解决 A7）
 * - 仅包含视图模式管理（低频状态，适合在此管理）
 * - Provider 层级精简（解决 A16）
 *
 * @since home-v2
 */

"use client";

import { lazy, Suspense, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useHomeViewMode } from "@/components/home/hooks/use-home-view-mode";
import { uiEventBus, UIEvents } from "@/lib/shared/event-bus";
import { useHomeV2Store } from "@/stores/home-v2-store";
import { HomeV2DataProvider } from "./providers/home-v2-data-provider";
import { HomeV2ToolbarContainer } from "./toolbar-container";
import { HomeV2ContentContainer } from "./content-container";
import type { BookmarkWithFolder } from "@/components/home/types";

// 懒加载对话框层 — 从首屏 JS 移除
const HomeV2DialogLayer = lazy(() =>
  import("./dialog-layer").then((mod) => ({
    default: mod.HomeV2DialogLayer,
  })),
);

// ============================================================================
// Props
// ============================================================================

export interface HomeV2OrchestratorProps {
  /** SSR 预加载的初始书签 */
  initialBookmarks?: BookmarkWithFolder[];
  /** SSR 错误信息 */
  initialError?: string;
  /** 用户设置 */
  userSettings?: { notifications?: { showWelcomeMessage?: boolean } };
}

// ============================================================================
// 组件实现
// ============================================================================

export function HomeV2Orchestrator({
  initialBookmarks,
  initialError,
  userSettings,
}: HomeV2OrchestratorProps) {
  const searchParams = useSearchParams();

  // URL 参数一次解析
  const urlParams = useMemo(
    () => ({
      platform: searchParams?.get("platform") ?? "",
      sort: searchParams?.get("sort") ?? "created_desc",
      folder: searchParams?.get("folder") ?? "",
    }),
    [searchParams],
  );

  // 派生状态
  const isBrowserPlatform = urlParams.platform === "browser";
  const isTrashFolder = urlParams.folder === "trash";

  // 视图模式管理（低频状态，复用旧 hook）
  const {
    viewMode,
    setViewMode,
    layoutMode,
    setLayoutMode,
    enableFlipCard,
    setEnableFlipCard,
  } = useHomeViewMode({ isBrowserPlatform });

  const handleFlipCardToggle = useCallback(() => {
    const newValue = !enableFlipCard;
    setEnableFlipCard(newValue);
    uiEventBus.emit(UIEvents.FLIP_CARD_CHANGE, { enabled: newValue });
  }, [enableFlipCard, setEnableFlipCard]);

  const handleOpenBrowserImport = useCallback(() => {
    useHomeV2Store.getState().openDialog("browserImport");
  }, []);

  const showWelcomeMessage =
    userSettings?.notifications?.showWelcomeMessage ?? false;

  return (
    <HomeV2DataProvider
      initialBookmarks={initialBookmarks}
      platform={urlParams.platform}
      sort={urlParams.sort}
      folder={urlParams.folder}
      viewMode={viewMode}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* 工具栏 */}
        <HomeV2ToolbarContainer
          viewMode={viewMode}
          layoutMode={layoutMode}
          enableFlipCard={enableFlipCard}
          onViewModeChange={setViewMode}
          onLayoutModeChange={setLayoutMode}
          onFlipCardToggle={handleFlipCardToggle}
          isBrowserPlatform={isBrowserPlatform}
          isTrashFolder={isTrashFolder}
        />

        {/* 内容区 */}
        <HomeV2ContentContainer
          initialError={initialError}
          showWelcomeMessage={showWelcomeMessage}
          viewMode={viewMode}
          layoutMode={layoutMode}
          enableFlipCard={enableFlipCard}
          isBrowserPlatform={isBrowserPlatform}
          isTrashFolder={isTrashFolder}
          onOpenImportDialog={handleOpenBrowserImport}
        />

        {/* 对话框层（懒加载） */}
        <Suspense fallback={null}>
          <HomeV2DialogLayer />
        </Suspense>
      </div>
    </HomeV2DataProvider>
  );
}
