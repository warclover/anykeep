"use client";

import {
  Search,
  Lightbulb,
  GitCompare,
  Layers,
  ArrowUpDown,
  FileText,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SynthesisReportSummary } from "@/lib/synthesis";
import { AnalysisCard } from "./analysis-card";
import { SORT_OPTIONS } from "./types";

interface HistoryTabProps {
  reports: SynthesisReportSummary[];
  isLoading: boolean;
  error: unknown;
  pagination?: { total: number } | null;
  search: string;
  onSearchChange: (value: string) => void;
  sortValue: string;
  onSortChange: (value: string) => void;
  depthFilter: string;
  onDepthFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onDelete: (report: SynthesisReportSummary) => void;
  onRetry: (reportId: string) => void;
  onRefetch: () => void;
}

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
    </div>
  );
}

function ListSkeleton() {
  return (
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
  );
}

export function HistoryTab({
  reports,
  isLoading,
  error,
  pagination,
  search,
  onSearchChange,
  sortValue,
  onSortChange,
  depthFilter,
  onDepthFilterChange,
  statusFilter,
  onStatusFilterChange,
  onDelete,
  onRetry,
  onRefetch,
}: HistoryTabProps) {
  return (
    <div className="space-y-4 mt-4">
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

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索分析报告..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortValue} onValueChange={onSortChange}>
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
        <Select value={depthFilter} onValueChange={onDepthFilterChange}>
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
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
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

      {isLoading ? (
        <ListSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <FileText className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-medium mb-2 text-destructive">
            加载失败
          </h3>
          <p className="text-muted-foreground mb-4">请检查网络连接后重试</p>
          <Button variant="outline" onClick={onRefetch}>
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
              onDelete={onDelete}
              onRetry={onRetry}
            />
          ))}
        </div>
      )}

      {pagination && pagination.total > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          共 {pagination.total} 份分析报告
        </div>
      )}
    </div>
  );
}
