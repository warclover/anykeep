/**
 * 消息空状态组件
 * @description 根据不同场景展示相应的空状态
 */

import { Inbox, CheckCircle2, Search, Filter } from "lucide-react";
import type { MessageStatus, MessageLevel } from "@/lib/messages";

// ============================================
// 类型定义
// ============================================

export type EmptyStateVariant =
  | "default" // 从未有消息
  | "all-read" // 全部已读
  | "filtered" // 筛选后无结果
  | "search"; // 搜索无结果

export interface MessageEmptyStateProps {
  /** 空状态类型 */
  variant?: EmptyStateVariant;
  /** 当前筛选的状态 */
  filterStatus?: MessageStatus | "all";
  /** 当前筛选的等级 */
  filterLevel?: MessageLevel;
  /** 自定义标题（覆盖默认） */
  title?: string;
  /** 自定义描述（覆盖默认） */
  description?: string;
}

// ============================================
// 空状态配置
// ============================================

interface EmptyStateConfig {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
}

function getEmptyStateConfig(
  variant: EmptyStateVariant,
  filterStatus?: MessageStatus | "all",
  filterLevel?: MessageLevel,
): EmptyStateConfig {
  switch (variant) {
    case "all-read":
      return {
        icon: CheckCircle2,
        iconBg: "bg-green-100 dark:bg-green-900/30",
        iconColor: "text-green-600 dark:text-green-400",
        title: "全部处理完成",
        description: "你已经处理完所有消息，做得好！",
      };

    case "filtered": {
      // 根据筛选条件生成不同的提示
      let filterHint = "当前筛选条件下";
      if (filterStatus && filterStatus !== "all") {
        const statusLabels: Record<MessageStatus, string> = {
          unread: "未读",
          read: "已读",
          archived: "已归档",
        };
        filterHint = `${statusLabels[filterStatus]}消息中`;
      }
      if (filterLevel) {
        const levelLabels: Record<MessageLevel, string> = {
          silent: "静默级",
          normal: "普通级",
          important: "重要级",
          critical: "紧急级",
        };
        filterHint += filterHint.includes("中")
          ? `的${levelLabels[filterLevel]}消息`
          : `${levelLabels[filterLevel]}消息中`;
      }

      return {
        icon: Filter,
        iconBg: "bg-blue-100 dark:bg-blue-900/30",
        iconColor: "text-blue-600 dark:text-blue-400",
        title: "没有匹配的消息",
        description: `${filterHint}暂无内容，试试调整筛选条件`,
      };
    }

    case "search":
      return {
        icon: Search,
        iconBg: "bg-orange-100 dark:bg-orange-900/30",
        iconColor: "text-orange-600 dark:text-orange-400",
        title: "未找到相关消息",
        description: "试试使用其他关键词搜索",
      };

    case "default":
    default:
      return {
        icon: Inbox,
        iconBg: "bg-muted",
        iconColor: "text-muted-foreground",
        title: "暂无消息",
        description: "系统通知和操作记录将显示在这里",
      };
  }
}

// ============================================
// 组件实现
// ============================================

export function MessageEmptyState({
  variant = "default",
  filterStatus,
  filterLevel,
  title: customTitle,
  description: customDescription,
}: MessageEmptyStateProps) {
  const config = getEmptyStateConfig(variant, filterStatus, filterLevel);
  const IconComponent = config.icon;

  const title = customTitle ?? config.title;
  const description = customDescription ?? config.description;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div
        className={`flex items-center justify-center size-16 rounded-full mb-4 ${config.iconBg}`}
      >
        <IconComponent className={`size-8 ${config.iconColor}`} />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        {description}
      </p>
    </div>
  );
}
