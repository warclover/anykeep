/**
 * Knowledge Studio v2 - 生成历史记录页面
 * @route /knowledge-studio/v2/history
 * @description 查看过往生成记录，支持一键复用配置
 */

import { Suspense } from "react";
import { HistoryPageClient } from "@/components/knowledge-studio/v2/history-page-client";

export const metadata = {
  title: "生成历史 | 知识工坊",
  description: "查看过往生成记录，一键复用配置",
};

export default function KnowledgeStudioV2HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-muted-foreground">加载中...</div>
        </div>
      }
    >
      <HistoryPageClient />
    </Suspense>
  );
}
