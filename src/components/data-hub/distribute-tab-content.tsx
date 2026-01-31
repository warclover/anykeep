/**
 * 分发 Tab 内容组件
 * 复用现有的分发中心功能组件
 */

"use client";

import { TabsContent } from "@/components/ui/tabs";
import { DistributionPageClient } from "@/components/distribution/distribution-page-client";

export function DistributeTabContent() {
  return (
    <TabsContent value="distribute" className="mt-0">
      <DistributionPageClient embedded />
    </TabsContent>
  );
}
