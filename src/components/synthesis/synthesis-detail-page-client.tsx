/**
 * 综述详情页客户端组件
 *
 * 功能：
 * - 展示完整四维结构化输出（概述、共识、分歧、盲区）
 * - 支持标注功能（高亮、备注）
 * - 支持导出和分享
 * - 支持来源跳转（点击来源 Badge 跳转到原书签）
 * - 支持折叠/展开四维区块
 * - 支持失败/取消状态的恢复重试
 *
 * 性能优化 v2.0：
 * - TanStack Query 缓存数据
 * - 组件拆分 + React.memo
 * - 动态导入 ReportEditor
 *
 * @version 2.0.0
 * @since 2025-12-29
 */

"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useState, useMemo } from "react";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import {
  ArrowLeft,
  Share2,
  Download,
  BookOpen,
  FileText,
  Clock,
  RefreshCcw,
  Highlighter,
  Copy,
  Check,
  Scissors,
  Loader2,
  FileCode,
  FileJson,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSynthesisDetail } from "@/hooks/synthesis/use-synthesis-detail";
import { useSynthesisHighlights } from "@/hooks/synthesis/use-synthesis-highlights";
import { SynthesisShareDialog } from "./synthesis-share-dialog";
import { SourceBookmarksPanel } from "./source-bookmarks-panel";
import { SynthesisQAPanel } from "./synthesis-qa-panel";
import { SaveToNoteButton } from "@/components/shared/save-to-note";
import {
  condenseContentStream,
  CONDENSE_PRESETS,
  type CondensePreset,
} from "@/lib/knowledge-studio/refinement";

// 拆分后的组件
import {
  OverviewSection,
  ConsensusSection,
  DivergenceSection,
  BlindSpotSection,
  FailedRecoveryCard,
  GeneratingCard,
} from "./sections";
import type { HighlightHandlers } from "./sections/types";

import type { HighlightColor } from "@/lib/synthesis/types/highlight";
import type { SynthesisReport as KSSynthesisReport } from "@/lib/knowledge-studio/client";
import {
  downloadKSReport,
  type KSExportFormat,
} from "@/lib/knowledge-studio/export";

// 动态导入 ReportEditor（较大组件）
const ReportEditor = dynamic(
  () =>
    import("@/components/knowledge-studio/report-editor").then(
      (mod) => mod.ReportEditor,
    ),
  {
    loading: () => (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    ),
    ssr: false,
  },
);

interface SynthesisDetailPageClientProps {
  reportId: string;
}

/**
 * 综述详情页客户端组件
 */
export function SynthesisDetailPageClient({
  reportId,
}: SynthesisDetailPageClientProps) {
  const router = useRouter();
  const {
    data: report,
    isLoading,
    error,
    refetch,
  } = useSynthesisDetail(reportId);

  // 对话框状态
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // 标注功能
  const { highlights, createHighlight, updateHighlight, deleteHighlight } =
    useSynthesisHighlights({ reportId });

  // 创建高亮回调
  const handleCreateHighlight = useCallback(
    async (
      content: string,
      start: number,
      end: number,
      color: HighlightColor,
    ) => {
      await createHighlight(
        content,
        { start, end, section: "overview" },
        { color },
      );
    },
    [createHighlight],
  );

  // 更新高亮回调
  const handleUpdateHighlight = useCallback(
    async (
      highlightId: string,
      updates: { note?: string; color?: HighlightColor },
    ) => {
      await updateHighlight(highlightId, updates);
    },
    [updateHighlight],
  );

  // 删除高亮回调
  const handleDeleteHighlight = useCallback(
    async (highlightId: string) => {
      await deleteHighlight(highlightId);
    },
    [deleteHighlight],
  );

  // 高亮处理器 - 使用 useMemo 避免重复创建
  const highlightHandlers: HighlightHandlers = useMemo(
    () => ({
      highlights,
      onCreateHighlight: handleCreateHighlight,
      onUpdateHighlight: handleUpdateHighlight,
      onDeleteHighlight: handleDeleteHighlight,
    }),
    [
      highlights,
      handleCreateHighlight,
      handleUpdateHighlight,
      handleDeleteHighlight,
    ],
  );

  // 处理重新生成
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      const response = await fetch(`/api/synthesis/${reportId}/regenerate`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("重新生成请求失败");
      }

      toast.success("已开始重新生成");
      refetch();
    } catch (err) {
      clientLogger.error({ error: err, reportId }, "Retry synthesis error");
      toast.error("重新生成失败，请重试");
    } finally {
      setIsRetrying(false);
    }
  }, [reportId, refetch]);

  // 生成完成后刷新
  const handleGenerationComplete = useCallback(() => {
    refetch();
  }, [refetch]);

  // 取消后刷新
  const handleGenerationCancel = useCallback(() => {
    refetch();
  }, [refetch]);

  // 复制 Markdown
  const handleCopyMarkdown = useCallback(async () => {
    if (!report?.fullMarkdown) {
      toast.error("暂无可复制的内容");
      return;
    }

    try {
      await navigator.clipboard.writeText(report.fullMarkdown);
      setIsCopied(true);
      toast.success("已复制到剪贴板");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      clientLogger.error({ error: err }, "Copy markdown error");
      toast.error("复制失败，请重试");
    }
  }, [report?.fullMarkdown]);

  // Phase 3.2: 精简状态
  const [condenseDialogOpen, setCondenseDialogOpen] = useState(false);
  const [isCondensing, setIsCondensing] = useState(false);
  const [condenseProgress, setCondenseProgress] = useState(0);
  const [condensedPreview, setCondensedPreview] = useState<string>("");

  // 判断是否为知识工坊报告
  const isKnowledgeStudioReport = useMemo(() => {
    if (!report) return false;
    return (
      report.consensusCount === 0 &&
      report.divergenceCount === 0 &&
      report.blindSpotCount === 0 &&
      report.blueprintType &&
      (report.overview || report.fullMarkdown)
    );
  }, [report]);

  // Phase 3.2: 字数统计
  const wordCount = useMemo(() => {
    if (!report) return 0;
    const content = report.fullMarkdown || report.overview || "";
    // 简单的中英文字数统计
    return content.replace(/\s/g, "").length;
  }, [report]);

  // 转换为 Knowledge Studio 报告类型
  const ksReport = useMemo((): KSSynthesisReport | null => {
    if (!report || !isKnowledgeStudioReport) return null;

    return {
      id: report.id,
      userId: report.userId,
      blueprintType: report.blueprintType as KSSynthesisReport["blueprintType"],
      title: report.title,
      content: report.overview || report.fullMarkdown || "",
      citations: (report.citations || []).map((c) => ({
        bookmarkId: c.bookmarkId,
        title: c.title,
        url: c.url,
        excerpt: c.excerpt || "",
        position: c.position || 0,
      })),
      generationMetadata: {
        model: (report.generationMetadata?.model as string) || "",
        tokens: {
          input: (report.generationMetadata?.tokens_used as number) || 0,
          output: 0,
          total: (report.generationMetadata?.tokens_used as number) || 0,
        },
        durationMs: (report.generationMetadata?.duration_ms as number) || 0,
        stagesTiming: {
          parsing: 0,
          outline: 0,
          content: 0,
          citations: 0,
          finalizing: 0,
        },
      },
      version: report.version || 1,
      createdAt: new Date(report.createdAt),
      updatedAt: new Date(report.updatedAt),
    };
  }, [report, isKnowledgeStudioReport]);

  // 处理报告更新
  const handleReportUpdate = useCallback(
    async (newContent: string) => {
      if (!report) return;
      try {
        const response = await fetch(
          `/api/knowledge-studio/reports/${report.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: newContent }),
          },
        );

        if (!response.ok) {
          throw new Error("更新失败");
        }

        toast.success("报告已更新");
        refetch();
      } catch (err) {
        clientLogger.error(
          { error: err, reportId: report.id },
          "Failed to update report",
        );
        toast.error("更新失败，请重试");
      }
    },
    [report, refetch],
  );

  // 处理导出
  const handleExport = useCallback(
    (format: KSExportFormat) => {
      if (!ksReport) return;
      try {
        downloadKSReport(ksReport, format);
        toast.success(`已导出为 ${format.toUpperCase()} 格式`);
      } catch (err) {
        clientLogger.error(
          { error: err, format, reportId: ksReport.id },
          "Failed to export report",
        );
        toast.error("导出失败，请重试");
      }
    },
    [ksReport],
  );

  // Phase 3.2: 处理精简
  const handleCondense = useCallback(
    async (preset: CondensePreset) => {
      const targetWords = CONDENSE_PRESETS[preset].targetWords;
      const content = report?.fullMarkdown || report?.overview || "";

      if (!content) {
        toast.error("暂无可精简的内容");
        return;
      }

      // 如果已经低于目标字数，无需精简
      if (wordCount <= targetWords * 1.1) {
        toast.info("当前内容已低于目标字数，无需精简");
        return;
      }

      setIsCondensing(true);
      setCondenseProgress(0);
      setCondensedPreview("");

      await condenseContentStream(
        {
          content,
          targetWords,
          contentType: "article",
        },
        {
          onContent: (chunk) => {
            setCondensedPreview((prev) => prev + chunk);
          },
          onProgress: (percent) => {
            setCondenseProgress(percent);
          },
          onComplete: (result) => {
            setIsCondensing(false);
            handleReportUpdate(result.condensedContent);
            setCondenseDialogOpen(false);
            toast.success(
              `已精简至 ${result.finalWords.toLocaleString()} 字（压缩 ${Math.round((1 - result.compressionRatio) * 100)}%）`,
            );
          },
          onError: (error) => {
            setIsCondensing(false);
            toast.error(`精简失败: ${error.message}`);
          },
        },
      );
    },
    [report, wordCount, handleReportUpdate],
  );

  if (isLoading) {
    return (
      <div className="container max-w-7xl py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="container max-w-7xl py-6">
        <div className="text-center py-12">
          <p className="text-destructive mb-4">加载失败，请重试</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-6 space-y-6 h-full overflow-auto">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold line-clamp-1">{report.title}</h1>
        </div>
        <div className="flex gap-2">
          {/* 标注数量显示 */}
          {highlights.length > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Highlighter className="h-3 w-3" />
              {highlights.length}
            </Badge>
          )}
          {/* 复制 Markdown 按钮 */}
          {report.status === "completed" &&
            (report.fullMarkdown || report.overview) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyMarkdown}
                disabled={isCopied}
              >
                {isCopied ? (
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {isCopied ? "已复制" : "复制"}
              </Button>
            )}
          {/* 精简按钮 */}
          {report.status === "completed" &&
            (report.fullMarkdown || report.overview) && (
              <Dialog
                open={condenseDialogOpen}
                onOpenChange={setCondenseDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Scissors className="mr-2 h-4 w-4" />
                    精简
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>一键精简内容</DialogTitle>
                    <DialogDescription>
                      当前字数：{wordCount.toLocaleString()}{" "}
                      字，选择目标字数进行精简
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-4">
                    {isCondensing ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">正在精简...</span>
                        </div>
                        <Progress value={condenseProgress} className="h-2" />
                        {condensedPreview && (
                          <div className="max-h-[200px] overflow-y-auto rounded border p-3 text-sm">
                            <pre className="whitespace-pre-wrap">
                              {condensedPreview.slice(0, 500)}...
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {(
                          Object.keys(CONDENSE_PRESETS) as CondensePreset[]
                        ).map((preset) => {
                          const config = CONDENSE_PRESETS[preset];
                          const isDisabled =
                            wordCount <= config.targetWords * 1.1;
                          return (
                            <Button
                              key={preset}
                              variant="outline"
                              className="justify-start h-auto py-3"
                              disabled={isDisabled}
                              onClick={() => handleCondense(preset)}
                            >
                              <div className="flex flex-col items-start">
                                <span className="font-medium">
                                  {config.label}（约{" "}
                                  {config.targetWords.toLocaleString()} 字）
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {config.description}
                                  {isDisabled && " · 已低于目标字数"}
                                </span>
                              </div>
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          {/* 保存到笔记按钮 */}
          {report.status === "completed" &&
            (report.fullMarkdown || report.overview) && (
              <SaveToNoteButton
                content={report.fullMarkdown || report.overview || ""}
                sourceType="synthesis"
                sourceId={reportId}
                suggestedTitle={report.title}
                className="border border-input bg-background hover:bg-accent hover:text-accent-foreground"
              />
            )}
          {/* 导出下拉菜单 */}
          {report.status === "completed" && ksReport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("markdown")}>
                  <FileText className="mr-2 h-4 w-4" />
                  Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("html")}>
                  <FileCode className="mr-2 h-4 w-4" />
                  HTML (.html)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}>
                  <FileJson className="mr-2 h-4 w-4" />
                  JSON (.json)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* 分享按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShareDialog(true)}
          >
            <Share2 className="mr-2 h-4 w-4" />
            分享
          </Button>
        </div>
      </div>

      {/* 元信息 */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
        <Badge variant="outline">
          {report.depthMode === "quick"
            ? "⚡ 快读"
            : report.depthMode === "standard"
              ? "📖 标准"
              : "🎓 学术"}
        </Badge>
        <Badge
          variant={
            report.status === "completed"
              ? "secondary"
              : report.status === "generating" || report.status === "pending"
                ? "default"
                : report.status === "failed"
                  ? "destructive"
                  : "outline"
          }
        >
          {report.status === "completed"
            ? "已完成"
            : report.status === "generating"
              ? "生成中"
              : report.status === "pending"
                ? "等待中"
                : report.status === "failed"
                  ? "失败"
                  : report.status === "cancelled"
                    ? "已取消"
                    : report.status}
        </Badge>
        <span className="flex items-center gap-1">
          <BookOpen className="h-4 w-4" />
          {report.sourceCount} 个来源
        </span>
        {report.wordCount > 0 && (
          <span className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            {report.wordCount} 字
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {new Date(report.createdAt).toLocaleString()}
        </span>
      </div>

      {/* 根据状态显示不同内容 */}
      {report.status === "pending" || report.status === "generating" ? (
        <GeneratingCard
          reportId={reportId}
          depthMode={report.depthMode}
          sourceCount={report.sourceCount}
          onComplete={handleGenerationComplete}
          onCancel={handleGenerationCancel}
        />
      ) : report.status === "failed" || report.status === "cancelled" ? (
        <FailedRecoveryCard
          status={report.status}
          errorMessage={report.errorMessage}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      ) : (
        <>
          {/* 知识工坊报告 vs 主题合成器报告 */}
          {isKnowledgeStudioReport && ksReport ? (
            <div className="space-y-6">
              <ReportEditor report={ksReport} onUpdate={handleReportUpdate} />
            </div>
          ) : (
            /* 主题合成器报告：显示四维内容 */
            <div className="space-y-6">
              {report.overview && (
                <OverviewSection
                  content={report.overview}
                  handlers={highlightHandlers}
                />
              )}
              <ConsensusSection
                items={report.consensus}
                handlers={highlightHandlers}
              />
              <DivergenceSection
                items={report.divergence}
                handlers={highlightHandlers}
              />
              <BlindSpotSection
                items={report.blindSpots}
                handlers={highlightHandlers}
                reportId={reportId}
                onRegenerate={handleRetry}
              />
            </div>
          )}

          {/* 来源书签面板 */}
          <SourceBookmarksPanel
            reportId={reportId}
            sourceType={report.sourceType}
            sourceId={report.sourceId}
            sourceBookmarkIds={report.sourceBookmarkIds}
            sourceCount={report.sourceCount}
            defaultOpen={false}
          />

          {/* 实时问答面板 */}
          <SynthesisQAPanel
            reportId={reportId}
            reportTitle={report.title}
            overview={report.overview}
          />
        </>
      )}

      {/* 分享对话框 */}
      <SynthesisShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        report={report}
      />
    </div>
  );
}
