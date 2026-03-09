/**
 * 主动简报卡片组件
 *
 * 用于在首页展示用户上线时的主动简报
 * 包含离线变化统计、洞察列表和建议操作
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

"use client";

import { memo } from "react";
import {
  Sparkles,
  RefreshCw,
  X,
  ChevronRight,
  Clock,
  TrendingUp,
  Lightbulb,
  AlertCircle,
  Link,
  FolderTree,
  Tag,
  Archive,
  GraduationCap,
  Trash2,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useBriefing } from "@/hooks/domain/ai";
import type {
  ProactiveBriefing,
  ProactiveInsight,
  SuggestedAction,
  InsightType,
  ActionType,
} from "@/lib/ai-agent/proactive-briefing";
import { BriefingSkeleton } from "./briefing-skeleton";

// ============================================
// 常量配置
// ============================================

const INSIGHT_ICON_MAP: Record<InsightType, React.ReactNode> = {
  topic_emergence: <Sparkles className="size-4" />,
  pattern_detected: <TrendingUp className="size-4" />,
  recommendation: <Lightbulb className="size-4" />,
  knowledge_gap: <AlertCircle className="size-4" />,
  content_update: <RefreshCw className="size-4" />,
  link_health: <Link className="size-4" />,
};

const INSIGHT_COLOR_MAP: Record<
  InsightType,
  { bg: string; text: string; border: string }
> = {
  topic_emergence: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    border: "border-purple-200",
  },
  pattern_detected: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200",
  },
  recommendation: {
    bg: "bg-yellow-50",
    text: "text-yellow-600",
    border: "border-yellow-200",
  },
  knowledge_gap: {
    bg: "bg-orange-50",
    text: "text-orange-600",
    border: "border-orange-200",
  },
  content_update: {
    bg: "bg-green-50",
    text: "text-green-600",
    border: "border-green-200",
  },
  link_health: {
    bg: "bg-red-50",
    text: "text-red-600",
    border: "border-red-200",
  },
};

const ACTION_ICON_MAP: Record<ActionType, React.ReactNode> = {
  organize_topic: <FolderTree className="size-4" />,
  cleanup_duplicates: <Trash2 className="size-4" />,
  tag_untagged: <Tag className="size-4" />,
  archive_old: <Archive className="size-4" />,
  start_learning: <GraduationCap className="size-4" />,
};

// ============================================
// 子组件
// ============================================

/**
 * 简报摘要头部
 */
const BriefingHeader = memo(function BriefingHeader({
  briefing,
  onRefresh,
  onMarkAllRead,
  isRefreshing,
  unreadCount,
}: {
  briefing: ProactiveBriefing;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  isRefreshing: boolean;
  unreadCount: number;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 text-white">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800">欢迎回来！</h3>
          <p className="text-xs text-gray-500">
            <Clock className="inline size-3 mr-1" />
            你离开了 {briefing.daysSinceLastVisit} 天
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-gray-500 hover:text-gray-700"
            onClick={onMarkAllRead}
          >
            <CheckCheck className="size-3.5 mr-1" />
            全部已读
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
        </Button>
      </div>
    </div>
  );
});

/**
 * 变化统计摘要
 */
const ChangeSummary = memo(function ChangeSummary({
  briefing,
}: {
  briefing: ProactiveBriefing;
}) {
  if (!briefing.topicChangeSummary && briefing.newCollectionsCount === 0) {
    return null;
  }

  return (
    <div className="p-3 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 mb-4">
      {briefing.topicChangeSummary ? (
        <p className="text-sm text-gray-700">{briefing.topicChangeSummary}</p>
      ) : (
        <p className="text-sm text-gray-700">
          在你离开的 {briefing.daysSinceLastVisit} 天里，新增了{" "}
          <span className="font-semibold text-purple-600">
            {briefing.newCollectionsCount}
          </span>{" "}
          条收藏。
        </p>
      )}
    </div>
  );
});

/**
 * 单个洞察卡片
 */
const InsightCard = memo(function InsightCard({
  insight,
  onMarkRead,
  onDismiss,
}: {
  insight: ProactiveInsight;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const colors = INSIGHT_COLOR_MAP[insight.type];
  const icon = INSIGHT_ICON_MAP[insight.type];

  return (
    <div
      className={cn(
        "group relative p-3 rounded-lg border transition-all",
        colors.bg,
        colors.border,
        !insight.isRead && "ring-2 ring-purple-200",
      )}
    >
      {/* 未读标记 */}
      {!insight.isRead && (
        <div className="absolute top-2 right-2 size-2 rounded-full bg-purple-500" />
      )}

      <div className="flex items-start gap-3">
        <div className={cn("p-1.5 rounded-md", colors.bg, colors.text)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-800 mb-1">
            {insight.title}
          </h4>
          <p className="text-xs text-gray-600 line-clamp-2">
            {insight.summary}
          </p>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {!insight.isRead && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => onMarkRead(insight.id)}
          >
            标记已读
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-gray-400 hover:text-gray-600"
          onClick={() => onDismiss(insight.id)}
        >
          <X className="size-3" />
        </Button>
      </div>
    </div>
  );
});

/**
 * 洞察列表
 */
const InsightList = memo(function InsightList({
  insights,
  onMarkRead,
  onDismiss,
}: {
  insights: ProactiveInsight[];
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <Lightbulb className="size-4 text-amber-500" />
        洞察 ({insights.length})
      </h4>
      <div className="space-y-2">
        {insights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            onMarkRead={onMarkRead}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  );
});

/**
 * 建议操作按钮
 */
const SuggestedActionButton = memo(function SuggestedActionButton({
  action,
  onClick,
}: {
  action: SuggestedAction;
  onClick: (action: SuggestedAction) => void;
}) {
  const icon = ACTION_ICON_MAP[action.type];

  return (
    <button
      className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-purple-200 transition-all group w-full text-left"
      onClick={() => onClick(action)}
    >
      <div className="p-1.5 rounded-md bg-gray-100 text-gray-600 group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{action.label}</p>
        <p className="text-xs text-gray-500 truncate">{action.description}</p>
      </div>
      <ChevronRight className="size-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
    </button>
  );
});

/**
 * 建议操作列表
 */
const SuggestedActions = memo(function SuggestedActions({
  actions,
  onActionClick,
}: {
  actions: SuggestedAction[];
  onActionClick: (action: SuggestedAction) => void;
}) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
        <TrendingUp className="size-4 text-blue-500" />
        建议操作
      </h4>
      <div className="space-y-2">
        {actions.map((action) => (
          <SuggestedActionButton
            key={action.id}
            action={action}
            onClick={onActionClick}
          />
        ))}
      </div>
    </div>
  );
});

// ============================================
// 主组件
// ============================================

interface ProactiveBriefingCardProps {
  className?: string;
  /** 点击建议操作的回调 */
  onActionClick?: (action: SuggestedAction) => void;
  /** 是否自动获取简报 */
  autoFetch?: boolean;
}

/**
 * 主动简报卡片
 *
 * @example
 * ```tsx
 * <ProactiveBriefingCard
 *   onActionClick={(action) => console.log("Action clicked:", action)}
 * />
 * ```
 */
export const ProactiveBriefingCard = memo(function ProactiveBriefingCard({
  className,
  onActionClick,
  autoFetch = true,
}: ProactiveBriefingCardProps) {
  const { state, actions } = useBriefing({ autoFetch });

  // 加载中
  if (state.loadState === "loading") {
    return <BriefingSkeleton className={className} />;
  }

  // 无简报数据（不满足生成条件或功能禁用）
  if (!state.briefing) {
    return null;
  }

  const briefing = state.briefing;

  // 没有任何内容可展示
  if (
    briefing.pendingInsights.length === 0 &&
    briefing.suggestedActions.length === 0 &&
    !briefing.topicChangeSummary
  ) {
    return null;
  }

  const handleActionClick = (action: SuggestedAction) => {
    if (onActionClick) {
      onActionClick(action);
    }
    // 无 onActionClick 时暂不处理，等待 Phase 1 集成 AI Chat
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-purple-100 bg-white p-4 shadow-sm",
        className,
      )}
    >
      {/* 头部 */}
      <BriefingHeader
        briefing={briefing}
        onRefresh={actions.refresh}
        onMarkAllRead={actions.markAllRead}
        isRefreshing={state.isRefreshing}
        unreadCount={state.unreadCount}
      />

      {/* 变化摘要 */}
      <ChangeSummary briefing={briefing} />

      {/* 洞察列表 */}
      <InsightList
        insights={briefing.pendingInsights}
        onMarkRead={actions.markRead}
        onDismiss={actions.dismiss}
      />

      {/* 建议操作 */}
      <SuggestedActions
        actions={briefing.suggestedActions}
        onActionClick={handleActionClick}
      />
    </div>
  );
});

export default ProactiveBriefingCard;
