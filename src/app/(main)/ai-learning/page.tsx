export const dynamic = "force-dynamic";

/**
 * AI 学习洞察页面 - 服务端组件
 * 可视化展示 AI 从用户分类行为中学到的偏好和排除规则
 */

import { AILearningPageClient } from "@/components/ai-learning/ai-learning-page-client";
import { getAuthenticatedUserIdWithFallback } from "@/lib/server/auth";

export default async function AILearningPage() {
  const userId = await getAuthenticatedUserIdWithFallback();
  if (!userId) {
    return <AILearningPageClient error="请先登录" />;
  }

  return <AILearningPageClient />;
}
