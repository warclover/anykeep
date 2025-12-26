/**
 * 整理方案预览组件
 *
 * 显示 AI 整理分析结果，包括：
 * - 分类建议
 * - 标签建议
 * - 重复检测
 * - 归档候选
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

"use client";

import { memo, useState, useMemo } from "react";
import {
  FolderOpen,
  Tags,
  Copy,
  Archive,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  CategorizeSuggestion,
  TagSuggestion,
  DuplicateGroup,
  ArchiveCandidate,
  OrganizeStats,
} from "@/lib/ai-skills/skills/batch-organize/types";

// ============================================
// UI 文本常量
// ============================================

const UI_TEXT = {
  title: "整理方案预览",
  subtitle: "AI 为您分析了书签并生成了以下整理建议",
  stats: {
    processed: "已分析",
    categorize: "分类建议",
    tag: "标签建议",
    duplicates: "重复检测",
    archive: "归档候选",
  },
  sections: {
    categorize: "分类建议",
    tag: "标签建议",
    duplicates: "重复书签",
    archive: "归档候选",
  },
  actions: {
    confirm: "确认执行",
    cancel: "取消",
    confirmAll: "全部确认",
    skipAll: "全部跳过",
  },
  empty: {
    categorize: "没有分类建议",
    tag: "没有标签建议",
    duplicates: "没有发现重复",
    archive: "没有归档候选",
  },
  labels: {
    currentFolder: "当前",
    suggestedFolder: "建议",
    noFolder: "未分类",
    confidence: "置信度",
    keepThis: "保留此项",
    deleteOthers: "删除其他",
    daysSinceCreated: "天前创建",
    neverAccessed: "从未访问",
  },
} as const;

// ============================================
// 类型定义
// ============================================

export interface OrganizePlanPreviewProps {
  /** 统计信息 */
  stats: OrganizeStats;
  /** 分类建议列表 */
  categorizeSuggestions: CategorizeSuggestion[];
  /** 标签建议列表 */
  tagSuggestions: TagSuggestion[];
  /** 重复书签组 */
  duplicateGroups: DuplicateGroup[];
  /** 归档候选列表 */
  archiveCandidates: ArchiveCandidate[];
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 辅助组件
// ============================================

/**
 * 统计卡片
 */
const StatCard = memo(function StatCard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg bg-white/60 border",
        colorClass,
      )}
    >
      <Icon className="size-4" />
      <div className="flex flex-col">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
    </div>
  );
});

/**
 * 可折叠区块
 */
const CollapsibleSection = memo(function CollapsibleSection({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = true,
  colorClass,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  colorClass: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (count === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex items-center justify-between w-full px-4 py-3 rounded-lg",
            "bg-gradient-to-r hover:opacity-90 transition-opacity",
            colorClass,
          )}
        >
          <div className="flex items-center gap-2">
            <Icon className="size-5 text-white" />
            <span className="font-medium text-white">{title}</span>
            <Badge variant="secondary" className="bg-white/20 text-white">
              {count}
            </Badge>
          </div>
          {isOpen ? (
            <ChevronUp className="size-5 text-white" />
          ) : (
            <ChevronDown className="size-5 text-white" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
});

/**
 * 置信度指示器
 */
const ConfidenceBadge = memo(function ConfidenceBadge({
  confidence,
}: {
  confidence: number;
}) {
  const percent = Math.round(confidence * 100);
  const colorClass =
    confidence >= 0.8
      ? "bg-green-100 text-green-700"
      : confidence >= 0.5
        ? "bg-yellow-100 text-yellow-700"
        : "bg-gray-100 text-gray-600";

  return (
    <span
      className={cn("px-2 py-0.5 rounded-full text-xs font-medium", colorClass)}
    >
      {percent}%
    </span>
  );
});

// ============================================
// 建议列表组件
// ============================================

/**
 * 分类建议列表
 */
const CategorizeSuggestionList = memo(function CategorizeSuggestionList({
  suggestions,
}: {
  suggestions: CategorizeSuggestion[];
}) {
  return (
    <div className="space-y-2">
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.bookmarkId}
          className="flex items-center justify-between p-3 rounded-lg bg-white border border-blue-100 hover:border-blue-200 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-800 truncate">
              {suggestion.bookmarkTitle}
            </p>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <span className="text-gray-500">
                {suggestion.currentFolder || UI_TEXT.labels.noFolder}
              </span>
              <ArrowRight className="size-4 text-blue-500" />
              <span className="text-blue-600 font-medium">
                {suggestion.suggestedFolder}
              </span>
            </div>
            {suggestion.reason && (
              <p className="mt-1 text-xs text-gray-400">{suggestion.reason}</p>
            )}
          </div>
          <ConfidenceBadge confidence={suggestion.confidence} />
        </div>
      ))}
    </div>
  );
});

/**
 * 标签建议列表
 */
const TagSuggestionList = memo(function TagSuggestionList({
  suggestions,
}: {
  suggestions: TagSuggestion[];
}) {
  return (
    <div className="space-y-2">
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.bookmarkId}
          className="p-3 rounded-lg bg-white border border-purple-100 hover:border-purple-200 transition-colors"
        >
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-800 truncate flex-1">
              {suggestion.bookmarkTitle}
            </p>
            <ConfidenceBadge confidence={suggestion.confidence} />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {suggestion.currentTags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {suggestion.suggestedTags.map((tag) => (
              <Badge
                key={tag}
                className="bg-purple-100 text-purple-700 border-purple-200 text-xs"
              >
                <Sparkles className="size-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

/**
 * 重复书签列表
 */
const DuplicateGroupList = memo(function DuplicateGroupList({
  groups,
}: {
  groups: DuplicateGroup[];
}) {
  return (
    <div className="space-y-3">
      {groups.map((group, index) => (
        <div
          key={index}
          className="p-3 rounded-lg bg-white border border-amber-100"
        >
          <p className="text-xs text-gray-500 mb-2 truncate">
            {group.normalizedUrl}
          </p>
          <div className="space-y-1.5">
            {group.bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded-md",
                  bookmark.id === group.keepBookmarkId
                    ? "bg-green-50 border border-green-200"
                    : "bg-gray-50 border border-gray-200",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {bookmark.id === group.keepBookmarkId ? (
                    <CheckCircle2 className="size-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="size-4 text-gray-400 flex-shrink-0" />
                  )}
                  <span className="text-sm truncate">{bookmark.title}</span>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {new Date(bookmark.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

/**
 * 归档候选列表
 */
const ArchiveCandidateList = memo(function ArchiveCandidateList({
  candidates,
}: {
  candidates: ArchiveCandidate[];
}) {
  return (
    <div className="space-y-2">
      {candidates.map((candidate) => (
        <div
          key={candidate.bookmarkId}
          className="flex items-center justify-between p-3 rounded-lg bg-white border border-orange-100 hover:border-orange-200 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-800 truncate">
              {candidate.bookmarkTitle}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">
                {candidate.daysSinceCreated} {UI_TEXT.labels.daysSinceCreated}
              </span>
              {candidate.neverAccessed && (
                <Badge
                  variant="outline"
                  className="text-xs text-orange-600 border-orange-200"
                >
                  {UI_TEXT.labels.neverAccessed}
                </Badge>
              )}
            </div>
            {candidate.reason && (
              <p className="mt-1 text-xs text-gray-400">{candidate.reason}</p>
            )}
          </div>
          <Archive className="size-4 text-orange-500" />
        </div>
      ))}
    </div>
  );
});

// ============================================
// 主组件
// ============================================

/**
 * 整理方案预览组件
 */
export const OrganizePlanPreview = memo(function OrganizePlanPreview({
  stats,
  categorizeSuggestions,
  tagSuggestions,
  duplicateGroups,
  archiveCandidates,
  onConfirm,
  onCancel,
  isLoading = false,
  className,
}: OrganizePlanPreviewProps) {
  const hasAnySuggestion = useMemo(() => {
    return (
      categorizeSuggestions.length > 0 ||
      tagSuggestions.length > 0 ||
      duplicateGroups.length > 0 ||
      archiveCandidates.length > 0
    );
  }, [
    categorizeSuggestions,
    tagSuggestions,
    duplicateGroups,
    archiveCandidates,
  ]);

  return (
    <div
      className={cn(
        "rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 overflow-hidden",
        className,
      )}
    >
      {/* 头部 */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500">
        <h3 className="text-lg font-semibold text-white">{UI_TEXT.title}</h3>
        <p className="text-sm text-white/80">{UI_TEXT.subtitle}</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 border-b border-indigo-100">
        <StatCard
          icon={FolderOpen}
          label={UI_TEXT.stats.categorize}
          value={stats.categorizeSuggestions}
          colorClass="border-blue-200 text-blue-600"
        />
        <StatCard
          icon={Tags}
          label={UI_TEXT.stats.tag}
          value={stats.tagSuggestions}
          colorClass="border-purple-200 text-purple-600"
        />
        <StatCard
          icon={Copy}
          label={UI_TEXT.stats.duplicates}
          value={stats.duplicatesFound}
          colorClass="border-amber-200 text-amber-600"
        />
        <StatCard
          icon={Archive}
          label={UI_TEXT.stats.archive}
          value={stats.archiveCandidates}
          colorClass="border-orange-200 text-orange-600"
        />
      </div>

      {/* 建议内容 */}
      <div className="p-4 space-y-4">
        {!hasAnySuggestion ? (
          <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
            <AlertCircle className="size-5" />
            <span>暂无整理建议</span>
          </div>
        ) : (
          <>
            {/* 分类建议 */}
            <CollapsibleSection
              title={UI_TEXT.sections.categorize}
              icon={FolderOpen}
              count={categorizeSuggestions.length}
              colorClass="from-blue-500 to-blue-600"
            >
              <CategorizeSuggestionList suggestions={categorizeSuggestions} />
            </CollapsibleSection>

            {/* 标签建议 */}
            <CollapsibleSection
              title={UI_TEXT.sections.tag}
              icon={Tags}
              count={tagSuggestions.length}
              colorClass="from-purple-500 to-purple-600"
            >
              <TagSuggestionList suggestions={tagSuggestions} />
            </CollapsibleSection>

            {/* 重复书签 */}
            <CollapsibleSection
              title={UI_TEXT.sections.duplicates}
              icon={Copy}
              count={duplicateGroups.length}
              colorClass="from-amber-500 to-amber-600"
            >
              <DuplicateGroupList groups={duplicateGroups} />
            </CollapsibleSection>

            {/* 归档候选 */}
            <CollapsibleSection
              title={UI_TEXT.sections.archive}
              icon={Archive}
              count={archiveCandidates.length}
              colorClass="from-orange-500 to-orange-600"
            >
              <ArchiveCandidateList candidates={archiveCandidates} />
            </CollapsibleSection>
          </>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-indigo-100 bg-white/50">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          {UI_TEXT.actions.cancel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isLoading || !hasAnySuggestion}
          className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
        >
          {isLoading ? "执行中..." : UI_TEXT.actions.confirm}
        </Button>
      </div>
    </div>
  );
});

export default OrganizePlanPreview;
