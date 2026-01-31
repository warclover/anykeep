/**
 * 导入 Tab 内容组件
 * 复用现有的导入功能组件
 */

"use client";

import { TabsContent } from "@/components/ui/tabs";
import { ImportPageClient } from "@/components/import/import-page-client";

export function ImportTabContent() {
  return (
    <TabsContent value="import" className="mt-0">
      <ImportPageClient embedded />
    </TabsContent>
  );
}
