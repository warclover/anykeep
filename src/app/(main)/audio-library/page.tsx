/**
 * 我的语音页面
 *
 * 管理 TTS 语音朗读历史：
 * - 浏览和播放历史语音
 * - 按日期分组展示
 * - 搜索和筛选
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AudioLibraryClient } from "@/components/audio-library/audio-library-client";

export const metadata: Metadata = {
  title: "我的语音 - AnyKeep",
  description: "管理和回放 TTS 语音朗读历史",
};

function LoadingSkeleton() {
  return (
    <div className="container mx-auto p-4 lg:p-8 max-w-4xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function AudioLibraryPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <AudioLibraryClient />
    </Suspense>
  );
}
