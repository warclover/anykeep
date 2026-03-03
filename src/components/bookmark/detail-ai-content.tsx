/**
 * 详情页 AI 内容区
 * V5.7: 从 bookmark-detail-client.tsx 提取非首屏 AI 功能区域
 *
 * 包含：AIBookmarkAssistant、VisionInsights
 * 该组件整体作为懒加载单元，将 useVisionAnalysis hook 及其依赖链
 * 从主组件移出，显著减少首屏模块数
 *
 * @version 1.1.0
 * @since 2026-02-09
 */

"use client";

import { useMemo, lazy, Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useVisionAnalysis } from "@/hooks/domain/ai/use-vision-analysis";
import type { BookmarkVisionData } from "@/types/vision";
import { hasVisionData } from "@/types/vision";
import type { Bookmark } from "@/types/supabase";

// AI 组件懒加载
const AIBookmarkAssistant = lazy(() =>
  import("@/components/ai/ai-bookmark-assistant").then((m) => ({
    default: m.AIBookmarkAssistant,
  })),
);

// 视觉分析懒加载
const VisionInsights = lazy(() =>
  import("@/components/bookmark/vision-insights").then((m) => ({
    default: m.VisionInsights,
  })),
);
const VisionAnalysisTrigger = lazy(() =>
  import("@/components/bookmark/vision-insights").then((m) => ({
    default: m.VisionAnalysisTrigger,
  })),
);

export interface DetailAIContentProps {
  bookmark: Bookmark & {
    folders?: { id: number; name: string } | null;
    source_id?: string | null;
  };
  userId?: string;
  localUserTags: string[] | null;
  setLocalUserTags: React.Dispatch<React.SetStateAction<string[] | null>>;
  onOpenAIPanel: () => void;
}

export function DetailAIContent({
  bookmark,
  userId,
  localUserTags: _localUserTags,
  setLocalUserTags,
  onOpenAIPanel,
}: DetailAIContentProps) {
  // 视觉分析 hook（依赖链从主组件移至此处）
  const {
    data: newVisionData,
    isLoading: isAnalyzingVision,
    analyze: analyzeVision,
  } = useVisionAnalysis();

  // 派生状态：从 props 计算已有视觉数据（无需 useEffect + setState）
  const existingVisionData = useMemo(
    () =>
      hasVisionData(bookmark.ai_vision_data)
        ? (bookmark.ai_vision_data as unknown as BookmarkVisionData)
        : null,
    [bookmark.ai_vision_data],
  );

  const visionData = newVisionData || existingVisionData;

  return (
    <>
      {/* AI 助手（合并快捷操作 + 问答对话） */}
      {userId && (
        <>
          <Suspense fallback={<Skeleton className="h-40 w-full rounded-lg" />}>
            <AIBookmarkAssistant
              userId={userId}
              bookmarkId={bookmark.id}
              bookmarkTitle={bookmark.title ?? ""}
              bookmarkUrl={bookmark.url}
              bookmarkSummary={bookmark.ai_summary}
              bookmarkTags={bookmark.user_tags}
              bookmarkPlatform={bookmark.platform}
              onActionComplete={(action, result) => {
                if (action === "auto-tag" && result) {
                  const tagResult = result as { newTags?: string[] };
                  const newTags = Array.isArray(tagResult.newTags)
                    ? tagResult.newTags
                    : [];
                  setLocalUserTags((prev) => {
                    const existing = prev ?? [];
                    return [...new Set([...existing, ...newTags])];
                  });
                }
              }}
              onOpenFullChat={onOpenAIPanel}
            />
          </Suspense>
          <Separator />
        </>
      )}

      {/* 视觉洞察 */}
      {(visionData || bookmark.cover_url) && (
        <>
          <div>
            <Suspense
              fallback={<Skeleton className="h-20 w-full rounded-lg" />}
            >
              {visionData ? (
                <VisionInsights
                  data={visionData}
                  showHeader={true}
                  defaultExpanded={true}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      视觉分析
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      使用 AI 分析图片内容，提取文字和视觉特征
                    </p>
                  </div>
                  <VisionAnalysisTrigger
                    isAnalyzing={isAnalyzingVision}
                    onAnalyze={() => analyzeVision(bookmark.id)}
                  />
                </div>
              )}
            </Suspense>
          </div>
          <Separator />
        </>
      )}

      {/* 相关收藏已由页面底部的 RelatedBookmarksV2Lazy 统一展示，此处不重复请求 */}
    </>
  );
}
