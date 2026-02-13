/**
 * 内容分析创建页 - 服务端入口
 * 双 Tab：对比分析（2篇）+ 主题综述（3篇以上）
 *
 * @version 1.0.0
 * @since 2026-02-13
 */

import type { Metadata } from "next";
import { ContentAnalysisCreateClient } from "@/components/content-analysis/content-analysis-create-client";

export const metadata: Metadata = {
  title: "创建内容分析 - AnyKeep",
  description: "选择内容进行对比分析或主题综述",
};

export default function ContentAnalysisNewPage() {
  return <ContentAnalysisCreateClient />;
}
