/**
 * 分类日志客户端组件
 * @description V5.0 分类日志 - 时间轴视图（使用新通知系统）
 * @version 2.0.0
 * @since 2026-02-01
 */

"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  RefreshCw,
  Calendar,
  ChevronRight,
  FolderSync,
  FileCheck,
  AlertCircle,
  Megaphone,
  Gauge,
  Bot,
  FileX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/data/use-notifications";
import type { Notification } from "@/lib/notifications";

// ============================================================================
// 类型定义
// ============================================================================

type ActivityFilter =
  | "all"
  | "batch_operation"
  | "ai_report"
  | "system"
  | "error";

interface ActivityTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  label: string;
}

// ============================================================================
// 常量配置
// ============================================================================

const ACTIVITY_TYPE_CONFIG: Record<string, ActivityTypeConfig> = {
  // 批量操作
  "ai.classification.auto": {
    icon: Bot,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    label: "自动分类",
  },
  "ai.classification.batch": {
    icon: FolderSync,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    label: "批量分类",
  },
  "import.complete": {
    icon: FileCheck,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    label: "导入完成",
  },
  "import.partial": {
    icon: FileCheck,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    label: "部分导入",
  },
  "batch.move": {
    icon: FolderSync,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    label: "批量移动",
  },
  "batch.delete": {
    icon: FileX,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "批量删除",
  },
  // AI 报告
  "ai.evolution_report": {
    icon: Bot,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    label: "AI 报告",
  },
  "ai.summary.complete": {
    icon: Bot,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    label: "摘要生成",
  },
  // 系统
  "system.announcement": {
    icon: Megaphone,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    label: "系统公告",
  },
  "system.update": {
    icon: Megaphone,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    label: "版本更新",
  },
  // 配额
  "quota.warning": {
    icon: Gauge,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    label: "配额预警",
  },
  "quota.critical": {
    icon: Gauge,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "配额临界",
  },
  // 错误
  "ai.classification.failed": {
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "分类失败",
  },
  "import.failed": {
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "导入失败",
  },
  "bookmark.invalid": {
    icon: AlertCircle,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    label: "链接失效",
  },
};

const DEFAULT_CONFIG: ActivityTypeConfig = {
  icon: Activity,
  color: "text-gray-600 dark:text-gray-400",
  bgColor: "bg-gray-100 dark:bg-gray-900/30",
  label: "活动",
};

// 过滤器映射
const FILTER_TYPE_MAP: Record<ActivityFilter, string[]> = {
  all: [],
  batch_operation: [
    "ai.classification.auto",
    "ai.classification.batch",
    "import.complete",
    "import.partial",
    "batch.move",
    "batch.delete",
    "batch.tag",
    "batch.restore",
    "folder.merged",
    "folder.auto_created",
    "folder.auto_split",
    "folder.auto_merged",
    "folder.auto_renamed",
  ],
  ai_report: ["ai.summary.complete", "ai.tags.complete", "ai.evolution_report"],
  system: ["system.announcement", "system.maintenance", "system.update"],
  error: [
    "ai.classification.failed",
    "import.failed",
    "bookmark.invalid",
    "bookmark.expired",
    "ai.processing.failed",
  ],
};

// ============================================================================
// 主组件
// ============================================================================

export function ActivityPageClient() {
  const [filter, setFilter] = useState<ActivityFilter>("all");

  // 使用新的通知 Hook
  const { groups, isLoading, refresh } = useNotifications({
    limit: 100,
  });

  const [refreshing, setRefreshing] = useState(false);

  // 刷新
  const handleRefresh = async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  // 过滤后的分组
  const filteredGroups = useMemo(() => {
    // 过滤通知函数（内联以避免依赖警告）
    const filterNotifications = (
      notifications: Notification[],
    ): Notification[] => {
      if (filter === "all") return notifications;

      const allowedTypes = FILTER_TYPE_MAP[filter];
      return notifications.filter((n) => allowedTypes.includes(n.typeCode));
    };

    return groups
      .map((group) => ({
        ...group,
        notifications: filterNotifications(group.notifications),
      }))
      .filter((group) => group.notifications.length > 0);
  }, [groups, filter]);

  // 总消息数
  const totalMessages = filteredGroups.reduce(
    (sum, group) => sum + group.notifications.length,
    0,
  );

  return (
    <div className="flex flex-col h-full">
      {/* 页面头部 */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">活动日志</h1>
            <p className="text-xs text-muted-foreground">
              {totalMessages > 0 ? `${totalMessages} 条记录` : "暂无活动记录"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as ActivityFilter)}
          >
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="batch_operation">批量操作</SelectItem>
              <SelectItem value="ai_report">AI 报告</SelectItem>
              <SelectItem value="system">系统消息</SelectItem>
              <SelectItem value="error">错误日志</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            title="刷新"
          >
            <RefreshCw
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* 时间轴列表 */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 sm:p-6 space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-5 w-20" />
                <div className="space-y-2 pl-4 border-l-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 px-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Calendar className="size-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">暂无活动记录</h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {filter === "all"
                ? "开始使用 AnyKeep 后，这里会显示您的活动记录"
                : "该类型暂无活动记录"}
            </p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-6">
            {filteredGroups.map((group) => (
              <div key={group.dateGroup} className="space-y-3">
                {/* 日期标签 */}
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {group.label}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {group.notifications.length}
                  </Badge>
                </div>

                {/* 时间轴 */}
                <div className="space-y-2 pl-4 border-l-2 border-muted">
                  {group.notifications.map((item) => (
                    <ActivityItem key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 活动项组件
// ============================================================================

function ActivityItem({ item }: { item: Notification }) {
  const config = ACTIVITY_TYPE_CONFIG[item.typeCode] || DEFAULT_CONFIG;
  const IconComponent = config.icon;

  // 格式化时间
  const time = new Date(item.createdAt).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="relative flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
      {/* 时间轴圆点 */}
      <div
        className={cn(
          "absolute -left-[21px] top-3 size-3 rounded-full border-2 border-background",
          config.bgColor,
        )}
      />

      {/* 图标 */}
      <div className={cn("p-1.5 rounded-lg flex-shrink-0", config.bgColor)}>
        <IconComponent className={cn("size-4", config.color)} />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{item.title}</span>
            <Badge variant="outline" className="text-xs">
              {config.label}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {time}
          </span>
        </div>
        {item.body && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {item.body}
          </p>
        )}
      </div>

      {/* 链接指示 */}
      {item.actionUrl && (
        <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

export default ActivityPageClient;
