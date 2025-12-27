/**
 * 监控卡片组件
 *
 * 展示单个页面监控的状态信息
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

"use client";

import { useState, memo } from "react";
import {
  MoreVertical,
  Pause,
  Play,
  Trash2,
  ExternalLink,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Bell,
  BellOff,
  Settings,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/date-utils";
import type { MonitorResponse } from "@/app/api/monitors/validation";
import { CHECK_INTERVAL_LABELS } from "@/lib/monitor/constants";

/**
 * 安全地打开外部 URL（防止 javascript: XSS）
 */
function safeOpenUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    // 只允许 http/https 协议
    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch {
    // 无效 URL，忽略
  }
}

interface MonitorCardProps {
  /** 监控数据 */
  monitor: MonitorResponse;
  /** 暂停监控回调 */
  onPause?: (id: number) => void;
  /** 恢复监控回调 */
  onResume?: (id: number) => void;
  /** 删除监控回调 */
  onDelete?: (id: number) => void;
  /** 设置监控回调 */
  onSettings?: (id: number) => void;
  /** 查看详情回调 */
  onViewDetail?: (id: number) => void;
  /** 加载状态 */
  isLoading?: boolean;
}

/**
 * 获取状态配置
 */
function getStatusConfig(status: MonitorResponse["status"]) {
  switch (status) {
    case "active":
      return {
        label: "监控中",
        color: "bg-green-500/10 text-green-600 border-green-500/20",
        icon: CheckCircle2,
      };
    case "paused":
      return {
        label: "已暂停",
        color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
        icon: Pause,
      };
    case "failed":
      return {
        label: "检查失败",
        color: "bg-red-500/10 text-red-600 border-red-500/20",
        icon: AlertCircle,
      };
    default:
      return {
        label: "未知",
        color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
        icon: Clock,
      };
  }
}

/**
 * 监控卡片组件
 */
export const MonitorCard = memo(function MonitorCard({
  monitor,
  onPause,
  onResume,
  onDelete,
  onSettings,
  onViewDetail,
  isLoading = false,
}: MonitorCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const statusConfig = getStatusConfig(monitor.status);
  const StatusIcon = statusConfig.icon;

  const intervalLabel =
    monitor.checkInterval === "custom" && monitor.customIntervalHours
      ? `每 ${monitor.customIntervalHours} 小时`
      : CHECK_INTERVAL_LABELS[monitor.checkInterval] || monitor.checkInterval;

  return (
    <Card
      className={cn(
        "group relative transition-all duration-200 hover:shadow-md",
        isLoading && "opacity-60 pointer-events-none",
      )}
    >
      <CardContent className="p-4">
        {/* 顶部：标题和操作 */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3
              className="font-medium text-sm truncate cursor-pointer hover:text-primary transition-colors"
              onClick={() => onViewDetail?.(monitor.id)}
              title={monitor.bookmarkTitle}
            >
              {monitor.bookmarkTitle}
            </h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {monitor.bookmarkUrl}
            </p>
          </div>

          {/* 操作菜单 */}
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {monitor.status === "active" ? (
                <DropdownMenuItem onClick={() => onPause?.(monitor.id)}>
                  <Pause className="h-4 w-4 mr-2" />
                  暂停监控
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onResume?.(monitor.id)}>
                  <Play className="h-4 w-4 mr-2" />
                  恢复监控
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onSettings?.(monitor.id)}>
                <Settings className="h-4 w-4 mr-2" />
                监控设置
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => safeOpenUrl(monitor.bookmarkUrl)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                访问网页
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete?.(monitor.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除监控
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 状态和检查间隔 */}
        <div className="flex items-center gap-2 mb-3">
          <Badge
            variant="outline"
            className={cn("text-xs font-normal", statusConfig.color)}
          >
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
          <Badge variant="secondary" className="text-xs font-normal">
            <Clock className="h-3 w-3 mr-1" />
            {intervalLabel}
          </Badge>
          {monitor.notificationEnabled ? (
            <Tooltip>
              <TooltipTrigger>
                <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>变更通知已开启</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger>
                <BellOff className="h-3.5 w-3.5 text-muted-foreground/50" />
              </TooltipTrigger>
              <TooltipContent>变更通知已关闭</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* 统计信息 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                <span>{monitor.changeCount} 次变更</span>
              </TooltipTrigger>
              <TooltipContent>累计检测到的内容变更次数</TooltipContent>
            </Tooltip>

            {monitor.lastCheckedAt && (
              <span>
                上次检查: {formatRelativeTime(new Date(monitor.lastCheckedAt))}
              </span>
            )}
          </div>

          {monitor.nextCheckAt && monitor.status === "active" && (
            <span className="text-muted-foreground/70">
              下次: {formatRelativeTime(new Date(monitor.nextCheckAt))}
            </span>
          )}
        </div>

        {/* 错误信息 */}
        {monitor.lastErrorMessage && monitor.status === "failed" && (
          <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            {monitor.lastErrorMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

MonitorCard.displayName = "MonitorCard";
