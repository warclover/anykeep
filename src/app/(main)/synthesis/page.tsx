/**
 * 综述列表页 - 服务端入口
 * 展示用户的所有综述报告，支持搜索、筛选和排序
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { Metadata } from "next";
import { SynthesisListPageClient } from "@/components/synthesis/synthesis-list-page-client";

export const metadata: Metadata = {
  title: "主题综述 - AnyKeep",
  description: "查看和管理你的主题综述，智能整合多来源知识",
};

export default function SynthesisListPage() {
  return <SynthesisListPageClient />;
}
