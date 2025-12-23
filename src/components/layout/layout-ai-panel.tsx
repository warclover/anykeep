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

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const { isAIPanelOpen, closeAIPanel, toggleAIPanel } = homeContext.aiPanel;

  return (
    <>
      {/* 内嵌式 AI 面板（与 MainContentWrapper 同级，实现挤压效果） */}
      <AIAssistantPanelEmbedded
        open={isAIPanelOpen}
        onClose={closeAIPanel}
        title="AI 知识助手"
      />

      {/* 悬浮触发按钮 */}
      {!isAIPanelOpen && (
        <div className="fixed bottom-6 right-6 z-50 max-lg:bottom-24">
          <Button
            size="icon"
            onClick={toggleAIPanel}
            className="w-14 h-14 rounded-full shadow-xl hover:shadow-2xl transition-shadow bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
            title="打开 AI 助手"
          >
            <Sparkles className="size-6 text-white" />
          </Button>
        </div>
      )}
    </>
  );
}
