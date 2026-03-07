/**
 * 智能分类 v5.0 - 更新发布阶段 API
 *
 * POST /api/classification/v5/rollout/stage
 * 更新发布阶段（DISABLED → CANARY → EARLY → MAJORITY → FULL）
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getFeatureFlag,
  RolloutStage,
} from "@/lib/classification/infrastructure/rollout/feature-flag";
import { isAdminUser } from "@/lib/auth/admin-check";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { forbiddenError } from "@/lib/utils/api-response";

/**
 * 请求验证 Schema
 */
const UpdateStageSchema = z.object({
  stage: z.nativeEnum(RolloutStage),
});

export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId, user }) => {
    // 管理员权限检查
    if (!user?.email) {
      return forbiddenError("权限不足 - 需要管理员权限");
    }
    if (!isAdminUser(user.email)) {
      return forbiddenError("权限不足 - 需要管理员权限");
    }

    // 2. 解析请求体
    const body = await request.json();
    const validation = UpdateStageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "请求参数无效",
          details: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const { stage } = validation.data;

    // 3. 更新 Feature Flag
    const featureFlag = getFeatureFlag();
    const oldStage = featureFlag.getConfig().stage;

    featureFlag.setStage(stage);

    console.info("更新发布阶段", {
      userId,
      oldStage,
      newStage: stage,
    });

    // 4. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        oldStage,
        newStage: stage,
        config: featureFlag.getConfig(),
      },
    });
  },
);
