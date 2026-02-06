/**
 * 导入导出主客户端组件
 * 整合导入、导出、分发三大功能
 */

"use client";

import { Suspense } from "react";
import { DataHubTabs } from "./data-hub-tabs";
import { ImportTabContent } from "./import-tab-content";
import { ExportTabContent } from "./export-tab-content";
import { DistributeTabContent } from "./distribute-tab-content";
import { DataHubTabSkeleton } from "./data-hub-skeleton";

export function DataHubPageClient() {
  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">导入导出</h1>
        <p className="text-muted-foreground">
          管理数据导入、导出与分发到外部平台
        </p>
      </div>

      <Suspense fallback={<DataHubTabSkeleton />}>
        <DataHubTabs>
          <ImportTabContent />
          <ExportTabContent />
          <DistributeTabContent />
        </DataHubTabs>
      </Suspense>
    </div>
  );
}
