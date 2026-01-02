/**
 * 告警列表组件
 *
 * 展示最近的 RAG 系统告警
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

"use client";

import { AlertTriangle, AlertCircle, Info, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface RAGAlert {
  timestamp: string;
  level: "info" | "warning" | "critical";
  type: string;
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
}

interface AlertsListProps {
  alerts: RAGAlert[];
  loading?: boolean;
}

const LEVEL_CONFIG = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    badge: "bg-red-500",
  },
  warning: {
    icon: AlertCircle,
    color: "text-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    border: "border-yellow-200 dark:border-yellow-800",
    badge: "bg-yellow-500",
  },
  info: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-500",
  },
};

const TYPE_LABELS: Record<string, string> = {
  latency: "延迟",
  cache: "缓存",
  quality: "质量",
  cost: "成本",
  error_rate: "错误率",
  availability: "可用性",
};

export function AlertsList({ alerts, loading = false }: AlertsListProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const criticalCount = alerts.filter((a) => a.level === "critical").length;
  const warningCount = alerts.filter((a) => a.level === "warning").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="size-4" />
          告警
        </CardTitle>
        <div className="flex gap-2">
          {criticalCount > 0 && (
            <Badge variant="destructive">{criticalCount} 严重</Badge>
          )}
          {warningCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-yellow-100 text-yellow-700"
            >
              {warningCount} 警告
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Info className="size-8 mb-2 opacity-50" />
            <p className="text-sm">暂无告警</p>
            <p className="text-xs">系统运行正常</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-2">
              {alerts.slice(0, 20).map((alert, index) => {
                const config = LEVEL_CONFIG[alert.level];
                const Icon = config.icon;
                const time = new Date(alert.timestamp);

                return (
                  <div
                    key={`${alert.timestamp}-${index}`}
                    className={cn(
                      "p-3 rounded-lg border",
                      config.bg,
                      config.border,
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon
                        className={cn("size-4 mt-0.5 shrink-0", config.color)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="secondary"
                            className={cn("text-xs text-white", config.badge)}
                          >
                            {TYPE_LABELS[alert.type] || alert.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {time.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm mt-1">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
