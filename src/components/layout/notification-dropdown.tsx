/**
 * 通知下拉面板组件
 *
 * 显示未读通知列表和快捷操作
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Bell,
  Check,
  CheckCheck,
  AlertCircle,
  AlertTriangle,
  Info,
  Sparkles,
  FolderOpen,
  Download,
  Brain,
  Layers,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useNotificationCount,
  type NotificationItem,
} from "@/hooks/domain/notification/use-notification-count";
import { cn } from "@/lib/utils";

// ============================================================================
// 常量
// ============================================================================

const LABELS = {
  title: "通知",
  markAllRead: "全部已读",
  empty: "暂无新通知",
  viewAll: "查看全部",
} as const;

// 图标映射
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  FolderOpen,
  AlertCircle,
  AlertTriangle,
  Download,
  Brain,
  Layers,
  DollarSign,
  MessageSquare,
  Info,
};

// 优先级颜色
const PRIORITY_STYLES: Record<string, string> = {
  critical: "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20",
  important: "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20",
  normal: "border-l-4 border-l-blue-500",
  silent: "",
};

// 分类颜色
const CATEGORY_COLORS: Record<string, string> = {
  ai: "text-purple-500",
  system: "text-blue-500",
  user: "text-green-500",
  billing: "text-amber-500",
};

// ============================================================================
// 子组件
// ============================================================================

/**
 * 单条通知项
 */
function NotificationListItem({
  notification,
  onMarkRead,
  onClick,
}: {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
  onClick: (notification: NotificationItem) => void;
}) {
  const IconComponent = notification.icon
    ? ICON_MAP[notification.icon] || Info
    : Info;

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: zhCN,
  });

  return (
    <div
      className={cn(
        "p-3 hover:bg-muted/50 cursor-pointer transition-colors",
        PRIORITY_STYLES[notification.priority],
      )}
      onClick={() => onClick(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(notification);
        }
      }}
    >
      <div className="flex gap-3">
        {/* 图标 */}
        <div
          className={cn(
            "shrink-0 mt-0.5",
            CATEGORY_COLORS[notification.category],
          )}
        >
          <IconComponent className="size-4" />
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{notification.title}</p>
          {notification.body && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {notification.body}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
        </div>

        {/* 标记已读按钮 */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 size-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onMarkRead(notification.id);
          }}
          aria-label="标记已读"
        >
          <Check className="size-3" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

/**
 * 通知下拉面板
 *
 * 功能：
 * - 显示未读通知数量徽章
 * - 点击展开通知列表
 * - 支持标记单条/全部已读
 * - 点击通知可跳转到相关页面
 */
export function NotificationDropdown() {
  const router = useRouter();
  const { unreadCount, notifications, isLoading, markAsRead, markAllAsRead } =
    useNotificationCount();

  const handleNotificationClick = (notification: NotificationItem) => {
    // 标记已读
    markAsRead([notification.id]);

    // 跳转到相关页面
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const handleMarkRead = (id: string) => {
    markAsRead([id]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative hidden sm:flex"
          aria-label={`通知 ${unreadCount > 0 ? `(${unreadCount} 条未读)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold">{LABELS.title}</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="size-3 mr-1" />
              {LABELS.markAllRead}
            </Button>
          )}
        </div>

        {/* 通知列表 */}
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-muted-foreground text-sm">
                加载中...
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Bell className="size-8 opacity-50" />
              <p className="text-sm">{LABELS.empty}</p>
            </div>
          ) : (
            <div className="divide-y group">
              {notifications.map((notification) => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* 底部链接 */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => router.push("/notifications")}
              >
                {LABELS.viewAll}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationDropdown;
