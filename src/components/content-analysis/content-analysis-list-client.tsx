/**
 * 内容分析列表页客户端组件
 *
 * 功能：
 * - 展示所有内容分析报告（对比分析 + 主题综述）
 * - 支持搜索、筛选、排序
 * - 导航到创建页或详情页
 *
 * @version 1.0.0
 * @since 2026-02-13
 */

"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  FileText,
  Clock,
  BookOpen,
  MoreVertical,
  Trash2,
  RefreshCcw,
  ArrowUpDown,
  Lightbulb,
  GitCompare,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSynthesisList } from "@/hooks/synthesis/use-synthesis-list";
import type {
  SynthesisReportSummary,
  SynthesisDepthMode,
  SynthesisStatus,
  SynthesisOutputStyle,
} from "@/lib/synthesis";
import { clientLogger } from "@/lib/client-logger";

// 深度模式配置
const DEPTH_MODE_LABELS: Record<
  SynthesisDepthMode,
  { label: string; icon: string }
> = {
  quick: { label: "快读", icon: "⚡" },
  standard: { label: "标准", icon: "📖" },
  academic: { label: "学术", icon: "🎓" },
};

// 状态配置
const STATUS_CONFIG: Record<
  SynthesisStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "等待中", variant: "secondary" },
  generating: { label: "生成中", variant: "default" },
  completed: { label: "已完成", variant: "outline" },
  failed: { label: "失败", variant: "destructive" },
  cancelled: { label: "已取消", variant: "secondary" },
};

// 排序选项
const SORT_OPTIONS = [
  {
    value: "createdAt-desc",
    label: "最新创建",
    sort: "createdAt" as const,
    order: "desc" as const,
  },
  {
    value: "createdAt-asc",
    label: "最早创建",
    sort: "createdAt" as const,
    order: "asc" as const,
  },
  {
    value: "updatedAt-desc",
    label: "最近更新",
    sort: "updatedAt" as const,
    order: "desc" as const,
  },
  {
    value: "wordCount-desc",
    label: "字数最多",
    sort: "wordCount" as const,
    order: "desc" as const,
  },
  {
    value: "wordCount-asc",
    label: "字数最少",
    sort: "wordCount" as const,
    order: "asc" as const,
  },
];

/**
 * 判断报告类型
 */
function getReportType(
  outputStyle: SynthesisOutputStyle,
  sourceCount: number,
): { label: string; icon: typeof GitCompare; color: string } {
  if (outputStyle === "comparison" || sourceCount === 2) {
    return {
      label: "对比分析",
      icon: GitCompare,
      color: "text-cyan-600 dark:text-cyan-400",
    };
  }
  return {
    label: "主题综述",
    icon: Layers,
    color: "text-purple-600 dark:text-purple-400",
  };
}

/**
 * 分析卡片组件
 */
function AnalysisCard({
  report,
  onDelete,
  onRetry,
}: {
  report: SynthesisReportSummary;
  onDelete: (report: SynthesisReportSummary) => void;
  onRetry: (reportId: string) => void;
}) {
  const depthConfig = DEPTH_MODE_LABELS[report.depthMode];
  const statusConfig = STATUS_CONFIG[report.status];
  const reportType = getReportType(report.outputStyle, report.sourceCount);
  const TypeIcon = reportType.icon;

  return (
    <Card className="hover:bg-muted/50 transition-colors group relative">
      <Link href={`/synthesis/${report.id}`} className="block">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base line-clamp-1 pr-8">
              {report.title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${reportType.color} border-current`}
              >
                <TypeIcon className="h-3 w-3 mr-1" />
                {reportType.label}
              </Badge>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 概述预览 */}
          {report.overviewPreview && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {report.overviewPreview}
            </p>
          )}

          {/* 元信息标签 */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {depthConfig.icon} {depthConfig.label}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {report.sourceCount} 来源
            </span>
            {report.wordCount > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {report.wordCount} 字
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(report.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* 四维统计 */}
          {report.status === "completed" && (
            <div className="flex gap-2">
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                共识 {report.consensusCount}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              >
                分歧 {report.divergenceCount}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
              >
                盲区 {report.blindSpotCount}
              </Badge>
            </div>
          )}
        </CardContent>
      </Link>

      {/* 操作菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.preventDefault()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {report.status === "failed" && (
            <>
              <DropdownMenuItem onClick={() => onRetry(report.id)}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                重新生成
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(report)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}

/**
 * 空状态组件
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <GitCompare className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">还没有分析报告</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        选择 2 篇内容进行对比分析，或 3 篇以上进行主题综述
      </p>
      <Button asChild>
        <Link href="/content-analysis/new">
          <Plus className="mr-2 h-4 w-4" />
          创建分析
        </Link>
      </Button>
    </div>
  );
}

/**
 * 内容分析列表页客户端组件
 */
export function ContentAnalysisListClient() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [depthFilter, setDepthFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortValue, setSortValue] = useState("createdAt-desc");

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] =
    useState<SynthesisReportSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 解析排序选项
  const sortOption =
    SORT_OPTIONS.find((o) => o.value === sortValue) || SORT_OPTIONS[0];

  const { data, isLoading, error, refetch } = useSynthesisList({
    search: search || undefined,
    depthMode:
      depthFilter !== "all" ? (depthFilter as SynthesisDepthMode) : undefined,
    status:
      statusFilter !== "all" ? (statusFilter as SynthesisStatus) : undefined,
    sort: sortOption.sort,
    order: sortOption.order,
  });

  const reports = data?.data || [];

  // 处理删除
  const handleDelete = useCallback((report: SynthesisReportSummary) => {
    setDeleteTarget(report);
  }, []);

  // 确认删除
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/synthesis/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("删除失败");
      }

      toast.success("删除成功");
      refetch();
    } catch (error) {
      clientLogger.error({ error }, "Delete synthesis error:");
      toast.error("删除失败，请重试");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, refetch]);

  // 取消删除
  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  // 处理重试
  const handleRetry = useCallback(
    async (reportId: string) => {
      try {
        const response = await fetch(`/api/synthesis/${reportId}/regenerate`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("重新生成失败");
        }

        toast.success("已开始重新生成");
        router.push(`/synthesis/${reportId}?generate=true`);
      } catch (error) {
        clientLogger.error({ error }, "Retry synthesis error:");
        toast.error("重新生成失败，请重试");
      }
    },
    [router],
  );

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="container max-w-4xl py-6 space-y-6">
        {/* 标题和创建按钮 */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">内容分析</h1>
          <Button asChild>
            <Link href="/content-analysis/new">
              <Plus className="mr-2 h-4 w-4" />
              新建分析
            </Link>
          </Button>
        </div>

        {/* 功能说明 */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          <Lightbulb className="h-4 w-4 shrink-0" />
          <span className="flex items-center gap-1">
            <GitCompare className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            对比分析：2 篇内容对比异同
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="flex items-center gap-1">
            <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            主题综述：3+ 篇内容综合萃取
          </span>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索分析报告..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sortValue} onValueChange={setSortValue}>
            <SelectTrigger className="w-32">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue placeholder="排序" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={depthFilter} onValueChange={setDepthFilter}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="深度" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部深度</SelectItem>
              <SelectItem value="quick">⚡ 快读</SelectItem>
              <SelectItem value="standard">📖 标准</SelectItem>
              <SelectItem value="academic">🎓 学术</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="generating">生成中</SelectItem>
              <SelectItem value="pending">等待中</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 列表内容 */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="h-5 bg-muted rounded w-2/3" />
                    <div className="h-5 bg-muted rounded w-16" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-4/5" />
                  <div className="flex gap-2">
                    <div className="h-4 bg-muted rounded w-12" />
                    <div className="h-4 bg-muted rounded w-16" />
                    <div className="h-4 bg-muted rounded w-14" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-destructive/10 p-4 mb-4">
              <FileText className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-medium mb-2 text-destructive">
              加载失败
            </h3>
            <p className="text-muted-foreground mb-4">请检查网络连接后重试</p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              重试
            </Button>
          </div>
        ) : reports.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <AnalysisCard
                key={report.id}
                report={report}
                onDelete={handleDelete}
                onRetry={handleRetry}
              />
            ))}
          </div>
        )}

        {/* 分页信息 */}
        {data?.pagination && data.pagination.total > 0 && (
          <div className="text-center text-sm text-muted-foreground">
            共 {data.pagination.total} 份分析报告
          </div>
        )}

        {/* 删除确认对话框 */}
        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && cancelDelete()}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除分析报告「{deleteTarget?.title}」吗？此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "删除中..." : "删除"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
