"use client";

/**
 * PendingConfirmations
 * 待确认分类建议 - 主入口组件
 *
 * @description
 * - 模式切换控制器
 * - 根据用户偏好显示内联模式或浮动模式
 * - 静默加载，无消息时不显示
 *
 * @version 2.0.0
 * @since 2025-12-14
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useConfirmations, useDisplayMode } from "./hooks";
import { InlineNotificationBar, InlineExpandedList } from "./inline";
import { FloatingButton, ConfirmationDrawer } from "./drawer";
import type { PendingConfirmationsProps } from "./types";

// ============================================================================
// 主组件
// ============================================================================

export function PendingConfirmations({ className }: PendingConfirmationsProps) {
  // 数据和操作
  const {
    messages,
    folders,
    isLoading,
    count,
    averageConfidence,
    confirm,
    reject,
    modify,
    confirmAll,
    rejectAll,
  } = useConfirmations();

  // 展示模式
  const { mode, toggleMode } = useDisplayMode();

  // 内联模式的展开状态
  const [isExpanded, setIsExpanded] = useState(false);

  // 抽屉模式的打开状态
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 是否是新消息（用于浮动按钮动画）
  const [isNew, setIsNew] = useState(true);

  // 如果没有待确认消息且不在加载中，不显示
  if (count === 0 && !isLoading) {
    return null;
  }

  // 处理模式切换
  const handleModeChange = () => {
    toggleMode();
    // 切换到抽屉模式时自动打开抽屉
    if (mode === "inline") {
      setIsDrawerOpen(true);
    }
  };

  // 处理一键确认（所有消息）
  const handleConfirmAll = async () => {
    await confirmAll();
  };

  // 处理全部忽略
  const handleRejectAll = async () => {
    await rejectAll();
  };

  // 处理浮动按钮点击
  const handleFloatingClick = () => {
    setIsDrawerOpen(true);
    setIsNew(false); // 点击后取消新消息状态
  };

  // ============================================================================
  // 内联模式渲染
  // ============================================================================

  if (mode === "inline") {
    return (
      <div className={cn("mb-4", className)}>
        {/* 通知条 */}
        <InlineNotificationBar
          messages={messages}
          averageConfidence={averageConfidence}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onConfirmAll={handleConfirmAll}
          onModeChange={handleModeChange}
          isLoading={isLoading}
        />

        {/* 展开列表 */}
        {isExpanded && (
          <InlineExpandedList
            messages={messages}
            folders={folders}
            onConfirm={confirm}
            onReject={reject}
            onModify={modify}
            onConfirmAll={handleConfirmAll}
            onRejectAll={handleRejectAll}
          />
        )}
      </div>
    );
  }

  // ============================================================================
  // 浮动模式渲染
  // ============================================================================

  return (
    <>
      {/* 浮动按钮 */}
      <FloatingButton
        count={count}
        onClick={handleFloatingClick}
        isNew={isNew}
      />

      {/* 侧边抽屉 */}
      <ConfirmationDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        messages={messages}
        folders={folders}
        onConfirm={confirm}
        onReject={reject}
        onModify={modify}
        onConfirmAll={handleConfirmAll}
        onRejectAll={handleRejectAll}
        onModeChange={handleModeChange}
      />
    </>
  );
}

// 保持旧名称兼容性
export { PendingConfirmations as PendingConfirmationsSection };

// 导出类型
export * from "./types";
