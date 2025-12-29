/**
 * Brain-Sync 复习实验室页面 - 服务端入口
 *
 * 提供 AI 触发式主动复习系统的完整页面体验
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import type { Metadata } from "next";
import { BrainSyncPageClient } from "@/components/brain-sync";

export const metadata: Metadata = {
  title: "复习实验室 - AnyKeep",
  description:
    "Brain-Sync 智能间隔复习系统，使用 SM-2 算法科学安排复习计划，帮助您牢固记忆收藏内容",
};

export default function BrainSyncPage() {
  return <BrainSyncPageClient />;
}
