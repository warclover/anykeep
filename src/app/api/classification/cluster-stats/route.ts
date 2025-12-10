/**
 * GET /api/classification/cluster-stats
 * 获取用户的聚类统计信息
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v42Table, v42Rpc, asV42Bookmark, type BookmarkV42Fields } from "@/lib/supabase/v42-types";

export async function GET() {
  try {
    const supabase = await createClient();

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 });
    }

    // 使用 RPC 获取聚类统计
    // Note: get_user_cluster_stats 函数类型尚未在 supabase.ts 中定义
    const { data, error } = await v42Rpc(supabase).rpc("get_user_cluster_stats", {
      p_user_id: user.id,
    });

    if (error) {
      console.error("[API] cluster-stats RPC error:", error);
      // 如果 RPC 不存在，回退到直接查询
      const { data: fallbackData, error: fallbackError } = await v42Table(supabase)
        .from("bookmarks")
        .select("id, pending_cluster, pending_since, cluster_id")
        .eq("user_id", user.id)
        .eq("pending_cluster", true)
        .is("deleted_at", null);

      if (fallbackError) {
        return NextResponse.json(
          { error: "获取统计失败" },
          { status: 500 },
        );
      }

      const bookmarks = (fallbackData || []) as Array<{ id: number } & BookmarkV42Fields>;
      const totalPending = bookmarks.length;
      const clusteredCount = bookmarks.filter((b) => b.cluster_id).length;
      const unclusteredCount = totalPending - clusteredCount;
      const clusterIds = new Set(
        bookmarks.filter((b) => b.cluster_id).map((b) => b.cluster_id),
      );
      const clusterCount = clusterIds.size;
      const oldestPending = bookmarks.reduce((oldest: string | null, b) => {
        if (!b.pending_since) return oldest;
        if (!oldest) return b.pending_since;
        return new Date(b.pending_since) < new Date(oldest)
          ? b.pending_since
          : oldest;
      }, null);

      return NextResponse.json({
        success: true,
        data: {
          totalPending,
          clusteredCount,
          unclusteredCount,
          clusterCount,
          oldestPending,
        },
      });
    }

    // RPC 返回的是数组，取第一个元素
    const stats = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      success: true,
      data: {
        totalPending: stats?.total_pending || 0,
        clusteredCount: stats?.clustered_count || 0,
        unclusteredCount: stats?.unclustered_count || 0,
        clusterCount: stats?.cluster_count || 0,
        oldestPending: stats?.oldest_pending || null,
      },
    });
  } catch (error) {
    console.error("[API] cluster-stats error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取统计失败",
      },
      { status: 500 },
    );
  }
}
