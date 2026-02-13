/**
 * 内容分析列表页 - 服务端入口
 * 展示用户的所有内容分析报告，支持搜索、筛选和排序
 *
 * @version 1.0.0
 * @since 2026-02-13
 */

import type { Metadata } from "next";
import { ContentAnalysisListClient } from "@/components/content-analysis/content-analysis-list-client";

export const metadata: Metadata = {
  title: "内容分析 - AnyKeep",
  description: "对比分析两篇文章，或对多篇文章进行主题综述",
};

export default function ContentAnalysisPage() {
  return <ContentAnalysisListClient />;
}
