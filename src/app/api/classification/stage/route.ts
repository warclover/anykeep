/**
 * 用户分类阶段 API
 * GET /api/classification/stage - 获取用户当前分类阶段
 */

import { createClient } from "@/lib/supabase/server";
import { ClassificationContainer } from "@/lib/classification";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * GET /api/classification/stage
 * 获取用户当前分类阶段
 */
export async function GET() {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const userStageService = container.getUserStageService();

    // 3. 获取用户阶段
    const stage = await userStageService.getStage(user.id);
    const stageInfo = userStageService.getStageDescription(stage);

    // 4. 返回阶段信息
    return successResponse({
      stage,
      ...stageInfo,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "GET /api/classification/stage error",
    );
    return internalError("获取用户阶段失败");
  }
}
