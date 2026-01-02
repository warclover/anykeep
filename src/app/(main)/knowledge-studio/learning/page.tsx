/**
 * Knowledge Studio - 学习统计页面
 * @route /knowledge-studio/learning
 * @description Phase 3 存根 - 内化率追踪与学习统计
 */

import type { Metadata } from "next";
import { LearningPageClient } from "./learning-page-client";

export const metadata: Metadata = {
  title: "学习统计 - Knowledge Studio",
  description: "追踪知识内化率和学习进度",
};

export default function LearningPage() {
  return <LearningPageClient />;
}
