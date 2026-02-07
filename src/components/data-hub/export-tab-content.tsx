/**
 * 导出 Tab 内容组件
 * 复用现有的导出功能组件
 *
 * @description 实现懒加载：仅当 Tab 激活时才渲染内容，避免加载全量书签数据
 */

"use client";

import { TabsContent } from "@/components/ui/tabs";
import { ExportPageClient } from "@/components/export/export-page-client";
import { useActiveTab } from "./data-hub-tabs";

export function ExportTabContent() {
  const activeTab = useActiveTab();
  const isActive = activeTab === "export";

  return (
    <TabsContent value="export" className="mt-0">
      {isActive && <ExportPageClient embedded />}
    </TabsContent>
  );
}
