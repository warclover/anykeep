/**
 * 导入 Tab 内容组件
 * 复用现有的导入功能组件
 *
 * @description 实现懒加载：仅当 Tab 激活时才渲染内容，避免不必要的数据请求
 */

"use client";

import { TabsContent } from "@/components/ui/tabs";
import { ImportPageClient } from "@/components/import/import-page-client";
import { useActiveTab } from "./data-hub-tabs";

export function ImportTabContent() {
  const activeTab = useActiveTab();
  const isActive = activeTab === "import";

  return (
    <TabsContent value="import" className="mt-0">
      {isActive && <ImportPageClient embedded />}
    </TabsContent>
  );
}
