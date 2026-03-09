/**
 * GET /api/maintenance/check
 * 检查是否需要执行维护任务（垃圾箱清理、链接验证）
 *
 * 用途：
 * 1. 客户端启动时调用，实现混合触发机制
 * 2. 检查距离上次执行是否超过30天
 * 3. 返回需要执行的任务列表
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  successResponse,
  unauthorizedError,
  forbiddenError,
  databaseError,
} from "@/lib/utils/api-response";
import { isAdminUser } from "@/lib/auth/admin-check";

interface MaintenanceTask {
  name: "cleanup-trash";
  label: string;
  lastExecutedAt: string | null;
  daysSinceLastExecution: number | null;
  needsExecution: boolean;
  reason: string;
}

interface MaintenanceCheckResponse {
  needsMaintenance: boolean;
  tasks: MaintenanceTask[];
}

/**
 * 计算距离上次执行的天数
 */
function calculateDaysSince(dateString: string | null): number | null {
  if (!dateString) return null;

  const lastExecution = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - lastExecution.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * GET /api/maintenance/check
 * 检查维护任务状态
 */
export async function GET(_request: NextRequest) {
  try {
    logger.debug(
      {
        action: "maintenance_check_start",
      },
      "GET: Check maintenance tasks",
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
      "GET: User authentication",
    );

    if (authError || !user) {
      return unauthorizedError();
    }

    // 1.5 管理员权限校验
    if (!isAdminUser(user.email)) {
      return forbiddenError("权限不足：仅管理员可查看维护任务状态");
    }

    // 2. 获取用户的维护任务时间戳
    // 类型断言: 手动维护类型文件时需要此断言
    type ProfileMaintenanceType = {
      last_trash_cleanup_at: string | null;
    };
    const { data: profile, error: profileError } = (await supabase
      .from("profiles")
      .select("last_trash_cleanup_at")
      .eq("id", user.id)
      .single()) as unknown as {
      data: ProfileMaintenanceType | null;
      error: { message: string } | null;
    };

    logger.debug(
      {
        profile,
        profileError: profileError?.message,
        action: "fetch_profile",
      },
      "GET: Fetch profile",
    );

    if (profileError) {
      return databaseError("获取用户信息失败", profileError);
    }

    // 3. 检查每个任务是否需要执行（超过30天）
    const MAINTENANCE_THRESHOLD_DAYS = 30;

    // 任务 1: 垃圾箱清理
    const trashCleanupDays = calculateDaysSince(
      profile?.last_trash_cleanup_at || null,
    );
    const needsTrashCleanup =
      trashCleanupDays === null ||
      trashCleanupDays >= MAINTENANCE_THRESHOLD_DAYS;

    const trashCleanupTask: MaintenanceTask = {
      name: "cleanup-trash",
      label: "垃圾箱清理",
      lastExecutedAt: profile?.last_trash_cleanup_at || null,
      daysSinceLastExecution: trashCleanupDays,
      needsExecution: needsTrashCleanup,
      reason: needsTrashCleanup
        ? trashCleanupDays === null
          ? "从未执行过垃圾箱清理"
          : `距离上次清理已过 ${trashCleanupDays} 天`
        : `上次清理距今 ${trashCleanupDays} 天，无需执行`,
    };

    // 4. 汇总结果
    const tasks = [trashCleanupTask];
    const needsMaintenance = tasks.some((task) => task.needsExecution);

    const response: MaintenanceCheckResponse = {
      needsMaintenance,
      tasks,
    };

    logger.info(
      {
        needsMaintenance,
        tasksNeedingExecution: tasks.filter((t) => t.needsExecution).length,
        action: "maintenance_check_success",
      },
      "GET: Maintenance check completed",
    );

    return successResponse(response);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "maintenance_check",
      },
      "GET /api/maintenance/check error",
    );
    return databaseError("检查维护任务失败", error);
  }
}
