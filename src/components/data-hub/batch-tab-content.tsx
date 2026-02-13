/**
 * 批量管理 Tab 内容组件
 * 复用现有的批量操作功能组件
 *
 * @description 实现懒加载：仅当 Tab 激活时才渲染内容，避免不必要的数据请求
 */

"use client";

import { TabsContent } from "@/components/ui/tabs";
import { BatchPageClient } from "@/components/batch/batch-page-client";
import { useActiveTab } from "./data-hub-tabs";

export function BatchTabContent() {
  const activeTab = useActiveTab();
  const isActive = activeTab === "batch";

  return (
    <TabsContent value="batch" className="mt-0 -mx-[-1rem]">
      {isActive && <BatchPageClient embedded />}
    </TabsContent>
  );
}
