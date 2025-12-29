/**
 * Supabase Edge Function: send-review-reminder
 *
 * 根据用户偏好时间发送复习提醒
 *
 * 触发方式:
 * - Supabase Cron Job (每小时运行一次，检查是否有用户需要提醒)
 * - 手动调用 (管理端点)
 *
 * 功能:
 * 1. 查询在当前小时需要提醒的用户
 * 2. 检查用户是否有待复习的卡片
 * 3. 发送推送通知 (通过 Web Push 或第三方服务)
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// 类型定义
// ============================================

interface ReviewPreferences {
  user_id: string;
  enabled: boolean;
  preferred_day: string;
  preferred_time: string;
  timezone: string;
  notification_channel: "sidebar" | "push" | "both" | "none";
}

interface PendingReviewInfo {
  userId: string;
  pendingCount: number;
  overdueCount: number;
}

interface NotificationResult {
  userId: string;
  success: boolean;
  channel: string;
  error?: string;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取当前星期几 (英文小写)
 */
function getCurrentDay(): string {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const now = new Date();
  return days[now.getUTCDay()];
}

/**
 * 获取当前小时 (HH:00 格式)
 */
function getCurrentHour(): string {
  const now = new Date();
  const hour = now.getUTCHours().toString().padStart(2, "0");
  return `${hour}:00`;
}

/**
 * 检查用户是否应该在当前时间收到提醒
 */
function shouldNotifyUser(prefs: ReviewPreferences): boolean {
  // 检查通知渠道
  if (prefs.notification_channel === "none") {
    return false;
  }

  // 检查星期
  const currentDay = getCurrentDay();
  if (prefs.preferred_day !== currentDay) {
    return false;
  }

  // 检查时间 (简化处理，只比较小时)
  const currentHour = getCurrentHour();
  const prefHour = prefs.preferred_time.substring(0, 5); // HH:MM -> HH:00

  // 如果偏好时间的小时与当前小时匹配
  if (prefHour.substring(0, 2) === currentHour.substring(0, 2)) {
    return true;
  }

  return false;
}

/**
 * 获取用户待复习信息
 */
async function getPendingReviewInfo(
  supabase: SupabaseClient,
  userId: string,
): Promise<PendingReviewInfo> {
  const { data, error } = await supabase.rpc("get_pending_flashcards", {
    p_user_id: userId,
    p_limit: 100,
  });

  if (error || !data) {
    return { userId, pendingCount: 0, overdueCount: 0 };
  }

  const pendingCount = data.length;
  const overdueCount = data.filter(
    (fc: { days_overdue: number }) => fc.days_overdue > 0,
  ).length;

  return { userId, pendingCount, overdueCount };
}

/**
 * 发送通知 (当前仅记录日志，实际实现需要接入推送服务)
 */
async function sendNotification(
  supabase: SupabaseClient,
  userId: string,
  prefs: ReviewPreferences,
  info: PendingReviewInfo,
): Promise<NotificationResult> {
  const channel = prefs.notification_channel;

  // 构建通知内容
  const title = "📚 复习提醒";
  let body = "";

  if (info.overdueCount > 0) {
    body = `你有 ${info.overdueCount} 张卡片已逾期，${info.pendingCount} 张待复习。快来复习吧！`;
  } else {
    body = `你有 ${info.pendingCount} 张卡片待复习。保持学习节奏！`;
  }

  try {
    if (channel === "sidebar" || channel === "both") {
      // 侧边栏提醒：插入到 notifications 表 (如果存在)
      // 这里使用 profiles 表的扩展字段记录
      await supabase
        .from("profiles")
        .update({
          brain_sync_reminder: {
            pending_count: info.pendingCount,
            overdue_count: info.overdueCount,
            reminder_at: new Date().toISOString(),
            title,
            body,
          },
        })
        .eq("id", userId);
    }

    if (channel === "push" || channel === "both") {
      // Web Push 通知：需要接入 Web Push 服务
      // 当前仅记录日志，实际实现需要：
      // 1. 从 profiles 获取用户的 push subscription
      // 2. 使用 web-push 库发送通知
      console.log(`[Push] Would send to ${userId}: ${title} - ${body}`);

      // TODO: 实现 Web Push
      // const pushSubscription = await getUserPushSubscription(supabase, userId);
      // if (pushSubscription) {
      //   await sendWebPush(pushSubscription, { title, body });
      // }
    }

    return {
      userId,
      success: true,
      channel,
    };
  } catch (error) {
    return {
      userId,
      success: false,
      channel,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================
// Edge Function 入口
// ============================================

serve(async (req) => {
  // CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // 只接受 POST 请求
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    // 初始化 Supabase 客户端 (使用 Service Role Key)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. 获取所有启用 Brain-Sync 且需要通知的用户
    const { data: allPrefs, error: queryError } = await supabase
      .from("review_preferences")
      .select(
        "user_id, enabled, preferred_day, preferred_time, timezone, notification_channel",
      )
      .eq("enabled", true)
      .neq("notification_channel", "none");

    if (queryError) {
      throw new Error(`Failed to query preferences: ${queryError.message}`);
    }

    if (!allPrefs || allPrefs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users to notify",
          results: [],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // 2. 筛选当前时间需要通知的用户
    const usersToNotify = allPrefs.filter((prefs) =>
      shouldNotifyUser(prefs as ReviewPreferences),
    );

    if (usersToNotify.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users scheduled for notification at this time",
          currentDay: getCurrentDay(),
          currentHour: getCurrentHour(),
          totalEnabled: allPrefs.length,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // 3. 为每个用户发送通知
    const results: NotificationResult[] = [];
    for (const prefs of usersToNotify) {
      const typedPrefs = prefs as ReviewPreferences;

      // 获取待复习信息
      const info = await getPendingReviewInfo(supabase, typedPrefs.user_id);

      // 如果没有待复习的卡片，跳过
      if (info.pendingCount === 0) {
        results.push({
          userId: typedPrefs.user_id,
          success: true,
          channel: "skipped",
        });
        continue;
      }

      // 发送通知
      const result = await sendNotification(
        supabase,
        typedPrefs.user_id,
        typedPrefs,
        info,
      );
      results.push(result);
    }

    // 4. 统计结果
    const sentCount = results.filter(
      (r) => r.success && r.channel !== "skipped",
    ).length;
    const skippedCount = results.filter((r) => r.channel === "skipped").length;
    const failedCount = results.filter((r) => !r.success).length;

    console.log(
      `Review reminders: ${sentCount} sent, ${skippedCount} skipped (no cards), ${failedCount} failed`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        currentDay: getCurrentDay(),
        currentHour: getCurrentHour(),
        summary: {
          totalEnabled: allPrefs.length,
          scheduledNow: usersToNotify.length,
          sent: sentCount,
          skipped: skippedCount,
          failed: failedCount,
        },
        results,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    console.error("Edge function error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "发送复习提醒失败",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
