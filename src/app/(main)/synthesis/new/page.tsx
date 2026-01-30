/**
 * 内容分析创建页 - 服务端入口
 * 单页完成书签选择和分析配置
 *
 * @version 2.0.0
 * @since 2025-12-29
 * @updated 2026-01-30 - 简化为单页流程
 */

import type { Metadata } from "next";
import { SynthesisQuickPageClient } from "@/components/synthesis/synthesis-quick-page-client";

export const metadata: Metadata = {
  title: "内��分析 - AnyKeep",
  description: "选择多篇内容，AI 分析它们的共识、分歧与知识盲区",
};

export default function SynthesisNewPage() {
  return <SynthesisQuickPageClient />;
}
