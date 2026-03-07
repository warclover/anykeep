/**
 * 智能分类 v5.0 - 发布状态 API
 *
 * GET /api/classification/v5/rollout/status
 * 获取当前发布状态和监控指标
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getFeatureFlag } from "@/lib/classification/infrastructure/rollout/feature-flag";
import { MonitoringService } from "@/lib/classification/infrastructure/rollout/monitoring";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import { isAdminUser } from "@/lib/auth/admin-check";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { forbiddenError } from "@/lib/utils/api-response";

export const GET = withAuthMiddleware(
  async (_request: NextRequest, { user }) => {
    // 管理员权限检查
    if (!user?.email) {
      return forbiddenError("权限不足 - 需要管理员权限");
    }
    if (!isAdminUser(user.email)) {
      return forbiddenError("权限不足 - 需要管理员权限");
    }

    // 2. 获取 Feature Flag 状态
    const featureFlag = getFeatureFlag();
    const flagStats = featureFlag.getStats();

    // 3. 生成监控报告（最近 1 小时）
    const statusLogger = createLogger("RolloutStatusAPI");
    const monitoringService = new MonitoringService(statusLogger);

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
    const report = await monitoringService.generateReport(startTime, endTime);

    // 4. 返回状态
    return NextResponse.json({
      success: true,
      data: {
        featureFlag: flagStats,
        monitoring: report,
        timestamp: new Date().toISOString(),
      },
    });
  },
);
