/**
 * Knowledge Studio - 主页面 (重定向)
 * @route /knowledge-studio
 * @description 自动重定向到 V2 版本
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "知识工坊 - AnyKeep",
  description: "AI 驱动的知识工坊，深度学习和掌握收藏内容",
};

export default function KnowledgeStudioPage() {
  redirect("/knowledge-studio/v2");
}
