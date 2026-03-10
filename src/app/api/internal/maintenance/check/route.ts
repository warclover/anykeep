/**
 * GET /api/internal/maintenance/check
 * 检查是否需要执行维护任务（垃圾箱清理）
 *
 * 用途：
 * 1. 管理员客户端启动时调用，实现混合触发机制
 * 2. 检查距离上次执行是否超过30天
 * 3. 返回需要执行的任务列表
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import {
  successResponse,
  forbiddenError,
  databaseError,
} from "@/lib/utils/api-response";
import { withAuthMiddleware } from "@/lib/api/middleware";
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
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * GET /api/internal/maintenance/check
 * 检查维护任务状态（仅管理员）
 */
export const GET = withAuthMiddleware(async (_request, { userId, user }) => {
  // 管理员权限校验
  if (!isAdminUser(user?.email)) {
    return forbiddenError("权限不足：仅管理员可查看维护任务状态");
  }

  try {
    // 获取用户的维护任务时间戳
    const supabase = await createClient();
    type ProfileMaintenanceType = {
      last_trash_cleanup_at: string | null;
    };
    const { data: profile, error: profileError } = (await supabase
      .from("profiles")
      .select("last_trash_cleanup_at")
      .eq("id", userId)
      .single()) as unknown as {
      data: ProfileMaintenanceType | null;
      error: { message: string } | null;
    };

    if (profileError) {
      return databaseError("获取用户信息失败", profileError);
    }

    // 检查每个任务是否需要执行（超过30天）
    const MAINTENANCE_THRESHOLD_DAYS = 30;

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
        operation: "maintenance_check",
      },
      "GET /api/internal/maintenance/check error",
    );
    return databaseError("检查维护任务失败", error);
  }
});
