/**
 * Supabase Edge Function: generate-weekly-queue
 *
 * 每周一凌晨自动为启用 Brain-Sync 的用户生成复习队列
 *
 * 触发方式:
 * - Supabase Cron Job (每周一 00:00 UTC)
 * - 手动调用 (管理端点)
 *
 * 功能:
 * 1. 查询所有启用 Brain-Sync 的用户
 * 2. 根据用户偏好筛选待复习的 Flashcards
 * 3. 创建/更新 weekly_review_queue 记录
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
  weekly_limit: number;
  included_folder_ids: number[] | null;
  excluded_folder_ids: number[] | null;
}

interface PendingFlashcard {
  flashcard_id: number;
  priority_score: number;
}

interface GenerationResult {
  userId: string;
  success: boolean;
  queueSize: number;
  error?: string;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取本周一的日期 (UTC)
 */
function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1); // 周日调整到上周一
  const monday = new Date(now.setUTCDate(diff));
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0]; // YYYY-MM-DD
}

/**
 * 为单个用户生成周复习队列
 */
async function generateQueueForUser(
  supabase: SupabaseClient,
  prefs: ReviewPreferences,
): Promise<GenerationResult> {
  const userId = prefs.user_id;
  const weekStart = getWeekStart();

  try {
    // 1. 获取待复习的 Flashcards
    const { data: pendingFlashcards, error: fetchError } = await supabase.rpc(
      "get_pending_flashcards",
      {
        p_user_id: userId,
        p_limit: prefs.weekly_limit,
        p_included_folders: prefs.included_folder_ids,
        p_excluded_folders: prefs.excluded_folder_ids,
      },
    );

    if (fetchError) {
      return {
        userId,
        success: false,
        queueSize: 0,
        error: fetchError.message,
      };
    }

    const flashcardIds = (pendingFlashcards || []).map(
      (fc: PendingFlashcard) => fc.flashcard_id,
    );

    // 2. 检查是否已存在本周队列
    const { data: existingQueue } = await supabase
      .from("weekly_review_queue")
      .select("id")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .single();

    if (existingQueue) {
      // 更新现有队列
      const { error: updateError } = await supabase
        .from("weekly_review_queue")
        .update({
          flashcard_ids: flashcardIds,
          total_count: flashcardIds.length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingQueue.id);

      if (updateError) {
        return {
          userId,
          success: false,
          queueSize: 0,
          error: updateError.message,
        };
      }
    } else {
      // 创建新队列
      const { error: insertError } = await supabase
        .from("weekly_review_queue")
        .insert({
          user_id: userId,
          week_start: weekStart,
          flashcard_ids: flashcardIds,
          completed_ids: [],
          total_count: flashcardIds.length,
          completed_count: 0,
        });

      if (insertError) {
        return {
          userId,
          success: false,
          queueSize: 0,
          error: insertError.message,
        };
      }
    }

    return {
      userId,
      success: true,
      queueSize: flashcardIds.length,
    };
  } catch (error) {
    return {
      userId,
      success: false,
      queueSize: 0,
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

    // 1. 获取所有启用 Brain-Sync 的用户
    const { data: enabledUsers, error: queryError } = await supabase
      .from("review_preferences")
      .select(
        "user_id, enabled, weekly_limit, included_folder_ids, excluded_folder_ids",
      )
      .eq("enabled", true);

    if (queryError) {
      throw new Error(`Failed to query preferences: ${queryError.message}`);
    }

    if (!enabledUsers || enabledUsers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users with Brain-Sync enabled",
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

    // 2. 为每个用户生成队列
    const results: GenerationResult[] = [];
    for (const prefs of enabledUsers) {
      const result = await generateQueueForUser(
        supabase,
        prefs as ReviewPreferences,
      );
      results.push(result);
    }

    // 3. 统计结果
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const totalFlashcards = results.reduce((sum, r) => sum + r.queueSize, 0);

    console.log(
      `Weekly queue generation: ${successCount} success, ${failCount} failed, ${totalFlashcards} total flashcards`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        weekStart: getWeekStart(),
        summary: {
          usersProcessed: enabledUsers.length,
          successCount,
          failCount,
          totalFlashcards,
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
        error: error instanceof Error ? error.message : "生成周复习队列失败",
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
