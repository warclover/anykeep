/**
 * 影子书签卡片组件
 * 用于 Shadow Sorting (Inbox Zero) 功能
 * 显示待处理的分类建议
 */

"use client";

import { useCallback, memo, useMemo } from "react";
import { Check, X, Folder, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getFaviconInfo } from "@/lib/utils/favicon";

interface ShadowBookmark {
  id: number;
  title: string;
  url: string;
  shadowFolderId: number;
  shadowFolderName: string;
  shadowConfidence: number;
  shadowSuggestedAt: string;
}

interface ShadowBookmarkCardProps {
  bookmark: ShadowBookmark;
  onConfirm?: (id: number) => void;
  onReject?: (id: number) => void;
  // 批量选择模式
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
}

/**
 * 置信度颜色映射
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "text-green-600 dark:text-green-400";
  if (confidence >= 0.6) return "text-yellow-600 dark:text-yellow-400";
  return "text-orange-600 dark:text-orange-400";
}

/**
 * 影子书签卡片组件
 */
export const ShadowBookmarkCard = memo(function ShadowBookmarkCard({
  bookmark,
  onConfirm,
  onReject,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: ShadowBookmarkCardProps) {
  const favicon = useMemo(() => getFaviconInfo(bookmark.url), [bookmark.url]);

  const handleConfirm = useCallback(() => {
    onConfirm?.(bookmark.id);
  }, [onConfirm, bookmark.id]);

  const handleReject = useCallback(() => {
    onReject?.(bookmark.id);
  }, [onReject, bookmark.id]);

  const handleToggleSelect = useCallback(() => {
    onToggleSelect?.(bookmark.id);
  }, [onToggleSelect, bookmark.id]);

  const confidencePercent = Math.round(bookmark.shadowConfidence * 100);
  const confidenceColor = getConfidenceColor(bookmark.shadowConfidence);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50",
        isSelected && "bg-accent border-primary",
      )}
    >
      {/* 批量选择复选框 */}
      {isSelectionMode && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleToggleSelect}
          className="shrink-0"
        />
      )}

      {/* Favicon */}
      <div
        className={cn(
          "shrink-0 h-5 w-5 rounded text-xs font-medium flex items-center justify-center",
          favicon.bgClass,
          favicon.textClass,
        )}
      >
        {favicon.letter}
      </div>

      {/* 书签信息 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium">{bookmark.title}</h3>
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="truncate text-xs text-muted-foreground">{bookmark.url}</p>
      </div>

      {/* 建议的文件夹 */}
      <div className="flex items-center gap-2 shrink-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">
                  {bookmark.shadowFolderName}
                </span>
                <Badge
                  variant="outline"
                  className={cn("text-xs font-semibold", confidenceColor)}
                >
                  {confidencePercent}%
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>建议移动到此文件夹</p>
              <p className="text-xs text-muted-foreground">
                置信度: {confidencePercent}%
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 操作按钮 */}
      {!isSelectionMode && (
        <div className="flex items-center gap-1 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950"
                  onClick={handleConfirm}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>确认建议</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                  onClick={handleReject}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>拒绝建议</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
});
