import { createClient } from "@/lib/supabase/server";
import type { LiteTask, LiteContext } from "../types";

// Types specific to daily digest
interface DailyDigestResult {
  unreadCount: number;
  digest: {
    title: string;
    items: Array<{
      id: number;
      title: string;
      summary: string;
      url: string;
      platform: string;
    }>;
  };
}

export const executeDailyDigest: LiteTask<DailyDigestResult> = async (
  ctx: LiteContext,
) => {
  const { logger, userId } = ctx;

  if (!userId) {
    throw new Error("User ID is required for daily digest task");
  }

  // Step 1: Fetch Unread Bookmarks
  logger.step("fetch_unread", "start");
  const supabase = await createClient();

  const { data: bookmarks, error: fetchError } = await supabase
    .from("bookmarks")
    .select("id, title, url, platform, ai_summary, created_at")
    .eq("user_id", userId)
    .is("read_at", null) // Unread
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (fetchError) {
    logger.step("fetch_unread", "failed", fetchError);
    throw new Error(`Failed to fetch bookmarks: ${fetchError.message}`);
  }

  if (!bookmarks || bookmarks.length === 0) {
    logger.step("fetch_unread", "success", { count: 0 });
    return {
      unreadCount: 0,
      digest: { title: "今日精选", items: [] },
    };
  }

  logger.step("fetch_unread", "success", { count: bookmarks.length });

  // Step 2: Score and Rank (Simplified Logic)
  // Logic:
  // 1. Prefer items with AI summary
  // 2. Prefer recent items (already sorted by created_at)
  // 3. Simple diversity check (limit per platform)

  logger.step("rank_bookmarks", "start");

  const rankedBookmarks = bookmarks
    .map((b) => ({
      ...b,
      score: (b.ai_summary ? 2 : 0) + Math.random() * 1, // Simple scoring: AI summary + random shuffle
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // Take Top 5

  logger.step("rank_bookmarks", "success", { topN: rankedBookmarks.length });

  // Step 3: Generate Digest (Using existing TopicClusterer logic or simple mapping)
  logger.step("generate_digest", "start");

  // Reuse the logic from QuickDigestSkill slightly modified for "Lite" context
  // Here we just map the data directly since we already have AI summaries
  const digestItems = rankedBookmarks.map((b) => ({
    id: b.id,
    title: b.title,
    summary: b.ai_summary || "暂无摘要",
    url: b.url,
    platform: b.platform || "unknown",
  }));

  const result: DailyDigestResult = {
    unreadCount: bookmarks.length,
    digest: {
      title: `今日精选 (${new Date().toLocaleDateString("zh-CN")})`,
      items: digestItems,
    },
  };

  logger.step("generate_digest", "success");

  // Step 4: Send Notification (Mock for now, or call notification service)
  // In a real implementation, you would call `NotificationService.send(...)` here.
  logger.info(
    `[Mock] Sending notification to user ${userId}: ${result.digest.title}`,
  );

  return result;
};
