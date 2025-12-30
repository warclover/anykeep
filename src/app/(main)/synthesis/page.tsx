/**
 * 知识萃取列表页 - 服务端入口
 * 展示用户的所有知识萃取报告，支持搜索、筛选和排序
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { Metadata } from "next";
import { SynthesisListPageClient } from "@/components/synthesis/synthesis-list-page-client";

export const metadata: Metadata = {
  title: "知识萃取 - AnyKeep",
  description: "从多个书签中萃取知识精华，智能整合多来源知识",
};

export default function SynthesisListPage() {
  return <SynthesisListPageClient />;
}
