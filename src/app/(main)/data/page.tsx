/**
 * 数据中心页面 - 服务端入口
 * 整合数据导入、导出与分发功能
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { DataHubPageClient, DataHubSkeleton } from "@/components/data-hub";

export const metadata: Metadata = {
  title: "数据中心 - AnyKeep",
  description: "管理数据导入、导出与分发到外部平台",
};

export default function DataHubPage() {
  return (
    <Suspense fallback={<DataHubSkeleton />}>
      <DataHubPageClient />
    </Suspense>
  );
}
