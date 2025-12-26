/**
 * 布局级 AI 助手面板容器
 *
 * 在 layout 层级集成 AI 面板，实现与主内容区的挤压式布局
 * 使用 HomePageContext 管理面板状态
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

"use client";

import { AIAssistantPanelEmbedded } from "@/components/ai";
import { useHomePageSafe } from "@/contexts/home-page-context";
import { useOptionalUser } from "@/contexts/user-context";

/**
 * 布局级 AI 面板容器
 *
 * 包含：
 * - 内嵌式 AI 面板（挤压式布局）
 * - 悬浮触发按钮
 */
export function LayoutAIPanel() {
  // 安全获取 Context（可能不在 Provider 内）
  const homeContext = useHomePageSafe();
  const userContext = useOptionalUser();

  // 如果没有 Context 或用户未登录，不显示
  if (!homeContext || !userContext?.user?.id) {
    return null;
  }

  const { isAIPanelOpen, closeAIPanel } = homeContext.aiPanel;

  return (
    <>
      {/* 内嵌式 AI 面板（与 MainContentWrapper 同级，实现挤压效果） */}
      <AIAssistantPanelEmbedded
        open={isAIPanelOpen}
        onClose={closeAIPanel}
        title="AI 知识助手"
      />
    </>
  );
}
