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
 * @version 1.4.0
 * @since 2025-12-29
 */

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  ArrowLeft,
  Share2,
  Download,
  BookOpen,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  RefreshCcw,
  Highlighter,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  XCircle,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useSynthesisDetail } from "@/hooks/synthesis/use-synthesis-detail";
import { useSynthesisHighlights } from "@/hooks/synthesis/use-synthesis-highlights";
import { HighlightableText } from "./highlightable-text";
import { SynthesisExportDialog } from "./synthesis-export-dialog";
import { SynthesisShareDialog } from "./synthesis-share-dialog";
import { SynthesisProgress } from "./synthesis-progress";
import { SourceBookmarksPanel } from "./source-bookmarks-panel";
import { SynthesisQAPanel } from "./synthesis-qa-panel";
import { BlindSpotSupplementDialog } from "./blind-spot-supplement-dialog";
import type {
  ConsensusPoint,
  DivergencePoint,
  BlindSpot,
  SourceReference,
} from "@/lib/synthesis";
import type {
  HighlightColor,
  SynthesisHighlight,
} from "@/lib/synthesis/types/highlight";
import { cn } from "@/lib/utils";

interface SynthesisDetailPageClientProps {
  reportId: string;
}

// ============================================================================
// 高亮回调类型
// ============================================================================

interface HighlightHandlers {
  highlights: SynthesisHighlight[];
  onCreateHighlight: (
    content: string,
    start: number,
    end: number,
    color: HighlightColor,
  ) => Promise<void>;
  onUpdateHighlight: (
    highlightId: string,
    updates: { note?: string; color?: HighlightColor },
  ) => Promise<void>;
  onDeleteHighlight: (highlightId: string) => Promise<void>;
}

// ============================================================================
// 来源 Badge 组件（可点击跳转到原书签）[I3] 增强悬停预览
// ============================================================================

/**
 * 可点击的来源标签
 * 点击后跳转到书签详情页
 * 悬停显示预览卡片
 */
function SourceBadge({
  source,
  maxLength = 20,
}: {
  source: SourceReference;
  maxLength?: number;
}) {
  const displayTitle =
    source.title.length > maxLength
      ? `${source.title.slice(0, maxLength)}...`
      : source.title;

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Link href={`/bookmarks/${source.id}`} className="inline-block">
          <Badge
            variant="outline"
            className="text-xs cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors group"
          >
            {displayTitle}
            <ExternalLink className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Badge>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-80 p-4"
        sideOffset={8}
      >
        <div className="space-y-3">
          {/* 标题 */}
          <div className="flex items-start gap-2">
            <BookOpen className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium leading-tight">{source.title}</p>
          </div>

          {/* 引文（如果有） */}
          {source.quote && (
            <blockquote className="border-l-2 border-primary/30 pl-3 italic text-xs text-muted-foreground">
              &ldquo;{source.quote}&rdquo;
            </blockquote>
          )}

          {/* 底部操作提示 */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              ID: {source.id}
            </span>
            <span className="text-xs text-primary flex items-center gap-1">
              点击查看详情
              <ExternalLink className="h-3 w-3" />
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * 来源列表组件
 */
function SourceList({
  sources,
  maxVisible = 3,
  maxLength = 20,
}: {
  sources: SourceReference[];
  maxVisible?: number;
  maxLength?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleSources = showAll ? sources : sources.slice(0, maxVisible);
  const hiddenCount = sources.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visibleSources.map((source, i) => (
        <SourceBadge
          key={source.id || i}
          source={source}
          maxLength={maxLength}
        />
      ))}
      {!showAll && hiddenCount > 0 && (
        <Badge
          variant="secondary"
          className="text-xs cursor-pointer hover:bg-secondary/80"
          onClick={() => setShowAll(true)}
        >
          +{hiddenCount}
        </Badge>
      )}
      {showAll && sources.length > maxVisible && (
        <Badge
          variant="outline"
          className="text-xs cursor-pointer hover:bg-muted"
          onClick={() => setShowAll(false)}
        >
          收起
        </Badge>
      )}
    </div>
  );
}

/**
 * 概述区块（带折叠功能）
 */
function OverviewSection({
  content,
  handlers,
  defaultOpen = true,
}: {
  content: string;
  handlers: HighlightHandlers;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="flex items-center gap-2 text-lg">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <FileText className="h-5 w-5 text-blue-500" />
              概述
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <HighlightableText
              content={content}
              section="overview"
              highlights={handlers.highlights}
              onCreateHighlight={handlers.onCreateHighlight}
              onUpdateHighlight={handlers.onUpdateHighlight}
              onDeleteHighlight={handlers.onDeleteHighlight}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/**
 * 共识区块（带折叠功能和来源跳转）
 */
function ConsensusSection({
  items,
  handlers,
  defaultOpen = true,
}: {
  items: ConsensusPoint[];
  handlers: HighlightHandlers;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="flex items-center gap-2 text-lg">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              核心共识
              <Badge variant="secondary" className="ml-2">
                {items.length}
              </Badge>
            </CardTitle>
            <CardDescription>多个来源都认同的观点</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {items.map((item, index) => (
              <div
                key={index}
                className="border-l-4 border-green-500 pl-4 py-2 space-y-2"
              >
                <HighlightableText
                  content={item.point}
                  section="consensus"
                  itemIndex={index}
                  highlights={handlers.highlights}
                  onCreateHighlight={handlers.onCreateHighlight}
                  onUpdateHighlight={handlers.onUpdateHighlight}
                  onDeleteHighlight={handlers.onDeleteHighlight}
                  className="font-medium"
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>置信度: {Math.round(item.confidence * 100)}%</span>
                  <span>·</span>
                  <span>{item.sources.length} 个来源</span>
                </div>
                <SourceList sources={item.sources} maxVisible={3} />
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/**
 * 分歧区块（带折叠功能和来源跳转）
 */
function DivergenceSection({
  items,
  handlers,
  defaultOpen = true,
}: {
  items: DivergencePoint[];
  handlers: HighlightHandlers;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (items.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="flex items-center gap-2 text-lg">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              观点分歧
              <Badge variant="secondary" className="ml-2">
                {items.length}
              </Badge>
            </CardTitle>
            <CardDescription>不同来源之间的观点冲突</CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {items.map((item, index) => (
              <div key={index} className="space-y-3">
                <h4 className="font-medium text-sm">{item.topic}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 观点 A */}
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <HighlightableText
                      content={item.point_a}
                      section="divergence"
                      itemIndex={index * 2}
                      highlights={handlers.highlights}
                      onCreateHighlight={handlers.onCreateHighlight}
                      onUpdateHighlight={handlers.onUpdateHighlight}
                      onDeleteHighlight={handlers.onDeleteHighlight}
                      className="mb-2"
                    />
                    <SourceList
                      sources={item.sources_a}
                      maxVisible={2}
                      maxLength={15}
                    />
                  </div>
                  {/* 观点 B */}
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <HighlightableText
                      content={item.point_b}
                      section="divergence"
                      itemIndex={index * 2 + 1}
                      highlights={handlers.highlights}
                      onCreateHighlight={handlers.onCreateHighlight}
                      onUpdateHighlight={handlers.onUpdateHighlight}
                      onDeleteHighlight={handlers.onDeleteHighlight}
                      className="mb-2"
                    />
                    <SourceList
                      sources={item.sources_b}
                      maxVisible={2}
                      maxLength={15}
                    />
                  </div>
                </div>
                {/* AI 分析 */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground italic">
                    {item.analysis}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/**
 * 盲区区块（带折叠功能）[E3] 增强盲区一键补充
 */
function BlindSpotSection({
  items,
  handlers,
  reportId,
  onRegenerate,
  defaultOpen = true,
}: {
  items: BlindSpot[];
  handlers: HighlightHandlers;
  reportId: string;
  onRegenerate?: () => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedBlindSpot, setSelectedBlindSpot] = useState<BlindSpot | null>(
    null,
  );

  if (items.length === 0) return null;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <CardTitle className="flex items-center gap-2 text-lg">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Lightbulb className="h-5 w-5 text-purple-500" />
                知识盲区
                <Badge variant="secondary" className="ml-2">
                  {items.length}
                </Badge>
              </CardTitle>
              <CardDescription>你的收藏尚未覆盖的相关领域</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="border-l-4 border-purple-500 pl-4 py-2 space-y-2"
                >
                  <p className="text-sm font-medium">{item.topic}</p>
                  <HighlightableText
                    content={item.suggestion}
                    section="blindspot"
                    itemIndex={index}
                    highlights={handlers.highlights}
                    onCreateHighlight={handlers.onCreateHighlight}
                    onUpdateHighlight={handlers.onUpdateHighlight}
                    onDeleteHighlight={handlers.onDeleteHighlight}
                    className="text-muted-foreground"
                  />
                  {item.search_keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.search_keywords.map((keyword, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-purple-100 hover:border-purple-300 transition-colors group"
                          onClick={() => setSelectedBlindSpot(item)}
                        >
                          <Search className="h-3 w-3 mr-1 opacity-50 group-hover:opacity-100" />
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {/* 相关书签 */}
                  {item.related_bookmarks &&
                    item.related_bookmarks.length > 0 && (
                      <div className="pt-1">
                        <span className="text-xs text-muted-foreground mr-2">
                          相关书签:
                        </span>
                        <SourceList
                          sources={item.related_bookmarks}
                          maxVisible={2}
                          maxLength={15}
                        />
                      </div>
                    )}
                </div>
              ))}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* [E3] 盲区补充对话框 */}
      {selectedBlindSpot && (
        <BlindSpotSupplementDialog
          open={!!selectedBlindSpot}
          onOpenChange={(open) => !open && setSelectedBlindSpot(null)}
          blindSpot={selectedBlindSpot}
          reportId={reportId}
          onRegenerate={onRegenerate}
        />
      )}
    </>
  );
}

/**
 * 失败/取消状态恢复卡片
 */
function FailedRecoveryCard({
  status,
  errorMessage,
  onRetry,
  isRetrying,
}: {
  status: "failed" | "cancelled";
  errorMessage?: string | null;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const isFailed = status === "failed";

  return (
    <Card
      className={cn(
        "border-2",
        isFailed ? "border-destructive/50" : "border-muted",
      )}
    >
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center space-y-4">
          {isFailed ? (
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          ) : (
            <div className="rounded-full bg-muted p-4">
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              {isFailed ? "生成失败" : "生成已取消"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {isFailed
                ? errorMessage || "综述生成过程中发生错误，请重新尝试。"
                : "综述生成已被取消。您可以重新开始生成。"}
            </p>
          </div>

          <Button onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在重新生成...
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                重新生成
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 生成中状态卡片 [I4] 增强生成体验
 */
function GeneratingCard({
  reportId,
  depthMode,
  sourceCount,
  onComplete,
  onCancel,
}: {
  reportId: string;
  depthMode?: "quick" | "standard" | "academic";
  sourceCount?: number;
  onComplete: () => void;
  onCancel: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>正在生成综述</CardTitle>
        <CardDescription>AI 正在分析您的收藏内容，请稍候...</CardDescription>
      </CardHeader>
      <CardContent>
        <SynthesisProgress
          reportId={reportId}
          depthMode={depthMode}
          sourceCount={sourceCount}
          onComplete={onComplete}
          onCancel={onCancel}
        />
      </CardContent>
    </Card>
  );
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
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCopied, setIsCopied] = useState(false); // [I2] 复制状态

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

  // 高亮处理器
  const highlightHandlers: HighlightHandlers = {
    highlights,
    onCreateHighlight: handleCreateHighlight,
    onUpdateHighlight: handleUpdateHighlight,
    onDeleteHighlight: handleDeleteHighlight,
  };

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
      // 刷新数据
      refetch();
    } catch (error) {
      logger.error({ error, reportId }, "Retry synthesis error");
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

  // [I2] 复制 Markdown
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
    } catch (error) {
      logger.error({ error }, "Copy markdown error");
      toast.error("复制失败，请重试");
    }
  }, [report?.fullMarkdown]);

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-6 space-y-6">
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
      <div className="container max-w-4xl py-6">
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
    <div className="container max-w-4xl py-6 space-y-6">
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
          {/* [I2] 复制 Markdown 按钮 */}
          {report.status === "completed" && report.fullMarkdown && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent>复制完整 Markdown 内容</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportDialog(true)}
          >
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
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
          {/* 四维内容 */}
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

          {/* [E4] 来源书签面板 */}
          <SourceBookmarksPanel
            reportId={reportId}
            sourceType={report.sourceType}
            sourceId={report.sourceId}
            sourceBookmarkIds={report.sourceBookmarkIds}
            sourceCount={report.sourceCount}
            defaultOpen={false}
          />

          {/* [S3] 实时问答面板 */}
          <SynthesisQAPanel
            reportId={reportId}
            reportTitle={report.title}
            overview={report.overview}
          />
        </>
      )}

      {/* 导出对话框 */}
      <SynthesisExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        report={report}
      />

      {/* 分享对话框 */}
      <SynthesisShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        report={report}
      />
    </div>
  );
}
