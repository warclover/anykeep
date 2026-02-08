/**
 * 待办项组件
 * @description V4.3 待办项卡片 - 内联操作
 * @version 1.0.0
 * @since 2025-12-12
 */

"use client";

import { useState } from "react";
import {
  FolderOpen,
  FolderPlus,
  GitMerge,
  Scissors,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { getFaviconInfo } from "@/lib/utils/favicon";
import { differenceInHours, differenceInDays } from "date-fns";
import type {
  ConfirmationMessageDisplay,
  ConfirmationType,
  ClassificationSuggestion,
} from "@/types/confirmation";

// ============================================================================
// 类型定义
// ============================================================================

export interface InboxItemProps {
  confirmation: ConfirmationMessageDisplay;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onConfirm?: (id: number, selectedFolderId?: number | null) => void;
  onReject?: (id: number) => void;
  isLoading?: boolean;
}

// ============================================================================
// 图标映射
// ============================================================================

const TYPE_ICONS: Record<
  ConfirmationType,
  React.ComponentType<{ className?: string }>
> = {
  classification: FolderOpen,
  folder_create: FolderPlus,
  folder_merge: GitMerge,
  folder_split: Scissors,
  folder_rename: Pencil,
};

const TYPE_LABELS: Record<ConfirmationType, string> = {
  classification: "AI 分类建议",
  folder_create: "文件夹建议",
  folder_merge: "合并建议",
  folder_split: "拆分建议",
  folder_rename: "重命名建议",
};

// ============================================================================
// 辅助组件
// ============================================================================

/**
 * 置信度指示器
 */
function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const getColor = () => {
    if (confidence >= 80) return "text-green-600 dark:text-green-400";
    if (confidence >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-orange-600 dark:text-orange-400";
  };

  return (
    <div className="flex items-center gap-1.5">
      <Progress value={confidence} className="h-1 w-12" />
      <span className={cn("text-xs font-medium", getColor())}>
        {confidence}%
      </span>
    </div>
  );
}

/**
 * 剩余时间
 */
function TimeRemaining({ expiresAt }: { expiresAt: string }) {
  const expireDate = new Date(expiresAt);
  const now = new Date();
  const hoursLeft = differenceInHours(expireDate, now);
  const daysLeft = differenceInDays(expireDate, now);

  const isUrgent = hoursLeft < 24;

  let text: string;
  if (daysLeft > 1) {
    text = `还剩 ${daysLeft} 天`;
  } else if (hoursLeft > 0) {
    text = `还剩 ${hoursLeft} 小时`;
  } else {
    text = "即将过期";
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-normal",
        isUrgent
          ? "border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400"
          : "border-muted-foreground/30",
      )}
    >
      <Clock className="size-3 mr-1" />
      {text}
    </Badge>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function InboxItem({
  confirmation,
  isSelected = false,
  onToggleSelect,
  onConfirm,
  onReject,
  isLoading = false,
}: InboxItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(
    confirmation.type === "classification"
      ? (confirmation.suggestion as ClassificationSuggestion).folderId
      : null,
  );

  const IconComponent = TYPE_ICONS[confirmation.type] || FolderOpen;
  const typeLabel = TYPE_LABELS[confirmation.type] || "待确认";
  const isClassification = confirmation.type === "classification";
  const suggestion = confirmation.suggestion as ClassificationSuggestion;

  const bookmarkFavicon = confirmation.bookmark
    ? getFaviconInfo(confirmation.bookmark.url)
    : null;

  const handleConfirm = () => {
    onConfirm?.(confirmation.id, selectedFolderId);
  };

  const handleReject = () => {
    onReject?.(confirmation.id);
  };

  return (
    <div
      className={cn(
        "border rounded-lg transition-colors",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/30",
      )}
    >
      {/* 主体内容 */}
      <div className="p-4">
        {/* 头部 */}
        <div className="flex items-start gap-3">
          {/* 选择框 */}
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="mt-1"
            aria-label="选择此项"
          />

          {/* 图标 */}
          <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
            <Bot className="size-4 text-primary" />
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                <IconComponent className="size-3 mr-1" />
                {typeLabel}
              </Badge>
              <TimeRemaining expiresAt={confirmation.expiresIn} />
            </div>

            <h4 className="text-sm font-medium mb-1">{confirmation.title}</h4>
            <p className="text-sm text-muted-foreground">
              {confirmation.description}
            </p>

            {/* 分类建议详情 */}
            {isClassification && (
              <div className="mt-3 space-y-2">
                {/* 书签信息 */}
                {confirmation.bookmark && bookmarkFavicon && (
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <div
                      className={cn(
                        "size-4 rounded text-[8px] font-medium flex items-center justify-center flex-shrink-0",
                        bookmarkFavicon.bgClass,
                        bookmarkFavicon.textClass,
                      )}
                    >
                      {bookmarkFavicon.letter}
                    </div>
                    <span className="text-sm truncate flex-1">
                      {confirmation.bookmark.title}
                    </span>
                    <a
                      href={confirmation.bookmark.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                )}

                {/* 建议文件夹 */}
                <div className="flex items-center justify-between p-2 bg-primary/5 rounded-md border border-primary/20">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="size-4 text-primary" />
                    <span className="text-sm font-medium">
                      {suggestion.folderName || "待整理"}
                    </span>
                  </div>
                  <ConfidenceIndicator confidence={suggestion.confidence} />
                </div>

                {/* 理由 */}
                {suggestion.reason && (
                  <p className="text-xs text-muted-foreground pl-1">
                    💡 {suggestion.reason}
                  </p>
                )}

                {/* 备选项 */}
                {suggestion.alternatives &&
                  suggestion.alternatives.length > 0 && (
                    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-between h-8 text-xs"
                        >
                          <span>
                            其他选项 ({suggestion.alternatives.length})
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="size-3" />
                          ) : (
                            <ChevronDown className="size-3" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-1 mt-1">
                        {suggestion.alternatives.map((alt) => (
                          <button
                            key={alt.folderId}
                            onClick={() => setSelectedFolderId(alt.folderId)}
                            className={cn(
                              "w-full flex items-center justify-between p-2 rounded-md text-left transition-colors",
                              selectedFolderId === alt.folderId
                                ? "bg-primary/10 border border-primary/30"
                                : "bg-muted/30 hover:bg-muted/50",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <FolderOpen className="size-3.5 text-muted-foreground" />
                              <span className="text-sm">{alt.folderName}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {alt.confidence}%
                            </span>
                          </button>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* 内联操作按钮 */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReject}
            disabled={isLoading}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="size-4 mr-1" />
            拒绝
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={isLoading}>
            <Check className="size-4 mr-1" />
            确认
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InboxItem;
