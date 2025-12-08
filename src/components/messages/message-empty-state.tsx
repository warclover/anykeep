/**
 * 消息空状态组件
 * @description 无消息时的空状态展示
 */

"use client";

import { Inbox } from "lucide-react";

// ============================================
// 类型定义
// ============================================

export interface MessageEmptyStateProps {
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
}

// ============================================
// 组件实现
// ============================================

export function MessageEmptyState({
  title = "暂无消息",
  description = "系统通知和操作记录将显示在这里",
}: MessageEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex items-center justify-center size-16 rounded-full bg-muted mb-4">
        <Inbox className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        {description}
      </p>
    </div>
  );
}
