/**
 * 快速对比卡片
 *
 * 当相关书签中存在 2+ 篇高相似度（>0.7）内容时自动出现。
 * 支持一键创建对比报告并在页内展开结果。
 *
 * @version 1.0.0
 * @since 2026-03-17
 */

"use client";

import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Zap,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import { API_SYNTHESIS } from "@/lib/constants/api-paths";
import { knowledgeLinkKeys } from "@/hooks/queries/keys";
import { useSynthesisStream } from "@/hooks/synthesis/use-synthesis-stream";
import type { RelatedBookmark } from "@/lib/knowledge-link";
import type { DivergencePoint } from "@/lib/synthesis";
import { DETAIL_INSIGHTS_TEXT } from "./constants";

const TEXT = DETAIL_INSIGHTS_TEXT.quickCompare;

/** 高相似度阈值 */
const HIGH_SIMILARITY_THRESHOLD = 0.7;
/** 需要的最少高相似度项数 */
const MIN_HIGH_SIMILARITY_COUNT = 2;

// ============================================================================
// Lazy-loaded Synthesis Sections（仅在对比结果展示时加载）
// ============================================================================

const LazyOverviewSection = lazy(() =>
  import(
    /* webpackChunkName: "synthesis-sections" */
    "@/components/synthesis/sections/overview-section"
  ).then((m) => ({ default: m.OverviewSection })),
);

const LazyDivergenceSection = lazy(() =>
  import(
    /* webpackChunkName: "synthesis-sections" */
    "@/components/synthesis/sections/divergence-section"
  ).then((m) => ({ default: m.DivergenceSection })),
);

// ============================================================================
// No-op Highlight Handlers（对比卡片内不需要标注功能）
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-empty-function
const NOOP_ASYNC = async () => {};

const NOOP_HIGHLIGHT_HANDLERS = {
  highlights: [],
  onCreateHighlight: NOOP_ASYNC,
  onUpdateHighlight: NOOP_ASYNC,
  onDeleteHighlight: NOOP_ASYNC,
};

// ============================================================================
// API types
// ============================================================================

interface RelatedApiResponse {
  success: boolean;
  data?: {
    related: RelatedBookmark[];
    totalCount: number;
  };
  error?: string;
}

interface SynthesisCreateResponse {
  success: boolean;
  data?: { id: string; title: string; status: string };
  error?: { message: string };
}

// ============================================================================
// Fetcher（复用 RelatedBookmarksV2 的请求逻辑）
// ============================================================================

const fetchRelated = async (
  bookmarkId: number,
): Promise<RelatedApiResponse> => {
  const params = new URLSearchParams({
    limit: "5",
    minStrength: "0.5",
  });

  const res = await fetch(
    `/api/knowledge-link/related/${bookmarkId}?${params.toString()}`,
    { credentials: "include" },
  );
  const data: RelatedApiResponse = await res.json();
  if (!res.ok) throw new Error(data.error || "获取相关书签失败");
  return data;
};

// ============================================================================
// Sub-components
// ============================================================================

function SimilarityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium",
        pct >= 80
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      )}
    >
      {TEXT.similarity} {pct}%
    </span>
  );
}

function CompareResultSkeleton() {
  return (
    <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface QuickCompareCardProps {
  bookmarkId: number;
}

export function QuickCompareCard({ bookmarkId }: QuickCompareCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [compareState, setCompareState] = useState<
    "idle" | "creating" | "generating" | "done" | "error"
  >("idle");
  const [compareError, setCompareError] = useState<string | null>(null);

  const synthesisStream = useSynthesisStream();

  // 跟踪流式状态 → 更新 compareState
  const streamStatus = synthesisStream.state.status;
  useEffect(() => {
    if (compareState !== "generating") return;
    if (streamStatus === "completed") {
      setCompareState("done");
    } else if (streamStatus === "error") {
      setCompareState("error");
      setCompareError(synthesisStream.state.error || "生成失败");
    }
  }, [compareState, streamStatus, synthesisStream.state.error]);

  // 查询相关书签（与 RelatedBookmarksV2 共享缓存 queryKey）
  const queryParams = useMemo(() => ({ limit: 5, minStrength: 0.5 }), []);
  const { data, isLoading } = useQuery({
    queryKey: knowledgeLinkKeys.related(bookmarkId, queryParams),
    queryFn: () => fetchRelated(bookmarkId),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });

  // 筛选高相似度项
  const highSimilarityItems = useMemo(() => {
    if (!data?.success || !data.data?.related) return [];
    return data.data.related
      .filter((item) => item.link.strength > HIGH_SIMILARITY_THRESHOLD)
      .slice(0, 2);
  }, [data]);

  // 触发条件：至少 2 篇高相似度
  if (isLoading || highSimilarityItems.length < MIN_HIGH_SIMILARITY_COUNT) {
    return null;
  }

  const handleCompare = async () => {
    try {
      setCompareState("creating");
      setCompareError(null);

      // Step 1: 创建综述报告
      const allBookmarkIds = [
        bookmarkId,
        ...highSimilarityItems.map((item) => item.bookmark.id),
      ];

      const result = await fetchWithAuth(API_SYNTHESIS.list, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "selection",
          bookmarkIds: allBookmarkIds,
          depthMode: "quick",
          outputStyle: "comparison",
        }),
      });

      const json = (await result.json()) as SynthesisCreateResponse;
      if (!json.success || !json.data?.id) {
        throw new Error(json.error?.message || "创建对比报告失败");
      }

      // Step 2: 启动流式生成
      setCompareState("generating");
      synthesisStream.startGeneration(json.data.id);
    } catch (err) {
      setCompareState("error");
      setCompareError(err instanceof Error ? err.message : "对比失败");
    }
  };

  const isComparing =
    compareState === "creating" || compareState === "generating";
  const hasResults =
    compareState === "done" ||
    (compareState === "generating" && synthesisStream.state.overview);

  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardContent className="p-0">
        {/* 折叠态 */}
        <button
          type="button"
          className="flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-lg"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <div className="flex items-center gap-2 text-sm">
            <Zap className="size-4 text-amber-500 flex-shrink-0" />
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {TEXT.sectionTitle}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              · {TEXT.subtitle}
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="size-4 text-slate-400 flex-shrink-0 ml-2" />
          ) : (
            <ChevronDown className="size-4 text-slate-400 flex-shrink-0 ml-2" />
          )}
        </button>

        {/* 展开态 */}
        {isExpanded && (
          <div className="px-3 pb-3 space-y-3">
            {/* 相似书签卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {highSimilarityItems.map((item) => (
                <div
                  key={item.bookmark.id}
                  className="flex items-start gap-2 p-2 rounded-md border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
                >
                  <FileText className="size-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                      {item.bookmark.title}
                    </p>
                    <SimilarityBadge score={item.link.strength} />
                  </div>
                </div>
              ))}
            </div>

            {/* 操作按钮 */}
            {compareState === "idle" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCompare}
                className="w-full"
              >
                <Zap className="size-3.5 mr-1.5" />
                {TEXT.compareButton}
              </Button>
            )}

            {/* 生成中 */}
            {isComparing && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 py-2">
                <Loader2 className="size-4 animate-spin" />
                <span>
                  {synthesisStream.state.progress?.message || TEXT.generating}
                </span>
              </div>
            )}

            {/* 错误 */}
            {compareState === "error" && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 py-2">
                <AlertCircle className="size-4" />
                <span>{compareError || TEXT.compareError}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCompare}
                  className="ml-auto h-7 text-xs"
                >
                  重试
                </Button>
              </div>
            )}

            {/* 对比结果（流式渲染） */}
            {hasResults && (
              <Suspense fallback={<CompareResultSkeleton />}>
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                  {synthesisStream.state.overview && (
                    <LazyOverviewSection
                      content={synthesisStream.state.overview}
                      handlers={NOOP_HIGHLIGHT_HANDLERS}
                      defaultOpen={true}
                    />
                  )}
                  {synthesisStream.state.divergence.length > 0 && (
                    <LazyDivergenceSection
                      items={
                        synthesisStream.state.divergence as DivergencePoint[]
                      }
                      handlers={NOOP_HIGHLIGHT_HANDLERS}
                      defaultOpen={true}
                    />
                  )}
                </div>
              </Suspense>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
