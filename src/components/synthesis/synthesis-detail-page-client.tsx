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
 *
 * @version 2.0.0
 * @since 2025-12-29
 */

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useMemo } from "react";
import { toast } from "sonner";
import { clientLogger } from "@/lib/client-logger";
import {
  ArrowLeft,
  Share2,
  BookOpen,
  FileText,
  Clock,
  RefreshCcw,
  Highlighter,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSynthesisDetail } from "@/hooks/synthesis/use-synthesis-detail";
import { useSynthesisHighlights } from "@/hooks/synthesis/use-synthesis-highlights";
import { SynthesisShareDialog } from "./synthesis-share-dialog";
import { SourceBookmarksPanel } from "./source-bookmarks-panel";
import { SynthesisQAPanel } from "./synthesis-qa-panel";
import { useSynthesisCondense } from "./use-synthesis-condense";
import { CondenseDialog } from "./synthesis-condense-dialog";
import { SaveToNoteButton } from "@/components/shared/save-to-note";

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

  // Phase 3.2: 字数统计
  const wordCount = useMemo(() => {
    if (!report) return 0;
    const content = report.fullMarkdown || report.overview || "";
    // 简单的中英文字数统计
    return content.replace(/\s/g, "").length;
  }, [report]);

  // 处理报告内容更新（精简功能使用）
  const handleReportUpdate = useCallback(
    async (newContent: string) => {
      if (!report) return;
      try {
        const response = await fetch(`/api/synthesis/${report.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newContent }),
        });

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

  // Phase 3.2: 精简功能
  const {
    condenseDialogOpen,
    setCondenseDialogOpen,
    isCondensing,
    condenseProgress,
    condensedPreview,
    handleCondense,
  } = useSynthesisCondense({
    content: report?.fullMarkdown || report?.overview || "",
    wordCount,
    onReportUpdate: handleReportUpdate,
  });

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
              <CondenseDialog
                open={condenseDialogOpen}
                onOpenChange={setCondenseDialogOpen}
                wordCount={wordCount}
                isCondensing={isCondensing}
                condenseProgress={condenseProgress}
                condensedPreview={condensedPreview}
                onCondense={handleCondense}
              />
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
          {/* 主题合成器报告：显示四维内容 */}
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
