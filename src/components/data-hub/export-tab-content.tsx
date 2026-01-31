/**
 * 导出 Tab 内容组件
 * 复用现有的导出功能组件
 */

"use client";

import { TabsContent } from "@/components/ui/tabs";
import { ExportPageClient } from "@/components/export/export-page-client";

export function ExportTabContent() {
  return (
    <TabsContent value="export" className="mt-0">
      <ExportPageClient embedded />
    </TabsContent>
  );
}
