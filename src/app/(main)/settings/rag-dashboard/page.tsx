/**
 * RAG 监控仪表板页面
 *
 * 展示 RAG 系统的实时性能、质量和成本指标
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

import { Suspense } from "react";
import { RAGDashboardClient } from "@/components/rag-dashboard/rag-dashboard-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "RAG 监控仪表板 | AnyKeep",
  description: "实时监控 RAG 系统的性能、质量和成本指标",
};

export default function RAGDashboardPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">RAG 监控仪表板</h1>
          <p className="text-muted-foreground mt-1">
            实时监控搜索系统的性能、质量和成本指标
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        }
      >
        <RAGDashboardClient />
      </Suspense>
    </div>
  );
}
