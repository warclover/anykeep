/**
 * 用户分类阶段 API
 * GET /api/classification/stage - 获取用户当前分类阶段
 *
 * @updated 2026-03-09 - 移除 ClassificationContainer 依赖，直接使用 v2 逻辑
 */

import { createClient } from "@/lib/supabase/server";
import { CLASSIFICATION_CONFIG } from "@/lib/classification-v2/config";
import { successResponse } from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import type { UserStage } from "@/lib/classification-v2/types";

/** 阶段描述映射 */
const STAGE_DESCRIPTIONS: Record<
  UserStage,
  { label: string; description: string }
> = {
  cold_start: {
    label: "冷启动期",
    description: "系统正在学习您的偏好，分类结果可能不够精确",
  },
  growing: {
    label: "成长期",
    description: "系统已积累一定数据，分类精度逐步提升",
  },
  mature: {
    label: "成熟期",
    description: "系统已充分了解您的偏好，可提供高精度分类",
  },
};

/**
 * GET /api/classification/stage
 * 获取用户当前分类阶段
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();

  // 查询用户书签总数
  const { count } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_deleted", false);

  const bookmarkCount = count ?? 0;

  // 根据书签数判断阶段（与 v2 user-context.ts determineStage 一致）
  const { coldStartMax, growingMax } = CLASSIFICATION_CONFIG.userLifecycle;
  let stage: UserStage;
  if (bookmarkCount <= coldStartMax) {
    stage = "cold_start";
  } else if (bookmarkCount <= growingMax) {
    stage = "growing";
  } else {
    stage = "mature";
  }

  const stageInfo = STAGE_DESCRIPTIONS[stage];

  return successResponse({
    stage,
    ...stageInfo,
  });
});
