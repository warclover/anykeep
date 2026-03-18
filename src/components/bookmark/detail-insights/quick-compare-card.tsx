/**
 * 快速对比卡片
 *
 * 当相关书签中存在 2+ 篇高相似度（>0.7）内容时自动出现。
 * 支持一键创建对比报告、流式展示；已完成的同组三篇对比会按需加载并展示。
 *
 * @version 1.1.0
 * @since 2026-03-17
 */

"use client";

import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Zap,
  FileText,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetchWithAuth, authFetcher } from "@/lib/api/fetch-with-auth";
import { API_SYNTHESIS } from "@/lib/constants/api-paths";
import { knowledgeLinkKeys, detailInsightsKeys } from "@/hooks/queries/keys";
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
// Lazy-loaded Synthesis Sections
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

interface MatchSelectionResponse {
  success: boolean;
  data: {
    id: string;
    title: string;
    overview: string;
    divergence: unknown;
    consensus: unknown;
    completedAt: string | null;
  } | null;
  error?: string;
}

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

interface QuickCompareCardProps {
  bookmarkId: number;
}

export function QuickCompareCard({ bookmarkId }: QuickCompareCardProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [compareState, setCompareState] = useState<
    "idle" | "creating" | "generating" | "done" | "error"
  >("idle");
  const [compareError, setCompareError] = useState<string | null>(null);

  const synthesisStream = useSynthesisStream();

  const queryParams = useMemo(() => ({ limit: 5, minStrength: 0.5 }), []);
  const { data, isLoading } = useQuery({
    queryKey: knowledgeLinkKeys.related(bookmarkId, queryParams),
    queryFn: () => fetchRelated(bookmarkId),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });

  const highSimilarityItems = useMemo(() => {
    if (!data?.success || !data.data?.related) return [];
    return data.data.related
      .filter((item) => item.link.strength > HIGH_SIMILARITY_THRESHOLD)
      .slice(0, 2);
  }, [data]);

  const threeIdsSorted = useMemo(() => {
    if (highSimilarityItems.length < MIN_HIGH_SIMILARITY_COUNT) return [];
    const raw = [
      bookmarkId,
      highSimilarityItems[0]!.bookmark.id,
      highSimilarityItems[1]!.bookmark.id,
    ];
    const uniq = [...new Set(raw.map((n) => Math.floor(Number(n))))].filter(
      (n) => n > 0,
    );
    if (uniq.length !== 3) return [];
    return uniq.sort((a, b) => a - b);
  }, [bookmarkId, highSimilarityItems]);

  const canonicalKey = threeIdsSorted.join(",");

  const { data: matchRes, isLoading: matchLoading } = useQuery({
    queryKey: detailInsightsKeys.quickCompareMatch(canonicalKey),
    queryFn: () =>
      authFetcher<MatchSelectionResponse>(
        API_SYNTHESIS.matchSelection(threeIdsSorted),
      ),
    enabled:
      isExpanded &&
      threeIdsSorted.length === 3 &&
      highSimilarityItems.length >= MIN_HIGH_SIMILARITY_COUNT,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const savedReport =
    matchRes?.success && matchRes.data?.overview?.trim() ? matchRes.data : null;

  const streamStatus = synthesisStream.state.status;
  useEffect(() => {
    if (compareState !== "generating") return;
    if (streamStatus === "completed") {
      setCompareState("done");
      void queryClient.invalidateQueries({
        queryKey: detailInsightsKeys.quickCompareMatch(canonicalKey),
      });
    } else if (streamStatus === "error") {
      setCompareState("error");
      setCompareError(synthesisStream.state.error || "生成失败");
    }
  }, [
    compareState,
    streamStatus,
    synthesisStream.state.error,
    queryClient,
    canonicalKey,
  ]);

  const streamOverview = synthesisStream.state.overview;
  const streamDivergence = synthesisStream.state.divergence;

  const preferStream =
    (compareState === "generating" || compareState === "done") &&
    !!streamOverview?.trim();

  const displayOverview = preferStream
    ? streamOverview
    : (savedReport?.overview ?? null);
  const displayDivergence: DivergencePoint[] = preferStream
    ? (streamDivergence as DivergencePoint[])
    : ((savedReport?.divergence as DivergencePoint[]) || []).filter(Boolean);

  const hasResults =
    !!displayOverview?.trim() ||
    (preferStream && streamDivergence.length > 0) ||
    (!preferStream && displayDivergence.length > 0);

  const isComparing =
    compareState === "creating" || compareState === "generating";

  const showPrimaryActions =
    (compareState === "idle" || compareState === "done") && !isComparing;

  const handleCompare = async () => {
    try {
      setCompareState("creating");
      setCompareError(null);

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

      setCompareState("generating");
      synthesisStream.startGeneration(json.data.id);
    } catch (err) {
      setCompareState("error");
      setCompareError(err instanceof Error ? err.message : "对比失败");
    }
  };

  if (isLoading || highSimilarityItems.length < MIN_HIGH_SIMILARITY_COUNT) {
    return null;
  }

  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <CardContent className="p-0">
        <button
          type="button"
          className="flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-lg"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Zap className="size-4 text-amber-500 flex-shrink-0" />
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {TEXT.sectionTitle}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              · {TEXT.subtitle}
            </span>
            {savedReport && !isExpanded && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                · {TEXT.savedHint}
              </span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="size-4 text-slate-400 flex-shrink-0 ml-2" />
          ) : (
            <ChevronDown className="size-4 text-slate-400 flex-shrink-0 ml-2" />
          )}
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 space-y-3">
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

            {showPrimaryActions && (
              <div className="flex flex-col gap-2">
                {savedReport && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{TEXT.savedHint}</span>
                    {savedReport.completedAt && (
                      <span>
                        {new Date(savedReport.completedAt).toLocaleString()}
                      </span>
                    )}
                    <Link
                      href={`/synthesis/${savedReport.id}`}
                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      {TEXT.viewFullReport}
                    </Link>
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCompare}
                  className="w-full"
                >
                  <Zap className="size-3.5 mr-1.5" />
                  {savedReport ? TEXT.regenerateButton : TEXT.compareButton}
                </Button>
              </div>
            )}

            {isComparing && (
              <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 py-2">
                <Loader2 className="size-4 animate-spin" />
                <span>
                  {synthesisStream.state.progress?.message || TEXT.generating}
                </span>
              </div>
            )}

            {compareState === "error" && (
              <div className="flex flex-col gap-2 text-sm text-red-600 dark:text-red-400 py-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 flex-shrink-0" />
                  <span>{compareError || TEXT.compareError}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCompare}
                    className="ml-auto h-7 text-xs"
                  >
                    {TEXT.retryButton}
                  </Button>
                </div>
                {savedReport && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={() => {
                      setCompareState("idle");
                      setCompareError(null);
                    }}
                  >
                    {TEXT.backToSaved}
                  </Button>
                )}
              </div>
            )}

            {compareState === "done" && streamOverview?.trim() && (
              <p className="text-xs text-muted-foreground">
                {TEXT.compareComplete}
              </p>
            )}

            {isExpanded &&
              matchLoading &&
              !savedReport &&
              compareState === "idle" && (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" />
                  {TEXT.loadingSaved}
                </p>
              )}

            {hasResults && (
              <Suspense fallback={<CompareResultSkeleton />}>
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                  {displayOverview?.trim() && (
                    <LazyOverviewSection
                      content={displayOverview}
                      handlers={NOOP_HIGHLIGHT_HANDLERS}
                      defaultOpen={true}
                    />
                  )}
                  {displayDivergence.length > 0 && (
                    <LazyDivergenceSection
                      items={displayDivergence}
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
