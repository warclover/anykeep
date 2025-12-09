/**
 * 消息项组件
 * @description 单条消息的展示，根据等级显示不同样式
 */

"use client";

import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Info,
  AlertTriangle,
  MoreHorizontal,
  Trash2,
  Archive,
  FolderOpen,
  Import,
  Tags,
  Sparkles,
  MessageSquare,
  Zap,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Message, MessageType, MessageLevel } from "@/lib/messages";
import { getVisualStyle } from "@/lib/messages";

// ============================================
// 类型定义
// ============================================

export interface MessageItemProps {
  message: Message;
  onRead?: (id: number) => void;
  onDelete?: (id: number) => void;
  onArchive?: (id: number) => void;
}

// ============================================
// 消息类型图标映射
// ============================================

const TYPE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  // 分类相关
  classification_auto: FolderOpen,
  classification_batch: FolderOpen,
  classification_suggest: FolderOpen,
  classification_failed: AlertCircle,
  // 导入相关
  import_complete: Import,
  import_partial: Import,
  import_failed: AlertCircle,
  // 批量操作
  batch_move: FolderOpen,
  batch_delete: Trash2,
  batch_tag: Tags,
  batch_restore: Archive,
  // 书签状态
  bookmark_saved: Check,
  bookmark_invalid: AlertCircle,
  bookmark_expired: AlertCircle,
  // 文件夹
  folder_created: FolderOpen,
  folder_merged: FolderOpen,
  // 系统
  system_announcement: Bell,
  system_maintenance: AlertTriangle,
  system_update: Sparkles,
  // 配额
  quota_warning: AlertTriangle,
  quota_critical: AlertTriangle,
  quota_exceeded: AlertCircle,
  // 反馈
  feedback_received: MessageSquare,
  feedback_response: MessageSquare,
  // AI
  ai_summary_complete: Zap,
  ai_tags_complete: Tags,
  ai_processing_failed: AlertCircle,
};

// ============================================
// 组件实现
// ============================================

export function MessageItem({
  message,
  onRead,
  onDelete,
  onArchive,
}: MessageItemProps) {
  const router = useRouter();
  const isUnread = message.status === "unread";

  // 获取视觉样式
  const styles = getVisualStyle(
    message.level as MessageLevel,
    message.type as MessageType,
  );

  // 判断是否为紧急消息
  const isCritical =
    message.type === "quota_critical" || message.type === "quota_exceeded";

  // 获取图标组件
  const IconComponent = TYPE_ICONS[message.type] || Info;

  // 格式化时间
  const timeAgo = formatDistanceToNow(new Date(message.created_at), {
    addSuffix: true,
    locale: zhCN,
  });

  // 处理点击操作按钮
  const handleAction = () => {
    if (message.action_url) {
      // 标记已读
      if (isUnread && onRead) {
        onRead(message.id);
      }
      router.push(message.action_url);
    }
  };

  // 处理标记已读
  const handleMarkRead = () => {
    onRead?.(message.id);
  };

  // 处理归档
  const handleArchive = () => {
    onArchive?.(message.id);
  };

  // 处理删除
  const handleDelete = () => {
    onDelete?.(message.id);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 transition-colors relative group",
        isUnread ? styles.unreadBg : styles.background,
        "hover:bg-accent/50",
      )}
    >
      {/* 左侧等级指示条 */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1",
          isCritical ? "bg-red-500" : styles.indicator,
        )}
      />

      {/* 消息图标 */}
      <div
        className={cn(
          "flex-shrink-0 mt-0.5 pl-2",
          isCritical ? "text-red-500" : styles.icon,
        )}
      >
        <IconComponent className="size-5" />
      </div>

      {/* 消息内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4
            className={cn(
              "text-sm truncate",
              isCritical
                ? "text-red-700 dark:text-red-400 font-semibold"
                : styles.title,
              isUnread && "font-semibold",
            )}
          >
            {message.title}
          </h4>
          {isUnread && (
            <span
              className={cn(
                "size-2 rounded-full flex-shrink-0",
                isCritical ? "bg-red-500" : styles.indicator,
              )}
            />
          )}
          {message.level === "important" && (
            <Badge
              variant="outline"
              className={cn(
                "flex-shrink-0 text-xs",
                isCritical
                  ? "text-red-600 border-red-300 dark:text-red-400 dark:border-red-700"
                  : "text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-700",
              )}
            >
              {isCritical ? "紧急" : "重要"}
            </Badge>
          )}
        </div>

        {message.content && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {message.content}
          </p>
        )}

        <p className="text-xs text-muted-foreground mt-2">{timeAgo}</p>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {message.action_url && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAction}
            className="hidden sm:flex"
          >
            {message.action_label || "查看"}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {message.action_url && (
              <DropdownMenuItem onClick={handleAction} className="sm:hidden">
                <Check className="size-4 mr-2" />
                {message.action_label || "查看"}
              </DropdownMenuItem>
            )}
            {isUnread && (
              <DropdownMenuItem onClick={handleMarkRead}>
                <Check className="size-4 mr-2" />
                标记已读
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleArchive}>
              <Archive className="size-4 mr-2" />
              归档
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive"
            >
              <Trash2 className="size-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
