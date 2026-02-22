/**
 * Knowledge Studio v2 - 生成历史页面客户端组件
 * @module knowledge-studio/v2
 * @description 展示生成历史列表，支持查看详情和复用配置
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  History,
  Calendar,
  RefreshCw,
  ExternalLink,
  Loader2,
  FileText,
  AlertCircle,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getBlueprintDisplayConfig } from "@/lib/knowledge-studio/blueprint/unified-display-config";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

// ============================================================
// Types
// ============================================================

interface ReportItem {
  id: string;
  blueprint_type: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  version: number | null;
}

interface ReportsResponse {
  data: ReportItem[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
}

// ============================================================
// Constants
// ============================================================

const HISTORY_PAGE_TEXT = {
  PAGE_TITLE: "生成历史",
  PAGE_DESCRIPTION: "查看过往生成记录，一键复用配置",
  BACK_BUTTON: "返回工坊",
  NO_HISTORY: "暂无生成记录",
  NO_HISTORY_HINT: "开始你的第一次内容生成",
  START_BUTTON: "开始生成",
  VIEW_DETAIL: "查看详情",
  REUSE_CONFIG: "复用配置",
  LOADING: "加载历史记录...",
  LOAD_MORE: "加载更多",
  VERSION_LABEL: "版本",
} as const;

const PAGE_SIZE = 20;

// ============================================================
// Component
// ============================================================

export function HistoryPageClient() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 获取历史记录
  const fetchReports = useCallback(async (pageNum: number, append = false) => {
    try {
      if (pageNum === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      const response = await fetch(
        `/api/knowledge-studio/reports?page=${pageNum}&pageSize=${PAGE_SIZE}&sortBy=created_at&sortOrder=desc`,
      );

      if (!response.ok) {
        throw new Error("获取历史记录失败");
      }

      const data: ReportsResponse = await response.json();

      if (append) {
        setReports((prev) => [...prev, ...data.data]);
      } else {
        setReports(data.data);
      }

      setHasMore(data.data.length === PAGE_SIZE);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(1);
  }, [fetchReports]);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchReports(page + 1, true);
    }
  }, [fetchReports, page, isLoadingMore, hasMore]);

  // 返回工坊首页
  const handleBack = useCallback(() => {
    router.push("/knowledge-studio/v2");
  }, [router]);

  // 查看报告详情
  const handleViewReport = useCallback(
    (reportId: string) => {
      router.push(`/knowledge-studio/reports/${reportId}`);
    },
    [router],
  );

  // 复用配置：跳转到工坊并预填充蓝图类型
  const handleReuseConfig = useCallback(
    (blueprintType: string | null) => {
      if (blueprintType) {
        // 将蓝图类型存入 sessionStorage，工坊首页会读取并预选
        sessionStorage.setItem("ks-v2-preselect-blueprint", blueprintType);
      }
      router.push("/knowledge-studio/v2");
    },
    [router],
  );

  // 格式化时间
  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return dateString;
    }
  };

  // 格式化完整日期
  const formatFullDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  // 错误状态
  if (error && !isLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => fetchReports(1)}>
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {HISTORY_PAGE_TEXT.BACK_BUTTON}
            </Button>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mt-2">
            <History className="h-6 w-6" />
            {HISTORY_PAGE_TEXT.PAGE_TITLE}
          </h1>
          <p className="text-muted-foreground">
            {HISTORY_PAGE_TEXT.PAGE_DESCRIPTION}
          </p>
        </div>
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">
            {HISTORY_PAGE_TEXT.LOADING}
          </span>
        </div>
      )}

      {/* 空状态 */}
      {!isLoading && reports.length === 0 && (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {HISTORY_PAGE_TEXT.NO_HISTORY}
            </h3>
            <p className="text-muted-foreground mb-4">
              {HISTORY_PAGE_TEXT.NO_HISTORY_HINT}
            </p>
            <Button onClick={handleBack}>
              {HISTORY_PAGE_TEXT.START_BUTTON}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 历史记录列表 */}
      {!isLoading && reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              生成记录
              <Badge variant="secondary" className="ml-2">
                {reports.length} 条
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y">
                {reports.map((report) => {
                  const blueprintConfig = getBlueprintDisplayConfig(
                    report.blueprint_type,
                  );

                  return (
                    <div
                      key={report.id}
                      className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors group"
                    >
                      {/* 蓝图图标 */}
                      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-primary/10 text-xl">
                        {blueprintConfig.icon}
                      </div>

                      {/* 主内容 */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {report.title}
                          </span>
                          {report.version && report.version > 1 && (
                            <Badge variant="outline" className="text-xs">
                              {HISTORY_PAGE_TEXT.VERSION_LABEL} {report.version}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {blueprintConfig.name}
                          </Badge>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(report.created_at)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {formatFullDate(report.created_at)}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewReport(report.id)}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {HISTORY_PAGE_TEXT.VIEW_DETAIL}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleReuseConfig(report.blueprint_type)
                                }
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                {HISTORY_PAGE_TEXT.REUSE_CONFIG}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              使用相同模板开始新的生成
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      {/* 默认显示的箭头指示器 */}
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-50 group-hover:opacity-0 transition-opacity" />
                    </div>
                  );
                })}
              </div>

              {/* 加载更多 */}
              {hasMore && (
                <div className="p-4 flex justify-center border-t">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        加载中...
                      </>
                    ) : (
                      HISTORY_PAGE_TEXT.LOAD_MORE
                    )}
                  </Button>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
