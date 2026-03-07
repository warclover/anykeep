/**
 * 用户分类阶段 API
 * GET /api/classification/stage - 获取用户当前分类阶段
 *
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { createClient } from "@/lib/supabase/server";
import { ClassificationContainer } from "@/lib/classification";
import { successResponse } from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/classification/stage
 * 获取用户当前分类阶段
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  // 1. 初始化分类容器并获取服务
  const supabase = await createClient();
  const container = ClassificationContainer.initialize(supabase);
  const userStageService = container.getUserStageService();

  // 2. 获取用户阶段
  const stage = await userStageService.getStage(userId);
  const stageInfo = userStageService.getStageDescription(stage);

  // 3. 返回阶段信息
  return successResponse({
    stage,
    ...stageInfo,
  });
});
