/**
 * 活动日志客户端组件
 * @description V4.3 L3 活动日志 - 时间轴视图
 * @version 1.0.0
 * @since 2025-12-12
 */

"use client";

import { useEffect, useState, useCallback } from "react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MessageGroup, Message } from "@/lib/messages";
import type { ActivityLogItem } from "@/lib/notifications/types";
import { clientLogger } from "@/lib/client-logger";

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
  classification_auto: {
    icon: Bot,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    label: "自动分类",
  },
  classification_batch: {
    icon: FolderSync,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    label: "批量分类",
  },
  import_complete: {
    icon: FileCheck,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    label: "导入完成",
  },
  import_partial: {
    icon: FileCheck,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    label: "部分导入",
  },
  batch_move: {
    icon: FolderSync,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    label: "批量移动",
  },
  batch_delete: {
    icon: FileX,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "批量删除",
  },
  // AI 报告
  ai_evolution_report: {
    icon: Bot,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    label: "AI 报告",
  },
  ai_summary_complete: {
    icon: Bot,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    label: "摘要生成",
  },
  // 系统
  system_announcement: {
    icon: Megaphone,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    label: "系统公告",
  },
  system_update: {
    icon: Megaphone,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    label: "版本更新",
  },
  // 配额
  quota_warning: {
    icon: Gauge,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    label: "配额预警",
  },
  quota_critical: {
    icon: Gauge,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "配额临界",
  },
  // 错误
  classification_failed: {
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "分类失败",
  },
  import_failed: {
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    label: "导入失败",
  },
  bookmark_invalid: {
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

// ============================================================================
// 主组件
// ============================================================================

export function ActivityPageClient() {
  const [groups, setGroups] = useState<MessageGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>("all");

  // 获取活动日志
  const fetchActivityLogs = useCallback(async () => {
    try {
      // V4.3: classification_suggest 消息已在数据库迁移中删除
      // 直接获取所有消息作为活动日志
      const response = await fetch("/api/messages?status=all&limit=100");

      if (!response.ok) throw new Error("Failed to fetch activity logs");

      const data = await response.json();
      setGroups(data.groups || []);
    } catch (error) {
      clientLogger.error({ error }, "Failed to fetch activity logs");
      toast.error("获取活动日志失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActivityLogs();
  }, [fetchActivityLogs]);

  // 刷新
  const handleRefresh = () => {
    setRefreshing(true);
    fetchActivityLogs();
  };

  // 过滤消息（兼容 items 或 messages）
  const filterItems = (
    items: (Message | ActivityLogItem)[],
  ): (Message | ActivityLogItem)[] => {
    if (filter === "all") return items;

    const filterMap: Record<ActivityFilter, string[]> = {
      all: [],
      batch_operation: [
        "classification_auto",
        "classification_batch",
        "import_complete",
        "import_partial",
        "batch_move",
        "batch_delete",
        "batch_tag",
        "batch_restore",
        "folder_merged",
        "folder_auto_created",
        "folder_auto_split",
        "folder_auto_merged",
        "folder_auto_renamed",
      ],
      ai_report: [
        "ai_summary_complete",
        "ai_tags_complete",
        "ai_evolution_report",
      ],
      system: ["system_announcement", "system_maintenance", "system_update"],
      error: [
        "classification_failed",
        "import_failed",
        "bookmark_invalid",
        "bookmark_expired",
        "ai_processing_failed",
      ],
    };

    const allowedTypes = filterMap[filter];
    return items.filter((m) => allowedTypes.includes(m.type));
  };

  // 过滤后的分组（兼容 items 或 messages 属性）
  const filteredGroups = groups
    .map((group) => {
      const items =
        (group as { items?: (Message | ActivityLogItem)[] }).items ||
        group.messages;
      return {
        ...group,
        items: filterItems(items),
      };
    })
    .filter((group) => group.items.length > 0);

  // 总消息数
  const totalMessages = filteredGroups.reduce(
    (sum, group) => sum + group.items.length,
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
        {loading ? (
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
              <div key={group.date_group} className="space-y-3">
                {/* 日期标签 */}
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {group.label}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {group.items.length}
                  </Badge>
                </div>

                {/* 时间轴 */}
                <div className="space-y-2 pl-4 border-l-2 border-muted">
                  {group.items.map((item) => (
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

function ActivityItem({ item }: { item: Message | ActivityLogItem }) {
  const config = ACTIVITY_TYPE_CONFIG[item.type] || DEFAULT_CONFIG;
  const IconComponent = config.icon;

  // 格式化时间
  const time = new Date(item.created_at).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // 获取 action_url（兼容两种类型）
  const actionUrl =
    "action_url" in item
      ? item.action_url
      : (item as ActivityLogItem).detail_url;

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
        {item.content && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {item.content}
          </p>
        )}
      </div>

      {/* 链接指示 */}
      {actionUrl && (
        <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

export default ActivityPageClient;
