/**
 * Classification Integration Test API
 * V4.2 集成测试 API
 *
 * GET /api/classification/test - 运行集成测试
 * GET /api/classification/test?quick=true - 快速健康检查
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  runIntegrationTests,
  runHealthCheck,
} from "@/lib/classification/testing/integration-test";
import type { NextRequest } from "next/server";

/**
 * GET /api/classification/test
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const isQuick = searchParams.get("quick") === "true";

    // 快速健康检查（不需要认证）
    if (isQuick) {
      const health = runHealthCheck();
      return successResponse({
        type: "health_check",
        ...health,
      });
    }

    // 完整测试需要认证
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 运行完整集成测试
    const report = await runIntegrationTests(user.id);

    logger.info(
      {
        userId: user.id,
        totalTests: report.totalTests,
        passed: report.passed,
        failed: report.failed,
        duration: report.duration,
      },
      "Integration tests completed",
    );

    return successResponse({
      type: "integration_test",
      ...report,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "GET /api/classification/test error");
    return internalError("测试执行失败");
  }
}
