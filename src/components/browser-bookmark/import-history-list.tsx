/**
 * 导入历史记录列表组件
 * 展示用户的书签导入历史
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  FolderPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getImportHistory,
  deleteImportHistory,
  getImportSourceDisplayName,
  calculateSuccessRate,
  formatDuration,
} from "@/lib/browser-bookmark";
import type {
  ImportHistory,
  ImportErrorDetail,
  ImportSource,
} from "@/types/supabase";
import { cn } from "@/lib/utils";
import { clientLogger } from "@/lib/client-logger";

// ============================================
// 类型定义
// ============================================

interface ImportHistoryListProps {
  /** 最大显示条数 */
  maxItems?: number;
  /** 是否显示标题 */
  showHeader?: boolean;
  /** 删除后回调 */
  onDelete?: () => void;
  /** 自定义类名 */
  className?: string;
}

// ============================================
// 辅助组件
// ============================================

/** 状态徽章 */
function StatusBadge({ history }: { history: ImportHistory }) {
  const successRate = calculateSuccessRate(history);

  if (successRate === 100) {
    return (
      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        全部成功
      </Badge>
    );
  }

  if (successRate >= 80) {
    return (
      <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        {successRate}% 成功
      </Badge>
    );
  }

  if (successRate > 0) {
    return (
      <Badge
        variant="secondary"
        className="bg-yellow-500 hover:bg-yellow-600 text-white"
      >
        <AlertCircle className="mr-1 h-3 w-3" />
        {successRate}% 成功
      </Badge>
    );
  }

  return (
    <Badge variant="destructive">
      <XCircle className="mr-1 h-3 w-3" />
      导入失败
    </Badge>
  );
}

/** 统计信息 */
function StatItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5 text-sm", className)}>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** 错误详情展开组件 */
function ErrorDetails({ errors }: { errors: ImportErrorDetail[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (errors.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-red-600"
        >
          {isOpen ? (
            <ChevronDown className="mr-1 h-3 w-3" />
          ) : (
            <ChevronRight className="mr-1 h-3 w-3" />
          )}
          查看 {errors.length} 个错误
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1 rounded-md bg-red-50 p-2 text-xs">
          {errors.slice(0, 10).map((error, index) => (
            <div key={index} className="flex items-start gap-2 text-red-700">
              <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {error.title || error.url}
                </div>
                <div className="text-red-600">{error.error}</div>
              </div>
            </div>
          ))}
          {errors.length > 10 && (
            <div className="text-muted-foreground">
              还有 {errors.length - 10} 个错误...
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** 单条历史记录项 */
function HistoryItem({
  history,
  onDelete,
}: {
  history: ImportHistory;
  onDelete: (id: string) => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteImportHistory(history.id);
      onDelete(history.id);
    } catch (error) {
      clientLogger.error({ error }, "删除历史记录失败");
    } finally {
      setIsDeleting(false);
    }
  };

  const errorDetails =
    (history.error_details as ImportErrorDetail[] | null) || [];

  return (
    <div className="border-b py-4 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          {/* 来源和状态 */}
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {getImportSourceDisplayName(
                history.import_source as ImportSource,
              )}
            </span>
            <StatusBadge history={history} />
          </div>

          {/* 时间和耗时 */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>
              {format(new Date(history.created_at), "yyyy-MM-dd HH:mm", {
                locale: zhCN,
              })}
            </span>
            {history.duration_ms && (
              <StatItem
                icon={Clock}
                label="耗时"
                value={formatDuration(history.duration_ms)}
              />
            )}
          </div>

          {/* 统计数据 */}
          <div className="flex flex-wrap items-center gap-4">
            <StatItem
              icon={FileText}
              label="总计"
              value={history.total_count}
            />
            <StatItem
              icon={CheckCircle2}
              label="成功"
              value={history.success_count ?? 0}
              className="text-green-600"
            />
            {history.skipped_count > 0 && (
              <StatItem
                icon={AlertCircle}
                label="跳过"
                value={history.skipped_count}
                className="text-yellow-600"
              />
            )}
            {history.failed_count > 0 && (
              <StatItem
                icon={XCircle}
                label="失败"
                value={history.failed_count}
                className="text-red-600"
              />
            )}
            {(history.folders_created ?? 0) > 0 && (
              <StatItem
                icon={FolderPlus}
                label="文件夹"
                value={history.folders_created ?? 0}
              />
            )}
          </div>

          {/* 错误详情 */}
          {errorDetails.length > 0 && <ErrorDetails errors={errorDetails} />}
        </div>

        {/* 删除按钮 */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>删除历史记录</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除这条导入历史记录吗？此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ============================================
// 主组件
// ============================================

export function ImportHistoryList({
  maxItems = 20,
  showHeader = true,
  onDelete,
  className,
}: ImportHistoryListProps) {
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getImportHistory({ limit: maxItems });
      setHistory(result.history);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "加载失败";
      setError(errorMsg);
      clientLogger.error({ error: err }, "加载导入历史失败");
    } finally {
      setIsLoading(false);
    }
  }, [maxItems]);

  // 初始加载
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // 删除处理
  const handleDelete = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
    onDelete?.();
  };

  // 空状态
  if (!isLoading && !error && history.length === 0) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" />
              导入历史
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <History className="mb-3 h-12 w-12 opacity-50" />
            <p>暂无导入历史</p>
            <p className="text-sm">导入书签后，历史记录将显示在这里</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            导入历史
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={loadHistory}
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </CardHeader>
      )}
      <CardContent>
        {error ? (
          <div className="flex flex-col items-center justify-center py-8 text-destructive">
            <AlertCircle className="mb-3 h-12 w-12" />
            <p>{error}</p>
            <Button variant="outline" className="mt-4" onClick={loadHistory}>
              重试
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-0">
              {history.map((item) => (
                <HistoryItem
                  key={item.id}
                  history={item}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default ImportHistoryList;
