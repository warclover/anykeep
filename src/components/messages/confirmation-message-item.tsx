/**
 * Confirmation Message Item Component
 * V4.2 待确认消息组件
 *
 * @description 展示半托管模式下需要用户确认的 AI 建议
 * - 分类确认：显示书签信息、建议文件夹、备选项
 * - 文件夹操作确认：显示操作详情、影响范围
 * - 支持确认/拒绝/选择其他
 * - 显示过期倒计时
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

"use client";

import { useState, useMemo } from "react";
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
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { zhCN } from "date-fns/locale";
import type {
  ConfirmationMessageDisplay,
  ConfirmationType,
  ClassificationSuggestion,
  FolderMergeSuggestion,
  FolderSplitSuggestion,
  FolderRenameSuggestion,
  FolderCreateSuggestion,
} from "@/types/confirmation";

// ============================================================================
// 类型定义
// ============================================================================

export interface ConfirmationMessageItemProps {
  confirmation: ConfirmationMessageDisplay;
  onConfirm?: (id: number, selectedFolderId?: number | null) => void;
  onReject?: (id: number) => void;
  onSelectOther?: (id: number) => void;
  onToInbox?: (id: number) => void;
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

// ============================================================================
// 辅助组件
// ============================================================================

/**
 * 置信度指示器
 */
function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const getColor = () => {
    if (confidence >= 80) return "bg-green-500";
    if (confidence >= 60) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const getLabel = () => {
    if (confidence >= 80) return "高";
    if (confidence >= 60) return "中";
    return "低";
  };

  return (
    <div className="flex items-center gap-2">
      <Progress value={confidence} className="h-1.5 w-16" />
      <span className="text-xs text-muted-foreground">
        {confidence}% ({getLabel()})
      </span>
      <div className={cn("size-2 rounded-full", getColor())} />
    </div>
  );
}

/**
 * 过期倒计时
 */
function ExpirationCountdown({ expiresIn }: { expiresIn: string }) {
  const expiresAt = new Date(expiresIn);
  const hoursLeft = differenceInHours(expiresAt, new Date());
  const daysLeft = Math.floor(hoursLeft / 24);

  const isUrgent = hoursLeft < 24;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs",
        isUrgent ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
      )}
    >
      <Clock className="size-3" />
      <span>
        {daysLeft > 0 ? `${daysLeft}天后` : `${hoursLeft}小时后`}自动处理
      </span>
    </div>
  );
}

/**
 * 书签预览卡片
 */
function BookmarkPreview({
  bookmark,
}: {
  bookmark: { id: number; title: string; url: string };
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-1">
      <h5 className="text-sm font-medium line-clamp-2">{bookmark.title}</h5>
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
      >
        <ExternalLink className="size-3 flex-shrink-0" />
        <span className="truncate">{new URL(bookmark.url).hostname}</span>
      </a>
    </div>
  );
}

/**
 * 文件夹选项卡片
 */
function FolderOption({
  folderId,
  folderName,
  confidence,
  isRecommended,
  isSelected,
  onSelect,
}: {
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  isRecommended?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-accent/50"
      )}
    >
      <div className="flex items-center gap-2">
        <FolderOpen className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{folderName || "待整理"}</span>
        {isRecommended && (
          <Badge variant="secondary" className="text-xs">
            推荐
          </Badge>
        )}
      </div>
      <ConfidenceIndicator confidence={confidence} />
    </button>
  );
}

// ============================================================================
// 分类确认内容
// ============================================================================

function ClassificationContent({
  confirmation,
  onConfirm,
  onReject,
  onSelectOther,
  onToInbox,
  isLoading,
}: ConfirmationMessageItemProps & {
  confirmation: ConfirmationMessageDisplay & {
    suggestion: ClassificationSuggestion;
  };
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(
    confirmation.suggestion.folderId
  );

  const suggestion = confirmation.suggestion;
  const hasAlternatives = suggestion.alternatives && suggestion.alternatives.length > 0;

  const handleConfirm = () => {
    onConfirm?.(confirmation.id, selectedFolderId);
  };

  return (
    <div className="space-y-4">
      {/* 书签预览 */}
      {confirmation.bookmark && (
        <BookmarkPreview bookmark={confirmation.bookmark} />
      )}

      {/* AI 建议 */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">AI 建议分类到：</p>
        <FolderOption
          folderId={suggestion.folderId}
          folderName={suggestion.folderName}
          confidence={suggestion.confidence}
          isRecommended
          isSelected={selectedFolderId === suggestion.folderId}
          onSelect={() => setSelectedFolderId(suggestion.folderId)}
        />
        {suggestion.reason && (
          <p className="text-xs text-muted-foreground pl-1">
            理由：{suggestion.reason}
          </p>
        )}
      </div>

      {/* 备选项 */}
      {hasAlternatives && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span>其他选项 ({suggestion.alternatives.length})</span>
              {isExpanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 mt-2">
            {suggestion.alternatives.map((alt) => (
              <FolderOption
                key={alt.folderId}
                folderId={alt.folderId}
                folderName={alt.folderName}
                confidence={alt.confidence}
                isSelected={selectedFolderId === alt.folderId}
                onSelect={() => setSelectedFolderId(alt.folderId)}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={isLoading}
          className="flex-1 sm:flex-none"
        >
          <Check className="size-4 mr-1" />
          确认
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToInbox?.(confirmation.id)}
          disabled={isLoading}
          className="flex-1 sm:flex-none"
        >
          <Inbox className="size-4 mr-1" />
          待整理
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelectOther?.(confirmation.id)}
          disabled={isLoading}
          className="flex-1 sm:flex-none"
        >
          选择其他
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 文件夹操作确认内容
// ============================================================================

function FolderOperationContent({
  confirmation,
  onConfirm,
  onReject,
  isLoading,
}: ConfirmationMessageItemProps) {
  const suggestion = confirmation.suggestion;
  const type = confirmation.type;

  // 根据类型显示不同内容
  const renderDetails = () => {
    switch (type) {
      case "folder_create": {
        const createSuggestion = suggestion as FolderCreateSuggestion;
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FolderPlus className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                新建文件夹：{createSuggestion.suggestedName}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              预计包含 {createSuggestion.estimatedCount} 个书签
            </p>
            <p className="text-xs text-muted-foreground">
              原因：{createSuggestion.reason}
            </p>
          </div>
        );
      }
      case "folder_merge": {
        const mergeSuggestion = suggestion as FolderMergeSuggestion;
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <GitMerge className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                合并到：{mergeSuggestion.targetFolderName}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              合并来源：{mergeSuggestion.sourceFolderNames.join("、")}
            </p>
            <p className="text-xs text-muted-foreground">
              影响 {mergeSuggestion.affectedBookmarks} 个书签
            </p>
            <p className="text-xs text-muted-foreground">
              原因：{mergeSuggestion.reason}
            </p>
          </div>
        );
      }
      case "folder_split": {
        const splitSuggestion = suggestion as FolderSplitSuggestion;
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Scissors className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                拆分：{splitSuggestion.sourceFolderName}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              拆分为：{splitSuggestion.suggestedSubFolders.map((f) => f.name).join("、")}
            </p>
            <p className="text-xs text-muted-foreground">
              影响 {splitSuggestion.affectedBookmarks} 个书签
            </p>
            <p className="text-xs text-muted-foreground">
              原因：{splitSuggestion.reason}
            </p>
          </div>
        );
      }
      case "folder_rename": {
        const renameSuggestion = suggestion as FolderRenameSuggestion;
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Pencil className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                重命名：{renameSuggestion.currentName} → {renameSuggestion.suggestedName}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              原因：{renameSuggestion.reason}
            </p>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {renderDetails()}

      {/* 操作按钮 */}
      <div className="flex gap-2 pt-2">
        <Button
          size="sm"
          onClick={() => onConfirm?.(confirmation.id)}
          disabled={isLoading}
        >
          <Check className="size-4 mr-1" />
          同意
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReject?.(confirmation.id)}
          disabled={isLoading}
        >
          <X className="size-4 mr-1" />
          拒绝
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export function ConfirmationMessageItem({
  confirmation,
  onConfirm,
  onReject,
  onSelectOther,
  onToInbox,
  isLoading = false,
}: ConfirmationMessageItemProps) {
  const IconComponent = TYPE_ICONS[confirmation.type] || FolderOpen;

  // 格式化创建时间
  const timeAgo = formatDistanceToNow(new Date(confirmation.createdAt), {
    addSuffix: true,
    locale: zhCN,
  });

  // 判断是否为分类确认
  const isClassification = confirmation.type === "classification";

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      {/* 头部 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <IconComponent className="size-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-medium">{confirmation.title}</h4>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>
        </div>
        <ExpirationCountdown expiresIn={confirmation.expiresIn} />
      </div>

      {/* 描述 */}
      {confirmation.description && (
        <p className="text-sm text-muted-foreground">{confirmation.description}</p>
      )}

      {/* 内容区 */}
      {isClassification ? (
        <ClassificationContent
          confirmation={
            confirmation as ConfirmationMessageDisplay & {
              suggestion: ClassificationSuggestion;
            }
          }
          onConfirm={onConfirm}
          onReject={onReject}
          onSelectOther={onSelectOther}
          onToInbox={onToInbox}
          isLoading={isLoading}
        />
      ) : (
        <FolderOperationContent
          confirmation={confirmation}
          onConfirm={onConfirm}
          onReject={onReject}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

export default ConfirmationMessageItem;
