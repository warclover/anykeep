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
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin-check";

/**
 * 请求验证 Schema
 */
const UpdateStageSchema = z.object({
  stage: z.nativeEnum(RolloutStage),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份（仅管理员可访问）
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 检查用户是否为管理员
    if (!isAdminUser(user.email)) {
      return NextResponse.json(
        { error: "权限不足 - 需要管理员权限" },
        { status: 403 },
      );
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
      userId: user.id,
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
  } catch (error) {
    console.error("更新发布阶段失败:", error);
    return NextResponse.json(
      {
        error: "更新发布阶段失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
