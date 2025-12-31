/**
 * 主动简报卡片组件
 *
 * 展示用户上线后的主动汇报，包含离线期间的洞察和建议操作
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { InsightItem } from "./insight-item";
import { ActionButtonGroup } from "./action-button";
import { BriefingSkeleton } from "./briefing-skeleton";
import type {
  ProactiveBriefing,
  ProactiveInsight,
  SuggestedAction,
} from "@/lib/ai-agent/proactive-briefing";

// ============================================
// 类型定义
// ============================================

export interface ProactiveBriefingCardProps {
  /** 简报数据 */
  briefing: ProactiveBriefing | null;
  /** 是否加载中 */
  loading?: boolean;
  /** 关闭/忽略回调 */
  onDismiss?: () => void;
  /** 操作点击回调 */
  onActionClick?: (action: SuggestedAction) => void;
  /** 洞察点击回调 */
  onInsightClick?: (insight: ProactiveInsight) => void;
  /** 当前执行中的操作 ID */
  executingActionId?: string;
  /** 是否默认展开 */
  defaultExpanded?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 动画配置
// ============================================

const cardVariants = {
  hidden: { opacity: 0, y: -20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.95,
    transition: {
      duration: 0.2,
      ease: "easeIn",
    },
  },
};

const contentVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      duration: 0.15,
    },
  },
};

// ============================================
// 组件实现
// ============================================

/**
 * 主动简报卡片
 *
 * @example
 * ```tsx
 * <ProactiveBriefingCard
 *   briefing={briefingData}
 *   loading={isLoading}
 *   onDismiss={() => setBriefingVisible(false)}
 *   onActionClick={handleAction}
 *   onInsightClick={handleInsight}
 * />
 * ```
 */
export function ProactiveBriefingCard({
  briefing,
  loading = false,
  onDismiss,
  onActionClick,
  onInsightClick,
  executingActionId,
  defaultExpanded = true,
  className,
}: ProactiveBriefingCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [dismissed, setDismissed] = useState(false);

  // 处理关闭
  const handleDismiss = useCallback(() => {
    setDismissed(true);
    // 延迟触发回调，等待动画完成
    setTimeout(() => {
      onDismiss?.();
    }, 200);
  }, [onDismiss]);

  // 切换展开/收起
  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // 加载状态
  if (loading) {
    return <BriefingSkeleton className={className} />;
  }

  // 无数据或已忽略
  if (!briefing || !briefing.enabled || dismissed) {
    return null;
  }

  // 无洞察内容
  if (
    briefing.pendingInsights.length === 0 &&
    briefing.suggestedActions.length === 0
  ) {
    return null;
  }

  const unreadCount = briefing.pendingInsights.filter((i) => !i.isRead).length;

  return (
    <AnimatePresence>
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <Card
          className={cn(
            "border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background",
            "shadow-sm hover:shadow-md transition-shadow",
            className,
          )}
          data-testid="proactive-briefing-card"
        >
          {/* 头部 */}
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              {/* 左侧：图标和标题 */}
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium text-foreground">秘书汇报</span>
                {briefing.daysSinceLastVisit > 0 && (
                  <Badge
                    variant="secondary"
                    className="gap-1 text-xs font-normal"
                  >
                    <Clock className="h-3 w-3" />
                    {briefing.daysSinceLastVisit} 天未见
                  </Badge>
                )}
                {unreadCount > 0 && (
                  <Badge variant="default" className="text-xs">
                    {unreadCount} 条新洞察
                  </Badge>
                )}
              </div>

              {/* 右侧：操作按钮 */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleExpanded}
                  className="h-8 w-8 p-0"
                  aria-label={expanded ? "收起" : "展开"}
                >
                  {expanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="mr-1 h-3 w-3" />
                  稍后再看
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* 内容 */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <CardContent className="space-y-4 pt-0">
                  {/* 摘要 */}
                  {briefing.topicChangeSummary && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {briefing.topicChangeSummary}
                    </p>
                  )}

                  {/* 简要统计 */}
                  {briefing.newCollectionsCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      离线期间新增{" "}
                      <span className="font-medium text-foreground">
                        {briefing.newCollectionsCount}
                      </span>{" "}
                      条收藏
                    </p>
                  )}

                  {/* 洞察列表 */}
                  {briefing.pendingInsights.length > 0 && (
                    <div className="space-y-2">
                      {briefing.pendingInsights.slice(0, 3).map((insight) => (
                        <InsightItem
                          key={insight.id}
                          insight={insight}
                          onClick={onInsightClick}
                        />
                      ))}
                      {briefing.pendingInsights.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center py-1">
                          还有 {briefing.pendingInsights.length - 3} 条洞察
                        </p>
                      )}
                    </div>
                  )}

                  {/* 建议操作 */}
                  {briefing.suggestedActions.length > 0 && (
                    <ActionButtonGroup
                      actions={briefing.suggestedActions}
                      onActionClick={onActionClick}
                      executingActionId={executingActionId}
                    />
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// 紧凑版简报卡片
// ============================================

export interface CompactBriefingCardProps {
  /** 简报数据 */
  briefing: ProactiveBriefing | null;
  /** 点击展开详情 */
  onClick?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 紧凑版简报卡片
 *
 * 用于侧边栏或通知区域
 */
export function CompactBriefingCard({
  briefing,
  onClick,
  className,
}: CompactBriefingCardProps) {
  if (!briefing || !briefing.enabled) {
    return null;
  }

  const unreadCount = briefing.pendingInsights.filter((i) => !i.isRead).length;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border border-primary/20 bg-primary/5 p-3",
        "hover:bg-primary/10 transition-colors",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">秘书有新汇报</span>
        {unreadCount > 0 && (
          <Badge variant="default" className="text-xs">
            {unreadCount}
          </Badge>
        )}
      </div>
      {briefing.topicChangeSummary && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {briefing.topicChangeSummary}
        </p>
      )}
    </button>
  );
}
