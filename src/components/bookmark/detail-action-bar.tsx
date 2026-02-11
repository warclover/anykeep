/**
 * Detail Action Bar Component
 *
 * 书签详情页的操作按钮栏，包含返回、分享、AI助手、监控、编辑、移动、删除等操作。
 * 「打开原文」「朗读」「快照」已下沉至 AISmartSummary 工具栏。
 *
 * @version 1.3.0
 * @since 2025-12-24 (Phase 2.3.7)
 * @updated 2025-12-28 - 添加页面监控按钮
 * @updated 2026-02-11 - 打开原文/朗读/快照下沉至 AI 摘要工具栏
 */

"use client";

import {
  ArrowLeft,
  Edit,
  Trash2,
  FolderInput,
  Share2,
  Bot,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================
// 类型定义
// ============================================

export interface DetailActionBarProps {
  /** 书签标题 */
  title: string;
  /** 书签 URL */
  url: string;
  /** AI 摘要 */
  aiSummary?: string | null;
  /** 是否已锁定 */
  isLocked: boolean;
  /** 是否正在删除 */
  isDeleting: boolean;
  /** 用户 ID（用于判断是否显示 AI 助手按钮） */
  userId?: string;
  /** 是否已设置监控 */
  hasMonitor?: boolean;
  /** 返回回调 */
  onBack: () => void;
  /** 编辑回调 */
  onEdit: () => void;
  /** 移动到文件夹回调 */
  onMoveToFolder: () => void;
  /** 删除回调 */
  onDelete: () => void;
  /** 打开 AI 助手面板回调 */
  onOpenAIPanel?: () => void;
  /** 添加监控回调 */
  onAddMonitor?: () => void;
}

// ============================================
// 组件实现
// ============================================

export function DetailActionBar({
  title,
  url,
  aiSummary,
  isLocked,
  isDeleting,
  userId,
  hasMonitor,
  onBack,
  onEdit,
  onMoveToFolder,
  onDelete,
  onOpenAIPanel,
  onAddMonitor,
}: DetailActionBarProps) {
  // 分享
  const handleShare = async () => {
    const shareData = {
      title: title,
      text: `${title}${aiSummary ? "\n\n" + aiSummary : ""}`,
      url: url,
    };

    // 优先使用 Web Share API（移动端原生分享）
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success("分享成功");
      } catch (error) {
        // 用户取消分享
        if (error instanceof Error && error.name !== "AbortError") {
          toast.error("分享失败");
        }
      }
    } else {
      // 降级到复制链接
      try {
        await navigator.clipboard.writeText(url);
        toast.success("链接已复制到剪贴板");
      } catch {
        toast.error("复制失败，请手动复制");
      }
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      {/* 左侧：返回 + 主要操作 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 px-2">
          <ArrowLeft className="size-4" />
          <span className="ml-1">返回</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          className="h-8 px-2"
        >
          <Share2 className="size-3.5" />
          <span className="ml-1 hidden sm:inline">分享</span>
        </Button>

        {/* AI 助手按钮 */}
        {userId && onOpenAIPanel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenAIPanel}
            className="h-8 px-2 text-primary hover:text-primary"
          >
            <Bot className="size-3.5" />
            <span className="ml-1 hidden sm:inline">AI 助手</span>
          </Button>
        )}

        {/* 页面监控按钮 */}
        {userId && onAddMonitor && !hasMonitor && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddMonitor}
            className="h-8 px-2"
          >
            <Eye className="size-3.5" />
            <span className="ml-1 hidden sm:inline">监控</span>
          </Button>
        )}
        {hasMonitor && (
          <Button
            variant="ghost"
            size="sm"
            disabled
            className="h-8 px-2 text-green-600"
          >
            <Eye className="size-3.5" />
            <span className="ml-1 hidden sm:inline">已监控</span>
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 px-2">
          <Edit className="size-3.5" />
          <span className="ml-1 hidden sm:inline">编辑</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onMoveToFolder}
          className="h-8 px-2"
        >
          <FolderInput className="size-3.5" />
          <span className="ml-1 hidden sm:inline">移动到</span>
        </Button>
      </div>

      {/* 右侧：删除按钮（危险操作分离） */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        disabled={isDeleting || isLocked}
        className={cn(
          "h-8 px-2",
          isLocked
            ? "opacity-50 cursor-not-allowed"
            : "text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20",
        )}
      >
        <Trash2 className="size-3.5" />
        <span className="ml-1">{isDeleting ? "删除中..." : "删除"}</span>
      </Button>
    </div>
  );
}
