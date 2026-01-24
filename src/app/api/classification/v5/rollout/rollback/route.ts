/**
 * 智能分类 v5.0 - 手动回滚 API
 *
 * POST /api/classification/v5/rollout/rollback
 * 手动触发回滚到上一个阶段
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getFeatureFlag } from "@/lib/classification/infrastructure/rollout/feature-flag";
import {
  RollbackService,
  RollbackReason,
} from "@/lib/classification/infrastructure/rollout/rollback";
import { MonitoringService } from "@/lib/classification/infrastructure/rollout/monitoring";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import { isAdminUser } from "@/lib/auth/admin-check";

/**
 * 请求验证 Schema
 */
const RollbackRequestSchema = z.object({
  reason: z.string().optional(),
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
    const validation = RollbackRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "请求参数无效",
          details: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const { reason } = validation.data;

    // 3. 初始化服务
    const logger = createLogger("RollbackAPI");
    const featureFlag = getFeatureFlag();
    const monitoringService = new MonitoringService(logger);
    const rollbackService = new RollbackService(
      logger,
      featureFlag,
      monitoringService,
    );

    // 4. 执行手动回滚
    console.info("执行手动回滚", {
      userId: user.id,
      reason: reason || "手动触发",
    });

    const rollbackRecord = await rollbackService.executeRollback(
      RollbackReason.MANUAL,
      user.id,
    );

    // 5. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        rollback: rollbackRecord,
        currentConfig: featureFlag.getConfig(),
      },
    });
  } catch (error) {
    console.error("手动回滚失败:", error);
    return NextResponse.json(
      {
        error: "手动回滚失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
