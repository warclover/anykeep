/**
 * 重分类检查 API
 * GET /api/reclassify/check
 *
 * 检查是否需要触发重分类：
 * 1. 待整理文件夹中的书签数量是否达到阈值
 * 2. 距离上次重分类是否超过一周
 * 3. 是否有待处理的建议
 *
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { createClient } from "@/lib/supabase/server";
import { successResponse } from "@/lib/utils/api-response";
import type { ReclassifySettings } from "@/types/supabase";
import { withAuthMiddleware } from "@/lib/api/middleware";

// 默认配置
const DEFAULT_INBOX_THRESHOLD = 10; // 待整理达到 10 条时触发
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000; // 一周的毫秒数

export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const supabase = await createClient();

  // 1. 获取用户的重分类配置
  // 类型断言: 手动维护类型文件时需要此断言
  type ProfileRow = { settings: Record<string, unknown> | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = (await (supabase.from("profiles") as any)
    .select("settings")
    .eq("id", userId)
    .single()) as { data: ProfileRow | null };

  const settings = (profile?.settings as Record<string, unknown>)
    ?.reclassify as ReclassifySettings | undefined;
  const inboxThreshold =
    (settings?.inbox_threshold as number | undefined) ??
    DEFAULT_INBOX_THRESHOLD;
  const lastRunAt = settings?.last_run_at
    ? new Date(settings.last_run_at as string)
    : null;
  const autoRunWeekly = settings?.auto_run_weekly ?? true;

  // 2. 获取待整理文件夹中的书签数量
  // 类型断言: 手动维护类型文件时需要此断言
  type FolderIdRow = { id: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inboxFolder } = (await (supabase.from("folders") as any)
    .select("id")
    .eq("user_id", userId)
    .eq("is_system", true)
    .eq("system_type", "INBOX")
    .is("deleted_at", null)
    .single()) as { data: FolderIdRow | null };

  let inboxCount = 0;
  if (inboxFolder) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = (await (supabase.from("bookmarks") as any)
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("folder_id", inboxFolder.id)
      .is("deleted_at", null)) as { count: number | null };

    inboxCount = count ?? 0;
  }

  // 3. 获取待处理建议数量
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingCount } = (await (supabase.rpc as any)(
    "get_pending_suggestions_count",
    {
      p_user_id: userId,
    },
  )) as { data: number | null };

  // 4. 判断触发条件
  const now = new Date();
  const needsWeeklyRun =
    autoRunWeekly && lastRunAt
      ? now.getTime() - lastRunAt.getTime() > WEEK_IN_MS
      : false;
  const needsThresholdRun = inboxCount >= inboxThreshold;
  const shouldTrigger =
    (needsWeeklyRun || needsThresholdRun) && pendingCount === 0;

  return successResponse({
    shouldTrigger,
    hasPendingSuggestions: (pendingCount ?? 0) > 0,
    pendingSuggestionsCount: pendingCount ?? 0,
    triggers: {
      weekly: needsWeeklyRun,
      threshold: needsThresholdRun,
    },
    stats: {
      inboxCount,
      inboxThreshold,
      lastRunAt: lastRunAt?.toISOString() ?? null,
      daysSinceLastRun: lastRunAt
        ? Math.floor(
            (now.getTime() - lastRunAt.getTime()) / (24 * 60 * 60 * 1000),
          )
        : null,
    },
  });
});
