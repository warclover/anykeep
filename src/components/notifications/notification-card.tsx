/**
 * 通知卡片
 * @description Notion 风格的通知卡片组件
 */

"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  MoreHorizontal,
  Check,
  Archive,
  Trash2,
  ExternalLink,
  Bell,
  FolderOpen,
  Download,
  AlertTriangle,
  Sparkles,
  Tags,
  Brain,
  Layers,
  Eye,
  MessageSquare,
  Megaphone,
  DollarSign,
  Trash,
  RotateCcw,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Notification } from "@/lib/notifications";
import { PRIORITY_CONFIG } from "@/lib/notifications";

// ============================================================================
// 图标映射
// ============================================================================

const TYPE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  // AI 类
  "ai.classification.auto": FolderOpen,
  "ai.classification.batch": FolderOpen,
  "ai.classification.failed": AlertTriangle,
  "ai.summary.complete": Sparkles,
  "ai.tags.complete": Tags,
  "ai.processing.failed": AlertTriangle,
  "ai.evolution_report": Sparkles,

  // 导入类
  "import.complete": Download,
  "import.partial": Download,
  "import.failed": AlertTriangle,

  // 文件夹类
  "folder.created": FolderOpen,
  "folder.auto_created": FolderOpen,
  "folder.auto_split": FolderOpen,
  "folder.auto_merged": FolderOpen,
  "folder.auto_renamed": FolderOpen,
  "folder.merged": FolderOpen,
  "folder.operation_undone": RotateCcw,

  // 配额类
  "quota.warning": AlertTriangle,
  "quota.critical": AlertTriangle,
  "quota.exceeded": AlertTriangle,
  "cost.daily_exceeded": DollarSign,

  // 系统类
  "system.announcement": Megaphone,
  "system.maintenance": AlertTriangle,
  "system.update": Bell,

  // 批量操作类
  "batch.move": FolderOpen,
  "batch.delete": Trash,
  "batch.tag": Tags,
  "batch.restore": RotateCcw,

  // 书签类
  "bookmark.saved": Bookmark,
  "bookmark.invalid": AlertTriangle,
  "bookmark.expired": AlertTriangle,

  // 复习类
  "review.reminder": Brain,
  "review.complete": Brain,

  // 合成类
  "synthesis.complete": Layers,
  "synthesis.failed": AlertTriangle,

  // 监控类
  "monitor.content_changed": Eye,
  "monitor.failed": AlertTriangle,
  "monitor.quota_reached": AlertTriangle,

  // 反馈类
  "feedback.received": MessageSquare,
  "feedback.response": MessageSquare,
};

// ============================================================================
// 组件
// ============================================================================

interface NotificationCardProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  className?: string;
}

export function NotificationCard({
  notification,
  onMarkAsRead,
  onDelete,
  onArchive,
  className,
}: NotificationCardProps) {
  const router = useRouter();

  const isUnread = notification.status === "unread";
  const isCritical =
    notification.priority === "critical" ||
    notification.typeCode.includes("critical") ||
    notification.typeCode.includes("exceeded");

  const priorityConfig = PRIORITY_CONFIG[notification.priority];
  const Icon = TYPE_ICONS[notification.typeCode] ?? Bell;

  // 格式化时间
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: zhCN,
  });

  // 点击卡片
  const handleClick = () => {
    // 标记已读
    if (isUnread && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }

    // 跳转
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  // 标记已读
  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkAsRead?.(notification.id);
  };

  // 删除
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(notification.id);
  };

  // 归档
  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArchive?.(notification.id);
  };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 p-4 transition-colors cursor-pointer",
        "hover:bg-muted/50",
        isUnread && priorityConfig.bgColor,
        className,
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
    >
      {/* 左侧优先级指示条 */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-r-full transition-colors",
          isUnread
            ? isCritical
              ? "bg-red-500"
              : priorityConfig.indicatorColor
            : "bg-transparent",
        )}
      />

      {/* 图标 */}
      <div
        className={cn(
          "flex items-center justify-center size-8 rounded-full shrink-0",
          isUnread ? priorityConfig.bgColor : "bg-muted/50",
        )}
      >
        <Icon
          className={cn(
            "size-4",
            isCritical
              ? "text-red-500"
              : isUnread
                ? priorityConfig.iconColor
                : "text-muted-foreground",
          )}
        />
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-w-0">
        {/* 标题行 */}
        <div className="flex items-center gap-2">
          <h4
            className={cn(
              "text-sm truncate",
              isUnread
                ? "font-semibold text-foreground"
                : "text-muted-foreground",
            )}
          >
            {notification.title}
          </h4>

          {/* 未读标记 */}
          {isUnread && (
            <span className="size-2 rounded-full bg-primary shrink-0" />
          )}
        </div>

        {/* 正文 */}
        {notification.body && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}

        {/* 操作链接 */}
        {notification.actionLabel && (
          <span className="inline-flex items-center gap-1 text-xs text-primary mt-1">
            {notification.actionLabel}
            <ExternalLink className="size-3" />
          </span>
        )}
      </div>

      {/* 右侧区域 */}
      <div className="flex items-center gap-2 shrink-0">
        {/* 时间 */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {timeAgo}
        </span>

        {/* 操作菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 opacity-0 group-hover:opacity-100 transition-opacity",
                "focus:opacity-100",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
              <span className="sr-only">更多操作</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isUnread && (
              <DropdownMenuItem onClick={handleMarkAsRead}>
                <Check className="size-4 mr-2" />
                标记已读
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleArchive}>
              <Archive className="size-4 mr-2" />
              归档
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
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
