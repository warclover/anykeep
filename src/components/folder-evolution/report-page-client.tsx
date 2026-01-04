"use client";

/**
 * V4.2 Report Page Client
 * AI 进化报告页面客户端组件
 */

import { useEvolutionReports } from "@/hooks/domain/ai";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Calendar,
  RefreshCw,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import Link from "next/link";
import { ReportChangesList } from "./report-changes-list";
import { ReportSuggestionsList } from "./report-suggestions-list";
import type { UISuggestion } from "@/types/domain";
import { toUISuggestionList } from "@/types/domain";

// ============================================
// Helper Functions
// ============================================

function getHealthBadge(score: number | null) {
  if (score === null) return null;

  if (score >= 80) {
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        健康
      </Badge>
    );
  }
  if (score >= 60) {
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <AlertCircle className="w-3 h-3 mr-1" />
        一般
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <AlertCircle className="w-3 h-3 mr-1" />
      需改善
    </Badge>
  );
}

function formatMonth(month: string): string {
  try {
    return format(new Date(month + "-01"), "yyyy年M月", { locale: zhCN });
  } catch {
    return month;
  }
}

// ============================================
// Component Implementation
// ============================================

export function ReportPageClient() {
  const {
    reports,
    currentReport,
    hasReports,
    isLoading,
    isGenerating,
    error,
    fetchReports,
    generateReport,
    selectReport,
  } = useEvolutionReports();

  // Handle suggestion click (navigate to relevant page)
  const handleSuggestionClick = (_suggestion: UISuggestion) => {
    // In a full implementation, this would navigate to the appropriate action
    // Currently no-op: navigation logic to be implemented
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container max-w-4xl py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchReports}>重试</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-500" />
              AI 进化报告
            </h1>
            <p className="text-sm text-muted-foreground">
              查看 AI 文件夹管理的月度统计
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Month selector */}
          {hasReports && (
            <Select
              value={currentReport?.reportMonth || ""}
              onValueChange={(month) => {
                const report = reports.find((r) => r.reportMonth === month);
                if (report) selectReport(report);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="选择月份" />
              </SelectTrigger>
              <SelectContent>
                {reports.map((report) => (
                  <SelectItem key={report.id} value={report.reportMonth}>
                    {formatMonth(report.reportMonth)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Generate report button */}
          <Button
            onClick={() => generateReport(undefined, false)}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                生成报告
              </>
            )}
          </Button>
        </div>
      </div>

      {/* No reports state */}
      {!hasReports && !currentReport && (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无报告</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              AI 进化报告会展示你的文件夹管理统计和优化建议。
              点击「生成报告」创建本月报告。
            </p>
            <Button
              size="lg"
              onClick={() => generateReport()}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  生成本月报告
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Report content */}
      {currentReport && (
        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {formatMonth(currentReport.reportMonth)} 报告
                    {getHealthBadge(currentReport.healthScore)}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Calendar className="w-3 h-3" />
                    生成于{" "}
                    {format(
                      new Date(currentReport.generatedAt),
                      "M月d日 HH:mm",
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Health Score */}
              {currentReport.healthScore !== null && (
                <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-muted-foreground">
                      整体健康度
                    </span>
                    {getHealthBadge(currentReport.healthScore)}
                  </div>
                  <div className="flex items-end gap-4">
                    <span className="text-5xl font-bold text-indigo-600 dark:text-indigo-400">
                      {currentReport.healthScore}
                    </span>
                    <span className="text-muted-foreground mb-2">/100</span>
                  </div>
                  <Progress
                    value={currentReport.healthScore}
                    className="h-3 mt-4"
                  />
                </div>
              )}

              {/* Classification Stats */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">分类统计</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground">本月分类</p>
                    <p className="text-2xl font-bold">
                      {currentReport.totalClassified}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground">自动分类</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {currentReport.autoClassified}
                    </p>
                    {currentReport.totalClassified > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {Math.round(
                          (currentReport.autoClassified /
                            currentReport.totalClassified) *
                            100,
                        )}
                        %
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg border bg-card">
                    <p className="text-xs text-muted-foreground">手动调整</p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {currentReport.manualAdjusted}
                    </p>
                    {currentReport.totalClassified > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {Math.round(
                          (currentReport.manualAdjusted /
                            currentReport.totalClassified) *
                            100,
                        )}
                        %
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Quality Metrics */}
              {(currentReport.avgConfidence !== null ||
                currentReport.acceptanceRate !== null) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">质量指标</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {currentReport.avgConfidence !== null && (
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-xs text-muted-foreground">
                          平均置信度
                        </p>
                        <p className="text-2xl font-bold">
                          {currentReport.avgConfidence}%
                        </p>
                      </div>
                    )}
                    {currentReport.acceptanceRate !== null && (
                      <div className="p-4 rounded-lg border bg-card">
                        <p className="text-xs text-muted-foreground">采纳率</p>
                        <p className="text-2xl font-bold">
                          {Math.round(currentReport.acceptanceRate * 100)}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Folder Changes */}
              <ReportChangesList
                changes={{
                  foldersCreated: currentReport.foldersCreated,
                  foldersSplit: currentReport.foldersSplit,
                  foldersMerged: currentReport.foldersMerged,
                  foldersRenamed: currentReport.foldersRenamed,
                }}
              />

              <Separator />

              {/* Suggestions */}
              <ReportSuggestionsList
                suggestions={toUISuggestionList(currentReport.suggestions)}
                onSuggestionClick={handleSuggestionClick}
              />
            </CardContent>
          </Card>

          {/* Historical Reports */}
          {reports.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">历史报告</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {reports.map((report) => (
                    <Button
                      key={report.id}
                      variant={
                        report.id === currentReport.id ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => selectReport(report)}
                    >
                      {formatMonth(report.reportMonth)}
                      {report.healthScore !== null && (
                        <span
                          className={cn(
                            "ml-2 text-xs",
                            report.healthScore >= 80
                              ? "text-green-500"
                              : report.healthScore >= 60
                                ? "text-amber-500"
                                : "text-red-500",
                          )}
                        >
                          {report.healthScore}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportPageClient;
