/**
 * RSS Feed 动态路由
 *
 * @description 根据 feedToken 返回用户的 RSS Feed
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RssFeedAdapter } from "@/lib/distribution/adapters/rss.adapter";
import type {
  RssTargetConfig,
  DistributionTarget,
} from "@/lib/distribution/types";
import type { BookmarkRow } from "@/types/domain";
import { logger } from "@/lib/logger";

/**
 * 分发目标数据库行类型
 */
interface DistributionTargetRow {
  id: string;
  user_id: string;
  target_type: string;
  name: string;
  enabled: boolean;
  trigger_mode: string;
  schedule_interval_minutes: number | null;
  filter_platforms: string[] | null;
  filter_tags: string[] | null;
  filter_folders: string[] | null;
  target_config: Record<string, unknown>;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
  synced_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * RSS Feed 需要的书签字段
 */
type RssBookmarkRow = Pick<
  BookmarkRow,
  | "id"
  | "title"
  | "url"
  | "platform"
  | "description"
  | "ai_summary"
  | "ai_tags"
  | "user_tags"
  | "created_at"
  | "updated_at"
>;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: feedToken } = await params;

  if (!feedToken || feedToken.length < 16) {
    return NextResponse.json({ error: "无效的 Feed Token" }, { status: 400 });
  }

  const supabase = await createClient();

  // 查找对应的分发目标（使用类型断言）
  const { data: target, error: targetError } = await (supabase
    .from("distribution_targets" as "folders")
    .select("*")
    .eq("target_type", "rss")
    .eq("enabled", true)
    .filter("target_config->feedToken", "eq", feedToken)
    .single() as unknown as Promise<{
    data: DistributionTargetRow | null;
    error: { message: string } | null;
  }>);

  if (targetError || !target) {
    return NextResponse.json({ error: "Feed 不存在或已禁用" }, { status: 404 });
  }

  // 解析 URL 参数
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const platform = searchParams.get("platform");
  const tag = searchParams.get("tag");

  // 构建书签查询
  let query = supabase
    .from("bookmarks")
    .select(
      "id, title, url, platform, description, ai_summary, ai_tags, user_tags, created_at, updated_at",
    )
    .eq("user_id", target.user_id)
    .eq("is_in_trash", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  // 应用筛选条件
  if (platform) {
    query = query.eq("platform", platform);
  }
  if (tag) {
    // 在 ai_tags 或 user_tags 中搜索
    query = query.or(`ai_tags.cs.{${tag}},user_tags.cs.{${tag}}`);
  }

  // 应用目标配置的筛选条件
  if (target.filter_platforms && target.filter_platforms.length > 0) {
    query = query.in("platform", target.filter_platforms);
  }
  if (target.filter_tags && target.filter_tags.length > 0) {
    // 使用 overlaps 检查 ai_tags 或 user_tags 与筛选标签是否有交集
    query = query.or(
      `ai_tags.ov.{${target.filter_tags.join(",")}},user_tags.ov.{${target.filter_tags.join(",")}}`,
    );
  }

  const { data: bookmarks, error: bookmarksError } = await query;

  if (bookmarksError) {
    logger.error({ bookmarksError }, "Failed to fetch bookmarks for RSS:");
    return NextResponse.json({ error: "获取书签失败" }, { status: 500 });
  }

  // 转换为分发适配器格式
  const distributionBookmarks = ((bookmarks || []) as RssBookmarkRow[]).map(
    (b) => {
      // 合并 ai_tags 和 user_tags
      const allTags = [...(b.ai_tags || []), ...(b.user_tags || [])];
      const uniqueTags = [...new Set(allTags)];

      return {
        id: String(b.id),
        title: b.title || "Untitled",
        url: b.url,
        platform: b.platform || undefined,
        description: b.description || undefined,
        aiSummary: b.ai_summary || undefined,
        tags: uniqueTags,
        createdAt: new Date(b.created_at || Date.now()),
        updatedAt: new Date(b.updated_at || Date.now()),
      };
    },
  );

  // 生成 Feed
  const adapter = new RssFeedAdapter();
  const rssConfig = target.target_config as unknown as RssTargetConfig;

  const distributionTarget: DistributionTarget = {
    id: target.id,
    userId: target.user_id,
    targetType: "rss",
    name: target.name,
    enabled: target.enabled,
    trigger: {
      mode: target.trigger_mode as "realtime" | "scheduled" | "manual",
    },
    targetConfig: target.target_config,
    status: target.status as "idle" | "syncing" | "error",
    syncedCount: target.synced_count,
    createdAt: new Date(target.created_at),
    updatedAt: new Date(target.updated_at),
  };

  const feedContent =
    rssConfig.feedFormat === "atom"
      ? adapter.generateAtomFeed(distributionBookmarks, distributionTarget)
      : adapter.generateRss2Feed(distributionBookmarks, distributionTarget);

  // 返回 Feed
  const contentType =
    rssConfig.feedFormat === "atom"
      ? "application/atom+xml; charset=utf-8"
      : "application/rss+xml; charset=utf-8";

  return new NextResponse(feedContent, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300", // 5 分钟缓存
    },
  });
}
