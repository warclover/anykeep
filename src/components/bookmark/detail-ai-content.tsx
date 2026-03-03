/**
 * 详情页 AI 内容区
 * V5.7: 从 bookmark-detail-client.tsx 提取非首屏 AI 功能区域
 *
 * 包含：AIBookmarkAssistant
 *
 * @version 1.2.0
 * @since 2026-02-09
 */

"use client";

import { lazy, Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Bookmark } from "@/types/supabase";

const AIBookmarkAssistant = lazy(() =>
  import("@/components/ai/ai-bookmark-assistant").then((m) => ({
    default: m.AIBookmarkAssistant,
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
  return (
    <>
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

      {/* 相关收藏已由页面底部的 RelatedBookmarksV2Lazy 统一展示，此处不重复请求 */}
    </>
  );
}
