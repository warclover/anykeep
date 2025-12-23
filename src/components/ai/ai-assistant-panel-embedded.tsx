/**
 * 内嵌式 AI 助手面板组件
 *
 * 用于挤压式布局，与内容区并排显示
 * 不使用 Sheet 覆盖，而是作为布局的一部分
 *
 * @version 1.0.0
 * @since 2025-12-23
 */

"use client";

import { cn } from "@/lib/utils";
import { AIPanelContent } from "./ai-panel-content";

interface AIAssistantPanelEmbeddedProps {
  /** 是否展开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 对话 ID（可选） */
  conversationId?: string;
  /** 关联的书签 ID 列表（可选） */
  bookmarkIds?: number[];
  /** 面板标题 */
  title?: string;
  /** 自定义 className */
  className?: string;
}

/**
 * 内嵌式 AI 助手面板组件
 *
 * 特点：
 * - 固定宽度 360px
 * - 与卡片区并排显示
 * - 支持平滑过渡动画
 * - 有关闭按钮
 */
export function AIAssistantPanelEmbedded({
  open,
  onClose,
  conversationId,
  bookmarkIds,
  title = "AI 知识助手",
  className,
}: AIAssistantPanelEmbeddedProps) {
  return (
    <div
      className={cn(
        // 基础样式 - 圆角卡片风格
        "flex-shrink-0 bg-white dark:bg-gray-900 rounded-l-2xl border border-r-0 border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden",
        // 外边距，让面板悬浮感更强
        "my-3 mr-0",
        // 过渡动画
        "transition-all duration-300 ease-in-out",
        // 展开/收起状态
        open ? "w-[360px] opacity-100" : "w-0 opacity-0",
        className,
      )}
      style={{
        // 确保收起时不占用空间
        visibility: open ? "visible" : "hidden",
      }}
    >
      {/* 只在展开时渲染内容，避免性能浪费 */}
      {open && (
        <div className="w-[360px] h-full">
          <AIPanelContent
            conversationId={conversationId}
            bookmarkIds={bookmarkIds}
            title={title}
            showCloseButton={true}
            onClose={onClose}
          />
        </div>
      )}
    </div>
  );
}
