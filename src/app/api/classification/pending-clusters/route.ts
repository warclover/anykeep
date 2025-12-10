/**
 * V4.2 待聚类书签 API
 * GET /api/classification/pending-clusters - 获取待聚类书签和聚类建议
 * POST /api/classification/pending-clusters - 确认或拒绝聚类建议
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeParseJson } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

interface ClusterGroup {
  clusterId: string;
  bookmarks: {
    id: number;
    title: string;
    url: string;
    ai_summary: string | null;
    ai_tags: string[] | null;
    pending_since: string | null;
    cluster_confidence: number | null;
  }[];
  suggestedName: string;
  confidence: number;
  commonTags: string[];
}

/**
 * GET - 获取待聚类书签和聚类建议
 */
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

    // 获取待聚类书签
    // Note: pending_cluster, pending_since, cluster_id, cluster_confidence 是 V4.2 新增字段
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from("bookmarks")
      .select(
        "id, title, url, ai_summary, ai_tags, pending_since, cluster_id, cluster_confidence",
      )
      .eq("user_id", user.id)
      .eq("pending_cluster", true)
      .is("deleted_at", null)
      .order("pending_since", { ascending: true });

    if (bookmarksError) {
      console.error("[API] pending-clusters query error:", bookmarksError);
      return NextResponse.json(
        { error: "获取待聚类书签失败" },
        { status: 500 },
      );
    }

    // 按 cluster_id 分组
    const clusterMap = new Map<string, ClusterGroup["bookmarks"]>();
    const unclusteredBookmarks: ClusterGroup["bookmarks"] = [];

    for (const bookmark of bookmarks || []) {
      if (bookmark.cluster_id) {
        const existing = clusterMap.get(bookmark.cluster_id) || [];
        existing.push({
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          ai_summary: bookmark.ai_summary,
          ai_tags: bookmark.ai_tags,
          pending_since: bookmark.pending_since,
          cluster_confidence: bookmark.cluster_confidence,
        });
        clusterMap.set(bookmark.cluster_id, existing);
      } else {
        unclusteredBookmarks.push({
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          ai_summary: bookmark.ai_summary,
          ai_tags: bookmark.ai_tags,
          pending_since: bookmark.pending_since,
          cluster_confidence: bookmark.cluster_confidence,
        });
      }
    }

    // 生成聚类建议
    const clusters: ClusterGroup[] = [];

    for (const [clusterId, clusterBookmarks] of clusterMap) {
      // 只显示有 3 个或更多书签的聚类
      if (clusterBookmarks.length < 3) {
        // 将小聚类的书签放回未聚类列表
        unclusteredBookmarks.push(...clusterBookmarks);
        continue;
      }

      // 分析共同标签
      const tagCounts = new Map<string, number>();
      for (const bookmark of clusterBookmarks) {
        for (const tag of bookmark.ai_tags || []) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      // 找出高频标签（出现在超过 50% 书签中的标签）
      const threshold = clusterBookmarks.length * 0.5;
      const commonTags = Array.from(tagCounts.entries())
        .filter(([, count]) => count >= threshold)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);

      // 生成建议名称（使用最常见的标签）
      const suggestedName = commonTags[0] || "新文件夹";

      // 计算平均置信度
      const avgConfidence =
        clusterBookmarks.reduce(
          (sum, b) => sum + (b.cluster_confidence || 0),
          0,
        ) / clusterBookmarks.length;

      clusters.push({
        clusterId,
        bookmarks: clusterBookmarks,
        suggestedName,
        confidence: Math.round(avgConfidence * 100),
        commonTags,
      });
    }

    // 按置信度排序
    clusters.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      success: true,
      data: {
        clusters,
        unclustered: unclusteredBookmarks,
        totalPending: (bookmarks || []).length,
        clusterCount: clusters.length,
      },
    });
  } catch (error) {
    console.error("[API] pending-clusters error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "获取聚类建议失败",
      },
      { status: 500 },
    );
  }
}

/**
 * POST - 确认或拒绝聚类建议
 */
export async function POST(request: NextRequest) {
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

    const { data: body, error: parseError } = await safeParseJson(request);
    if (parseError || !body) {
      return NextResponse.json(
        { error: parseError || "请求体格式错误" },
        { status: 400 },
      );
    }
    const { action, clusterId, folderName, bookmarkIds } = body as {
      action?: string;
      clusterId?: string;
      folderName?: string;
      bookmarkIds?: number[];
    };

    if (!action || !["confirm", "reject"].includes(action)) {
      return NextResponse.json({ error: "无效的操作类型" }, { status: 400 });
    }

    if (action === "confirm") {
      if (!folderName || !bookmarkIds?.length) {
        return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
      }

      // 创建新文件夹
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .insert({
          user_id: user.id,
          name: folderName,
          is_system: false,
        })
        .select()
        .single();

      if (folderError) {
        console.error("[API] create folder error:", folderError);
        return NextResponse.json({ error: "创建文件夹失败" }, { status: 500 });
      }

      // 更新书签：移动到新文件夹并清除聚类标记
      // Note: pending_cluster, pending_since, cluster_id, cluster_confidence 是 V4.2 新增字段
      const { error: updateError } = await supabase
        .from("bookmarks")
        .update({
          folder_id: folder.id,
          pending_cluster: false,
          pending_since: null,
          cluster_id: null,
          cluster_confidence: null,
        })
        .eq("user_id", user.id)
        .in("id", bookmarkIds);

      if (updateError) {
        console.error("[API] update bookmarks error:", updateError);
        return NextResponse.json({ error: "移动书签失败" }, { status: 500 });
      }

      // 记录操作快照（用于撤销）
      // Note: operation_snapshots 是 V4.2 新增表
      try {
        const { error: snapshotError } = await supabase
          .from("operation_snapshots")
          .insert({
            user_id: user.id,
            action: "folder_create",
            description: `创建文件夹「${folderName}」并移动 ${bookmarkIds.length} 个书签`,
            before_state: {
              bookmarks: bookmarkIds.map((id: number) => ({
                id,
                folder_id: null,
              })),
            },
            after_state: {
              folder: { id: folder.id, name: folderName },
              bookmarks: bookmarkIds,
            },
            expires_at: new Date(
              Date.now() + 48 * 60 * 60 * 1000,
            ).toISOString(), // 48小时后过期
          });

        if (snapshotError) {
          logger.warn(
            { error: snapshotError.message },
            "[API] snapshot creation warning",
          );
        }
      } catch (snapshotErr) {
        logger.warn(
          {
            error:
              snapshotErr instanceof Error
                ? snapshotErr.message
                : String(snapshotErr),
          },
          "[API] snapshot creation failed",
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          folder,
          movedCount: bookmarkIds.length,
        },
      });
    }

    if (action === "reject") {
      if (!clusterId && !bookmarkIds?.length) {
        return NextResponse.json(
          { error: "缺少聚类ID或书签ID" },
          { status: 400 },
        );
      }

      // 清除聚类标记但保留 pending_cluster 状态
      // Note: cluster_id, cluster_confidence 是 V4.2 新增字段
      const query = supabase
        .from("bookmarks")
        .update({
          cluster_id: null,
          cluster_confidence: null,
        })
        .eq("user_id", user.id);

      if (clusterId) {
        query.eq("cluster_id", clusterId);
      } else if (bookmarkIds?.length) {
        query.in("id", bookmarkIds);
      }

      const { error: rejectError } = await query;

      if (rejectError) {
        console.error("[API] reject cluster error:", rejectError);
        return NextResponse.json(
          { error: "拒绝聚类建议失败" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        message: "已拒绝该聚类建议",
      });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error) {
    console.error("[API] pending-clusters POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "操作失败",
      },
      { status: 500 },
    );
  }
}
