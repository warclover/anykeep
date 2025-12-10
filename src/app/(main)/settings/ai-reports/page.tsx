/**
 * AI Evolution Reports Page
 * 展示月度 AI 文件夹管理报告
 */

import { Metadata } from "next";
import { ReportPageClient } from "@/components/folder-evolution/report-page-client";

export const metadata: Metadata = {
  title: "AI 进化报告 - AnyKeep",
  description: "查看 AI 文件夹管理的月度报告",
};

export default function AIReportsPage() {
  return <ReportPageClient />;
}
