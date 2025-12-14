"use client";

/**
 * InlineListItem
 * 内联列表单条项组件
 *
 * @description
 * - 紧凑的单行显示
 * - 标题 + URL + 文件夹建议 + 置信度 + 操作按钮
 * - 支持编辑模式切换文件夹
 *
 * @version 2.0.0
 * @since 2025-12-14
 */

import { useState } from "react";
import {
  Check,
  X,
  Edit2,
  FolderOpen,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ConfidenceBadge } from "../shared/ConfidenceBadge";
import type { InlineListItemProps } from "../types";

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 格式化 URL 显示
 */
function formatUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

// ============================================================================
// 组件
// ============================================================================

export function InlineListItem({
  message,
  folders,
  onConfirm,
  onReject,
  onModify,
}: InlineListItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    String(message.suggestedFolderId),
  );
  const [isLoading, setIsLoading] = useState(false);

  // 处理确认
  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  // 处理拒绝
  const handleReject = async () => {
    setIsLoading(true);
    try {
      await onReject();
    } finally {
      setIsLoading(false);
    }
  };

  // 处理保存修改
  const handleSaveModify = async () => {
    const newFolderId = parseInt(selectedFolderId, 10);
    if (newFolderId === message.suggestedFolderId) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onModify(newFolderId);
    } finally {
      setIsLoading(false);
      setIsEditing(false);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setSelectedFolderId(String(message.suggestedFolderId));
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5",
        "border-b border-violet-100 dark:border-violet-900/50",
        "last:border-b-0",
        "hover:bg-violet-50/50 dark:hover:bg-violet-950/30",
        "transition-colors duration-150",
      )}
    >
      {/* 左侧：标题和 URL */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        {/* 文档图标 + 标题 */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-base flex-shrink-0">📄</span>
          <span className="font-medium text-sm truncate text-gray-900 dark:text-gray-100">
            {message.bookmarkTitle || "无标题"}
          </span>
        </div>

        {/* URL */}
        <a
          href={message.bookmarkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          {formatUrl(message.bookmarkUrl)}
        </a>
      </div>

      {/* 中间：文件夹建议 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <ArrowRight className="w-4 h-4 text-violet-400" />

        {isEditing ? (
          <Select
            value={selectedFolderId}
            onValueChange={setSelectedFolderId}
            disabled={isLoading}
          >
            <SelectTrigger className="h-7 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={String(folder.id)}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
            <FolderOpen className="w-4 h-4 text-violet-500" />
            <span className="max-w-[140px] truncate">
              {message.suggestedFolderName}
            </span>
          </div>
        )}
      </div>

      {/* 置信度 */}
      <div className="flex-shrink-0">
        <ConfidenceBadge confidence={message.confidence} size="sm" />
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isEditing ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
              onClick={handleSaveModify}
              disabled={isLoading}
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              onClick={handleCancelEdit}
              disabled={isLoading}
            >
              <X className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <>
            {/* 确认 */}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
              onClick={handleConfirm}
              disabled={isLoading}
              title="确认此分类"
            >
              <Check className="w-4 h-4" />
            </Button>

            {/* 编辑 */}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-violet-600 hover:text-violet-700 hover:bg-violet-100 dark:text-violet-400 dark:hover:bg-violet-900/30"
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
              title="修改文件夹"
            >
              <Edit2 className="w-4 h-4" />
            </Button>

            {/* 拒绝 */}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-100 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/30"
              onClick={handleReject}
              disabled={isLoading}
              title="忽略此建议"
            >
              <X className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
