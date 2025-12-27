/**
 * CleanupPreview - 重复清理预览组件
 *
 * 用于显示 DuplicateCleanupSkill 检测到的重复书签，
 * 支持预览、确认和批量清理操作。
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

"use client";

import { memo, useState } from "react";
import {
  Trash2,
  FileWarning,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Link2,
  Folder,
  Tag,
  FileText,
  AlertTriangle,
  Merge,
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AIMarkdown } from "../ai-markdown";
import type {
  DuplicateCleanupOutput,
  DuplicateGroup,
  DuplicateBookmark,
  DuplicateStrategy,
  CleanupAction,
} from "@/lib/ai-skills/skills/duplicate-cleanup";

// ============================================
// 类型定义
// ============================================

interface CleanupPreviewProps {
  /** 清理预览数据 */
  data: DuplicateCleanupOutput;
  /** 确认清理回调 */
  onConfirmCleanup?: (bookmarkIdsToDelete: number[]) => void;
  /** 打开书签详情回调 */
  onOpenBookmark?: (bookmarkId: number, url: string) => void;
  /** 自定义类名 */
  className?: string;
  /** 是否为只读模式（已执行） */
  readonly?: boolean;
}

interface DuplicateGroupCardProps {
  /** 重复组数据 */
  group: DuplicateGroup;
  /** 选中要删除的书签 ID 集合 */
  selectedToDelete: Set<number>;
  /** 切换选中状态 */
  onToggleSelect: (bookmarkId: number) => void;
  /** 打开书签详情回调 */
  onOpenBookmark?: (bookmarkId: number, url: string) => void;
  /** 是否为只读模式 */
  readonly?: boolean;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取策略配置
 */
function getStrategyConfig(strategy: DuplicateStrategy) {
  const configs = {
    exact: {
      label: "完全相同",
      color: "text-red-600",
      bgColor: "bg-red-50",
      description: "URL 完全匹配",
    },
    normalized: {
      label: "规范化匹配",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      description: "移除追踪参数后匹配",
    },
    semantic: {
      label: "语义相似",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      description: "内容语义相似",
    },
  };
  return configs[strategy];
}

/**
 * 获取操作类型配置
 */
function getActionConfig(action: CleanupAction["action"]) {
  const configs = {
    deleted: {
      label: "已删除",
      icon: Trash2,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    merged: {
      label: "已合并",
      icon: Merge,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    skipped: {
      label: "已跳过",
      icon: SkipForward,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
  };
  return configs[action];
}

/**
 * 格式化日期
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ============================================
// 子组件
// ============================================

/**
 * 清理统计卡片
 */
const CleanupStats = memo(function CleanupStats({
  stats,
  readonly,
}: {
  stats: DuplicateCleanupOutput["stats"];
  readonly?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-100">
      <div className="text-center">
        <div className="text-2xl font-bold text-gray-700">
          {stats.totalScanned}
        </div>
        <div className="text-xs text-gray-500">扫描总数</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-orange-500">
          {stats.duplicateGroupsFound}
        </div>
        <div className="text-xs text-gray-500">重复组</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-red-500">
          {stats.totalDuplicates}
        </div>
        <div className="text-xs text-gray-500">重复书签</div>
      </div>
      {readonly && (
        <div className="text-center">
          <div className="text-2xl font-bold text-green-500">
            {stats.deletedCount}
          </div>
          <div className="text-xs text-gray-500">已清理</div>
        </div>
      )}
    </div>
  );
});

/**
 * 策略分布
 */
const StrategyDistribution = memo(function StrategyDistribution({
  distribution,
}: {
  distribution: { exact: number; normalized: number; semantic: number };
}) {
  const total =
    distribution.exact + distribution.normalized + distribution.semantic;
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="text-gray-500">检测策略:</span>
      {distribution.exact > 0 && (
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-red-400" />
          <span>完全匹配 {distribution.exact}</span>
        </span>
      )}
      {distribution.normalized > 0 && (
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-orange-400" />
          <span>规范化 {distribution.normalized}</span>
        </span>
      )}
      {distribution.semantic > 0 && (
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-blue-400" />
          <span>语义 {distribution.semantic}</span>
        </span>
      )}
    </div>
  );
});

/**
 * 单个书签项
 */
const BookmarkItem = memo(function BookmarkItem({
  bookmark,
  isRecommendedKeep,
  isSelected,
  onToggleSelect,
  onOpenBookmark,
  readonly,
}: {
  bookmark: DuplicateBookmark;
  isRecommendedKeep: boolean;
  isSelected: boolean;
  onToggleSelect: (bookmarkId: number) => void;
  onOpenBookmark?: (bookmarkId: number, url: string) => void;
  readonly?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
        isRecommendedKeep
          ? "bg-green-50 border-green-200"
          : isSelected
            ? "bg-red-50 border-red-200"
            : "bg-white border-gray-200 hover:border-gray-300",
      )}
    >
      {/* 选择框 */}
      {!readonly && !isRecommendedKeep && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(bookmark.id)}
          className="mt-1"
        />
      )}

      {/* 推荐保留标记 */}
      {isRecommendedKeep && (
        <div className="flex-shrink-0 size-6 rounded-full bg-green-500 flex items-center justify-center">
          <CheckCircle2 className="size-4 text-white" />
        </div>
      )}

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h5 className="font-medium text-gray-800 line-clamp-1">
            {bookmark.title}
          </h5>
          {isRecommendedKeep && (
            <Badge className="flex-shrink-0 bg-green-500 text-white text-xs">
              保留
            </Badge>
          )}
        </div>

        {/* URL */}
        <p className="mt-1 text-xs text-gray-400 line-clamp-1 break-all">
          {bookmark.url}
        </p>

        {/* 元信息 */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Link2 className="size-3" />
            {formatDate(bookmark.createdAt)}
          </span>
          {bookmark.folderName && (
            <span className="flex items-center gap-1">
              <Folder className="size-3" />
              {bookmark.folderName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Tag className="size-3" />
            {bookmark.tagCount} 标签
          </span>
          {bookmark.hasSummary && (
            <span className="flex items-center gap-1 text-green-600">
              <FileText className="size-3" />
              有摘要
            </span>
          )}
        </div>

        {/* 完整度进度条 */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-400">完整度:</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                bookmark.completeness >= 70
                  ? "bg-green-400"
                  : bookmark.completeness >= 40
                    ? "bg-yellow-400"
                    : "bg-red-400",
              )}
              style={{ width: `${bookmark.completeness}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-8">
            {bookmark.completeness}%
          </span>
        </div>
      </div>

      {/* 操作按钮 */}
      <Button
        variant="ghost"
        size="sm"
        className="flex-shrink-0 h-7 text-xs"
        onClick={() => onOpenBookmark?.(bookmark.id, bookmark.url)}
      >
        <ExternalLink className="size-3" />
      </Button>
    </div>
  );
});

/**
 * 重复组卡片
 */
const DuplicateGroupCard = memo(function DuplicateGroupCard({
  group,
  selectedToDelete,
  onToggleSelect,
  onOpenBookmark,
  readonly,
}: DuplicateGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const strategyConfig = getStrategyConfig(group.strategy);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* 组头部 */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 cursor-pointer",
          strategyConfig.bgColor,
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <FileWarning className={cn("size-5", strategyConfig.color)} />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-gray-800">
                {group.bookmarks.length} 个重复书签
              </h4>
              <Badge
                variant="outline"
                className={cn("text-xs", strategyConfig.color)}
              >
                {strategyConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {group.normalizedUrl}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {group.similarity !== undefined && (
            <span className="text-xs text-gray-500">
              相似度: {(group.similarity * 100).toFixed(0)}%
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="size-4 text-gray-400" />
          ) : (
            <ChevronDown className="size-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* 组内容 */}
      {isExpanded && (
        <div className="p-4 space-y-3 bg-gray-50">
          {/* 推荐说明 */}
          <div className="text-sm text-gray-600 bg-white px-3 py-2 rounded border border-gray-100">
            💡 {group.reason}
          </div>

          {/* 书签列表 */}
          <div className="space-y-2">
            {group.bookmarks.map((bookmark) => (
              <BookmarkItem
                key={bookmark.id}
                bookmark={bookmark}
                isRecommendedKeep={bookmark.id === group.recommendedKeep}
                isSelected={selectedToDelete.has(bookmark.id)}
                onToggleSelect={onToggleSelect}
                onOpenBookmark={onOpenBookmark}
                readonly={readonly}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * 已执行操作列表
 */
const ExecutedActions = memo(function ExecutedActions({
  actions,
}: {
  actions: CleanupAction[];
}) {
  if (actions.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">执行结果</h4>
      <div className="space-y-1">
        {actions.map((action, index) => {
          const config = getActionConfig(action.action);
          const Icon = config.icon;
          return (
            <div
              key={index}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded text-sm",
                config.bgColor,
              )}
            >
              <Icon className={cn("size-4", config.color)} />
              <span className={config.color}>{config.label}</span>
              <span className="text-gray-500">书签 #{action.bookmarkId}</span>
              {action.mergedInto && (
                <span className="text-gray-400">
                  → 合并到 #{action.mergedInto}
                </span>
              )}
              {action.skipReason && (
                <span className="text-gray-400">({action.skipReason})</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * 重复清理预览组件
 */
export const CleanupPreview = memo(function CleanupPreview({
  data,
  onConfirmCleanup,
  onOpenBookmark,
  className,
  readonly = false,
}: CleanupPreviewProps) {
  // 管理选中要删除的书签
  const [selectedToDelete, setSelectedToDelete] = useState<Set<number>>(() => {
    // 默认选中所有非推荐保留的书签
    const initial = new Set<number>();
    if (!readonly) {
      for (const group of data.duplicateGroups) {
        for (const bookmark of group.bookmarks) {
          if (bookmark.id !== group.recommendedKeep) {
            initial.add(bookmark.id);
          }
        }
      }
    }
    return initial;
  });

  // 计算待删除数量
  const deleteCount = selectedToDelete.size;

  // 切换选中状态
  const handleToggleSelect = (bookmarkId: number) => {
    setSelectedToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(bookmarkId)) {
        next.delete(bookmarkId);
      } else {
        next.add(bookmarkId);
      }
      return next;
    });
  };

  // 全选/取消全选
  const handleSelectAll = (select: boolean) => {
    if (select) {
      const all = new Set<number>();
      for (const group of data.duplicateGroups) {
        for (const bookmark of group.bookmarks) {
          if (bookmark.id !== group.recommendedKeep) {
            all.add(bookmark.id);
          }
        }
      }
      setSelectedToDelete(all);
    } else {
      setSelectedToDelete(new Set());
    }
  };

  // 确认清理
  const handleConfirmCleanup = () => {
    onConfirmCleanup?.(Array.from(selectedToDelete));
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-orange-100 bg-white shadow-sm overflow-hidden",
        className,
      )}
    >
      {/* 头部 */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white">
        <div className="flex items-center gap-2">
          <Trash2 className="size-5" />
          <h2 className="font-semibold">重复书签清理</h2>
        </div>
        <AIMarkdown
          content={data.summary}
          className="mt-1 text-sm text-orange-100"
        />
      </div>

      {/* 统计信息 */}
      <div className="p-4 border-b border-gray-100">
        <CleanupStats stats={data.stats} readonly={readonly} />
      </div>

      {/* 策略分布 */}
      <div className="px-4 py-3 border-b border-gray-100">
        <StrategyDistribution distribution={data.stats.byStrategy} />
      </div>

      {/* 重复组列表 */}
      {data.duplicateGroups.length > 0 && (
        <div className="p-4 space-y-4">
          {/* 操作栏 */}
          {!readonly && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(true)}
                >
                  全选推荐删除
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectAll(false)}
                >
                  取消全选
                </Button>
              </div>
              <span className="text-sm text-gray-500">
                已选择 {deleteCount} 项待删除
              </span>
            </div>
          )}

          {/* 重复组 */}
          {data.duplicateGroups.map((group) => (
            <DuplicateGroupCard
              key={group.id}
              group={group}
              selectedToDelete={selectedToDelete}
              onToggleSelect={handleToggleSelect}
              onOpenBookmark={onOpenBookmark}
              readonly={readonly}
            />
          ))}
        </div>
      )}

      {/* 已执行操作 */}
      {readonly && data.actionsExecuted.length > 0 && (
        <div className="p-4 border-t border-gray-100">
          <ExecutedActions actions={data.actionsExecuted} />
        </div>
      )}

      {/* 确认操作 */}
      {!readonly && deleteCount > 0 && (
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-orange-600">
              <AlertTriangle className="size-4" />
              <span>将永久删除 {deleteCount} 个重复书签</span>
            </div>
            <Button
              variant="destructive"
              onClick={handleConfirmCleanup}
              className="bg-red-500 hover:bg-red-600"
            >
              <Trash2 className="size-4 mr-2" />
              确认清理
            </Button>
          </div>
        </div>
      )}

      {/* 建议 */}
      {data.suggestions.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-2">💡 建议</h4>
          <ul className="space-y-1">
            {data.suggestions.map((suggestion, index) => (
              <li key={index} className="text-sm text-gray-600">
                • {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

export default CleanupPreview;
