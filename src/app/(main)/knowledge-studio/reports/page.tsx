import type { Metadata } from "next";
import { KnowledgeStudioReportsPageClient } from "./reports-page-client";

export const metadata: Metadata = {
  title: "学习报告 - AnyKeep",
  description: "查看知识工坊生成的学习报告和分析",
};

export default function KnowledgeStudioReportsPage() {
  return <KnowledgeStudioReportsPageClient />;
}
