/**
 * 分类建议历史卡片组件
 * 展示用户的分类建议处理历史和统计
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  FolderPlus,
  FolderInput,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { clientLogger } from "@/lib/client-logger";
import { API_CLASSIFICATION } from "@/lib/constants/api-paths";

interface SuggestionHistoryItem {
  id: number;
  bookmarkId: number;
  bookmarkTitle: string;
  suggestedFolderName: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected" | "expired";
  reason: string | null;
  suggestNewFolder: boolean;
  createdAt: string;
  processedAt: string | null;
}

interface HistoryStats {
  total: number;
  accepted: number;
  rejected: number;
  pending: number;
  acceptanceRate: number;
}

type FilterStatus = "all" | "accepted" | "rejected" | "pending";

interface ClassificationHistoryCardProps {
  className?: string;
}

export function ClassificationHistoryCard({
  className,
}: ClassificationHistoryCardProps) {
  const [items, setItems] = useState<SuggestionHistoryItem[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");

  // 加载历史数据
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (filter !== "all") {
        params.set("status", filter);
      }

      const response = await fetch(
        `${API_CLASSIFICATION.analyticsHistory}&${params}`,
      );
      if (!response.ok) throw new Error("Failed to load history");

      const data = await response.json();
      setItems(data.data?.items || []);
      setStats(data.data?.stats || null);
    } catch (error) {
      clientLogger.error({ error }, "Failed to load classification history");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 获取状态图标
  const getStatusIcon = (status: SuggestionHistoryItem["status"]) => {
    switch (status) {
      case "accepted":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  // 获取状态文本
  const getStatusText = (status: SuggestionHistoryItem["status"]) => {
    switch (status) {
      case "accepted":
        return "已采纳";
      case "rejected":
        return "已拒绝";
      case "pending":
        return "待处理";
      case "expired":
        return "已过期";
      default:
        return "未知";
    }
  };

  // 加载状态
  if (isLoading && items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="size-5 text-blue-500" />
            分类建议历史
          </CardTitle>
          {stats && stats.total > 0 && (
            <Badge variant="secondary" className="text-xs">
              共 {stats.total} 条
            </Badge>
          )}
        </div>
        <CardDescription>
          查看 AI 分类建议的处理历史和采纳率统计
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 统计概览 */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
              <p className="text-xs text-muted-foreground">总建议</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {stats.accepted}
              </p>
              <p className="text-xs text-muted-foreground">已采纳</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {stats.rejected}
              </p>
              <p className="text-xs text-muted-foreground">已拒绝</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">
                {stats.pending}
              </p>
              <p className="text-xs text-muted-foreground">待处理</p>
            </div>
          </div>
        )}

        {/* 采纳率进度条 */}
        {stats && stats.total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                采纳率
              </span>
              <span className="font-medium">{stats.acceptanceRate}%</span>
            </div>
            <Progress value={stats.acceptanceRate} className="h-2" />
          </div>
        )}

        {/* 筛选标签 */}
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as FilterStatus)}
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="accepted">已采纳</TabsTrigger>
            <TabsTrigger value="rejected">已拒绝</TabsTrigger>
            <TabsTrigger value="pending">待处理</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 历史列表 */}
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>暂无分类建议记录</p>
            <p className="text-sm mt-1">添加书签后，AI 会自动生成分类建议</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 bg-background border rounded-lg hover:bg-muted/50 transition-colors"
              >
                {/* 类型图标 */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    item.suggestNewFolder
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-blue-100 dark:bg-blue-900/30",
                  )}
                >
                  {item.suggestNewFolder ? (
                    <FolderPlus className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <FolderInput className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    title={item.bookmarkTitle}
                  >
                    {item.bookmarkTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.suggestNewFolder ? "建议创建" : "建议移动到"}「
                    {item.suggestedFolderName}」<span className="mx-1">·</span>
                    置信度 {item.confidence}%
                  </p>
                </div>

                {/* 状态和时间 */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    {getStatusIcon(item.status)}
                    <span className="text-xs text-muted-foreground">
                      {getStatusText(item.status)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 查看更多按钮 */}
        {items.length >= 20 && (
          <Button variant="ghost" className="w-full" size="sm">
            查看更多
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default ClassificationHistoryCard;
