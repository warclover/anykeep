/**
 * Edge Function: cleanup-trash
 * 每月自动清理超过 30 天的垃圾箱项目
 *
 * 触发方式：
 * 1. pg_cron 定时任务（每月1日 02:00）
 * 2. 手动触发（POST /api/maintenance/trigger）
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CleanupStats {
  totalDeleted: number;
  usersAffected: number;
  errors: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. 创建 Supabase 客户端（使用服务角色密钥）
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    console.log("[cleanup-trash] Starting cleanup job...");

    // 2. 计算 30 天前的时间戳
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    console.log(
      `[cleanup-trash] Deleting items trashed before: ${thirtyDaysAgoISO}`,
    );

    // 3. 查找需要删除的收藏（超过 30 天）
    const { data: itemsToDelete, error: fetchError } = await supabaseClient
      .from("bookmarks")
      .select("id, user_id")
      .eq("is_in_trash", true)
      .lt("trashed_at", thirtyDaysAgoISO)
      .is("deleted_at", null); // 仅查找未永久删除的项目

    if (fetchError) {
      console.error("[cleanup-trash] Error fetching items:", fetchError);
      throw new Error(`Failed to fetch items: ${fetchError.message}`);
    }

    if (!itemsToDelete || itemsToDelete.length === 0) {
      console.log("[cleanup-trash] No items to delete");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No items to delete",
          stats: {
            totalDeleted: 0,
            usersAffected: 0,
            errors: [],
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    console.log(
      `[cleanup-trash] Found ${itemsToDelete.length} items to delete`,
    );

    // 4. 永久删除（设置 deleted_at）
    const idsToDelete = itemsToDelete.map((item) => item.id);
    const { error: deleteError } = await supabaseClient
      .from("bookmarks")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .in("id", idsToDelete);

    if (deleteError) {
      console.error("[cleanup-trash] Error deleting items:", deleteError);
      throw new Error(`Failed to delete items: ${deleteError.message}`);
    }

    console.log(`[cleanup-trash] Deleted ${idsToDelete.length} items`);

    // 5. 统计每个用户删除的数量
    const userDeleteCounts = new Map<string, number>();
    for (const item of itemsToDelete) {
      const count = userDeleteCounts.get(item.user_id) || 0;
      userDeleteCounts.set(item.user_id, count + 1);
    }

    console.log(`[cleanup-trash] Affected ${userDeleteCounts.size} users`);

    // 6. 更新每个用户的 storage_count
    const updateErrors: string[] = [];
    for (const [userId, count] of userDeleteCounts.entries()) {
      const { error: updateError } = await supabaseClient.rpc(
        "decrement_storage_count",
        {
          user_id: userId,
          count_to_decrement: count,
        },
      );

      if (updateError) {
        console.error(
          `[cleanup-trash] Error updating storage count for user ${userId}:`,
          updateError,
        );
        updateErrors.push(`User ${userId}: ${updateError.message}`);
      }
    }

    // 7. 更新所有受影响用户的 last_trash_cleanup_at
    const affectedUserIds = Array.from(userDeleteCounts.keys());
    const { error: profileUpdateError } = await supabaseClient
      .from("profiles")
      .update({
        last_trash_cleanup_at: new Date().toISOString(),
      })
      .in("id", affectedUserIds);

    if (profileUpdateError) {
      console.error(
        "[cleanup-trash] Error updating profiles:",
        profileUpdateError,
      );
      updateErrors.push(`Profile update: ${profileUpdateError.message}`);
    }

    // 8. 返回统计信息
    const stats: CleanupStats = {
      totalDeleted: itemsToDelete.length,
      usersAffected: userDeleteCounts.size,
      errors: updateErrors,
    };

    console.log("[cleanup-trash] Cleanup completed:", stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully deleted ${stats.totalDeleted} items`,
        stats,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("[cleanup-trash] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
