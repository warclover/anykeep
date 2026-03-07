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
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import { isAdminUser } from "@/lib/auth/admin-check";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { forbiddenError } from "@/lib/utils/api-response";

/**
 * 请求验证 Schema
 */
const RollbackRequestSchema = z.object({
  reason: z.string().optional(),
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
    const rollbackLogger = createLogger("RollbackAPI");
    const featureFlag = getFeatureFlag();
    const monitoringService = new MonitoringService(rollbackLogger);
    const rollbackService = new RollbackService(
      rollbackLogger,
      featureFlag,
      monitoringService,
    );

    // 4. 执行手动回滚
    console.info("执行手动回滚", {
      userId,
      reason: reason || "手动触发",
    });

    const rollbackRecord = await rollbackService.executeRollback(
      RollbackReason.MANUAL,
      userId,
    );

    // 5. 返回结果
    return NextResponse.json({
      success: true,
      data: {
        rollback: rollbackRecord,
        currentConfig: featureFlag.getConfig(),
      },
    });
  },
);
