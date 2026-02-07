/**
 * 分发 Tab 内容组件
 * 复用现有的分发中心功能组件
 *
 * @description 实现懒加载：仅当 Tab 激活时才渲染内容，避免不必要的 API 请求
 */

"use client";

import { TabsContent } from "@/components/ui/tabs";
import { DistributionPageClient } from "@/components/distribution/distribution-page-client";
import { useActiveTab } from "./data-hub-tabs";

export function DistributeTabContent() {
  const activeTab = useActiveTab();
  const isActive = activeTab === "distribute";

  return (
    <TabsContent value="distribute" className="mt-0">
      {isActive && <DistributionPageClient embedded />}
    </TabsContent>
  );
}
