/**
 * 分发中心页面 - 服务端入口
 * 管理书签内容分发到不同目标平台
 */

import type { Metadata } from "next";
import { DistributionPageClient } from "@/components/distribution/distribution-page-client";

export const metadata: Metadata = {
  title: "分发中心 - AnyKeep",
  description: "将收藏内容分发到 Obsidian、Notion 等平台，自动同步或手动导出",
};

export default function DistributionPage() {
  return <DistributionPageClient />;
}
