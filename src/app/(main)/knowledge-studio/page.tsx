/**
 * Knowledge Studio - 主页面
 * @route /knowledge-studio
 * @description 知识工坊入口，整合素材选择、蓝图选择、草稿生成流程
 */

import type { Metadata } from "next";
import { KnowledgeStudioPageClient } from "./knowledge-studio-page-client";

export const metadata: Metadata = {
  title: "知识工坊 - AnyKeep",
  description: "AI 驱动的知识草稿生成工具，将收藏内容转化为结构化草稿",
};

export default function KnowledgeStudioPage() {
  return <KnowledgeStudioPageClient />;
}
