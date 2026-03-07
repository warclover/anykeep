/**
 * 布局级侧边面板容器
 *
 * 在 layout 层级集成所有挤压式面板，实现与主内容区的挤压式布局
 * 使用 HomePageContext 管理面板状态
 *
 * @version 2.0.0 - 添加用途筛选面板和手动创建面板
 * @since 2025-12-23
 */

"use client";

import { AIAssistantPanelEmbedded } from "@/components/ai";
import { FilterPanelEmbedded } from "@/components/layout/filter-panel-embedded";
import { CreatePanelEmbedded } from "@/components/layout/create-panel-embedded";
import { useAIPanelSafe } from "@/contexts/home-page";
import { useOptionalUser } from "@/contexts/user-context";

/**
 * 布局级侧边面板容器
 *
 * 包含：
 * - 内嵌式 AI 面板（挤压式布局）
 * - 用途筛选面板（挤压式布局）
 * - 手动创建面板（挤压式布局）
 */
export function LayoutAIPanel() {
  // P0-2: 细粒度 Context 订阅（仅 aiPanel）
  const aiPanelContext = useAIPanelSafe();
  const userContext = useOptionalUser();

  // 如果没有 Context 或用户未登录，不显示
  if (!aiPanelContext || !userContext?.user?.id) {
    return null;
  }

  const {
    isAIPanelOpen,
    isFilterPanelOpen,
    isCreatePanelOpen,
    closeAIPanel,
    closeFilterPanel,
    closeCreatePanel,
  } = aiPanelContext;

  return (
    <>
      {/* 手动创建面板（优先级最低，显示在最左） */}
      <CreatePanelEmbedded
        open={isCreatePanelOpen}
        onClose={closeCreatePanel}
      />

      {/* 用途筛选面板 */}
      <FilterPanelEmbedded
        open={isFilterPanelOpen}
        onClose={closeFilterPanel}
      />

      {/* AI 面板（优先级最高，显示在最右） */}
      <AIAssistantPanelEmbedded
        open={isAIPanelOpen}
        onClose={closeAIPanel}
        title="AI 知识助手"
      />
    </>
  );
}
