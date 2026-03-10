/**
 * POST /api/internal/maintenance/trigger
 * 手动触发维护任务（垃圾箱清理）
 *
 * 用途：
 * 1. 管理员客户端启动检查后，自动触发需要的任务
 * 2. 用户在数据页面手动触发
 * 3. 调用 Edge Functions 执行实际任务
 */

import type { NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  successResponse,
  databaseError,
  badRequestError,
  forbiddenError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { isAdminUser } from "@/lib/auth/admin-check";

type MaintenanceTaskName = "cleanup-trash";

/**
 * 调用 Edge Function
 */
async function invokeEdgeFunction(
  functionName: string,
  serviceRoleKey: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const functionUrl = `${supabaseEnv.url}/functions/v1/${functionName}`;

    logger.debug(
      { functionName, functionUrl, action: "invoke_edge_function" },
      "POST: Invoking Edge Function",
    );

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    logger.debug(
      {
        functionName,
        status: response.status,
        data,
        action: "edge_function_response",
      },
      "POST: Edge Function response",
    );

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "调用 Edge Function 失败",
      };
    }

    return { success: true, data };
  } catch (error) {
    logger.error(
      {
        functionName,
        error: error instanceof Error ? error.message : String(error),
        action: "invoke_edge_function_error",
      },
      "POST: Edge Function invocation error",
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "调用 Edge Function 失败",
    };
  }
}

/**
 * POST /api/internal/maintenance/trigger
 * 手动触发维护任务（仅管理员）
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId, user }) => {
    // 管理员权限校验
    if (!isAdminUser(user?.email)) {
      logger.warn(
        { userId, email: user?.email, action: "maintenance_trigger_forbidden" },
        "POST: Non-admin user attempted to trigger maintenance task",
      );
      return forbiddenError("权限不足：仅管理员可触发维护任务");
    }

    try {
      // 解析请求参数
      const body: { task?: MaintenanceTaskName } = await request
        .json()
        .catch(() => ({}));
      const task = body?.task;

      if (!task) {
        return badRequestError("缺少任务名称");
      }

      if (task !== "cleanup-trash") {
        return badRequestError("无效的任务名称");
      }

      // 获取服务角色密钥
      const serviceRoleKey = supabaseEnv.serviceRoleKey;

      // 调用对应的 Edge Function
      const result = await invokeEdgeFunction(task, serviceRoleKey);

      if (!result.success) {
        return databaseError(
          `执行任务失败: ${result.error}`,
          new Error(result.error),
        );
      }

      logger.info(
        { task, result: result.data, action: "maintenance_trigger_success" },
        "POST: Maintenance task triggered successfully",
      );

      return successResponse({
        task,
        result: result.data,
        message: "任务垃圾箱清理已成功触发",
      });
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          operation: "maintenance_trigger",
        },
        "POST /api/internal/maintenance/trigger error",
      );
      return databaseError("触发维护任务失败", error);
    }
  },
);
