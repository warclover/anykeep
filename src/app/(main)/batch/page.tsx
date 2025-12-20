/**
 * 批量操作页面 - 服务端入口
 * 提供批量标签管理、删除、移动等操作
 */

import type { Metadata } from "next";
import { BatchPageClient } from "@/components/batch/batch-page-client";

export const metadata: Metadata = {
  title: "批量操作 - AnyKeep",
  description: "批量管理书签：添加标签、移除标签、删除、移动等操作",
};

export default function BatchPage() {
  return <BatchPageClient />;
}
