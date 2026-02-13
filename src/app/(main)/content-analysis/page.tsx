/**
 * 内容分析页面 - 服务端入口
 *
 * 三 Tab 设计：
 * - 对比分析：选择 2 篇内容进行对比
 * - 主题综述：选择 3 篇以上进行综述
 * - 历史记录：查看所有分析报告
 *
 * @version 2.0.0
 * @since 2026-02-13
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { ContentAnalysisListClient } from "@/components/content-analysis/content-analysis-list-client";

export const metadata: Metadata = {
  title: "内容分析 - AnyKeep",
  description: "对比分析两篇文章，或对多篇文章进行主题综述",
};

export default function ContentAnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <ContentAnalysisListClient />
    </Suspense>
  );
}
