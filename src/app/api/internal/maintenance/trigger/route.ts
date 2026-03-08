/**
 * POST /api/maintenance/trigger
 * 手动触发维护任务（垃圾箱清理、链接验证）
 *
 * 用途：
 * 1. 客户端启动检查后，自动触发需要的任务
 * 2. 用户在数据页面手动触发
 * 3. 调用 Edge Functions 执行实际任务
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  successResponse,
  unauthorizedError,
  databaseError,
  badRequestError,
  forbiddenError,
} from "@/lib/utils/api-response";
import { isAdminUser } from "@/lib/auth/admin-check";

type MaintenanceTaskName = "cleanup-trash" | "validate-all-links";

interface TriggerRequest {
  task: MaintenanceTaskName;
}

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
      {
        functionName,
        functionUrl,
        action: "invoke_edge_function",
      },
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

    return {
      success: true,
      data,
    };
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
 * POST /api/maintenance/trigger
 * 手动触发维护任务
 */
export async function POST(request: NextRequest) {
  try {
    logger.debug(
      {
        action: "maintenance_trigger_start",
      },
      "POST: Trigger maintenance task",
    );

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    logger.debug(
      {
        userId: user?.id,
        authError: authError?.message,
        action: "auth_check",
      },
      "POST: User authentication",
    );

    if (authError || !user) {
      return unauthorizedError();
    }

    // 1.5 管理员权限校验：维护操作仅限管理员
    if (!isAdminUser(user.email)) {
      logger.warn(
        {
          userId: user.id,
          email: user.email,
          action: "maintenance_trigger_forbidden",
        },
        "POST: Non-admin user attempted to trigger maintenance task",
      );
      return forbiddenError("权限不足：仅管理员可触发维护任务");
    }

    // 2. 解析请求参数
    const body: TriggerRequest = await request.json().catch(() => ({}));
    const { task } = body;

    if (!task) {
      return badRequestError("缺少任务名称");
    }

    if (task !== "cleanup-trash" && task !== "validate-all-links") {
      return badRequestError("无效的任务名称");
    }

    logger.debug(
      {
        task,
        action: "parse_params",
      },
      "POST: Parse trigger parameters",
    );

    // 3. 获取服务角色密钥
    const serviceRoleKey = supabaseEnv.serviceRoleKey;

    // 4. 调用对应的 Edge Function
    const result = await invokeEdgeFunction(task, serviceRoleKey);

    if (!result.success) {
      return databaseError(
        `执行任务失败: ${result.error}`,
        new Error(result.error),
      );
    }

    // 5. 记录成功日志
    logger.info(
      {
        task,
        result: result.data,
        action: "maintenance_trigger_success",
      },
      "POST: Maintenance task triggered successfully",
    );

    // 6. 返回结果
    return successResponse({
      task,
      result: result.data,
      message: `任务 ${task === "cleanup-trash" ? "垃圾箱清理" : "链接验证"} 已成功触发`,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "maintenance_trigger",
      },
      "POST /api/maintenance/trigger error",
    );
    return databaseError("触发维护任务失败", error);
  }
}
