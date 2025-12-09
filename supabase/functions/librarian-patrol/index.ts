/**
 * Edge Function: librarian-patrol
 * V4.0 整理大师主动巡检定时任务
 *
 * 功能：
 * 1. 批量巡检活跃用户
 * 2. 检测失效链接
 * 3. 检测长期未访问书签
 * 4. 生成巡检报告
 *
 * 触发方式：
 * 1. pg_cron 定时任务（每两周运行一次，周日 03:00）
 * 2. 手动触发（POST /api/maintenance/trigger?task=librarian-patrol）
 *
 * 配置：
 * - MAX_USERS_PER_RUN: 每次执行最大用户数
 * - LINK_CHECK_CONCURRENCY: 链接检测并发数
 * - LINK_CHECK_TIMEOUT_MS: 链接检测超时时间
 * - STALE_DAYS_THRESHOLD: 陈旧书签天数阈值
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 配置常量
const CONFIG = {
  MAX_USERS_PER_RUN: 50,
  LINK_CHECK_CONCURRENCY: 5,
  LINK_CHECK_TIMEOUT_MS: 5000,
  LINK_CHECK_BATCH_SIZE: 20,
  STALE_DAYS_THRESHOLD: 90,
  ACTIVE_USER_CRITERIA: {
    lastActivityDays: 30,
    minBookmarks: 10,
    minFolders: 2,
  },
};

interface PatrolStats {
  processedUsers: number;
  successfulPatrols: number;
  failedPatrols: number;
  totalBrokenLinks: number;
  totalStaleBookmarks: number;
  avgHealthScore: number;
  errors: string[];
}

interface BrokenLink {
  bookmarkId: number;
  title: string;
  url: string;
  statusCode: number;
  errorMessage?: string;
}

interface StaleBookmark {
  bookmarkId: number;
  title: string;
  url: string;
  folderName: string | null;
  daysSinceAccess: number;
}

interface UserPatrolResult {
  userId: string;
  overallScore: number;
  totalIssues: number;
  brokenLinks: BrokenLink[];
  staleBookmarks: StaleBookmark[];
  success: boolean;
  error?: string;
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

    console.log("[librarian-patrol] Starting patrol job...");

    // 2. 获取活跃用户列表
    const activeUsers = await getActiveUsers(supabaseClient);

    console.log(`[librarian-patrol] Found ${activeUsers.length} active users`);

    if (activeUsers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active users to patrol",
          stats: {
            processedUsers: 0,
            successfulPatrols: 0,
            failedPatrols: 0,
            totalBrokenLinks: 0,
            totalStaleBookmarks: 0,
            avgHealthScore: 0,
            errors: [],
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // 3. 逐个巡检用户
    const results: UserPatrolResult[] = [];
    const errors: string[] = [];

    for (const userId of activeUsers) {
      try {
        const result = await patrolUser(supabaseClient, userId);
        results.push(result);
        console.log(
          `[librarian-patrol] User ${userId}: score=${result.overallScore}, issues=${result.totalIssues}`,
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`User ${userId}: ${errorMsg}`);
        results.push({
          userId,
          overallScore: 0,
          totalIssues: 0,
          brokenLinks: [],
          staleBookmarks: [],
          success: false,
          error: errorMsg,
        });
        console.error(
          `[librarian-patrol] Error patrolling user ${userId}:`,
          errorMsg,
        );
      }
    }

    // 4. 计算统计信息
    const successfulResults = results.filter((r) => r.success);
    const stats: PatrolStats = {
      processedUsers: results.length,
      successfulPatrols: successfulResults.length,
      failedPatrols: results.length - successfulResults.length,
      totalBrokenLinks: successfulResults.reduce(
        (sum, r) => sum + r.brokenLinks.length,
        0,
      ),
      totalStaleBookmarks: successfulResults.reduce(
        (sum, r) => sum + r.staleBookmarks.length,
        0,
      ),
      avgHealthScore:
        successfulResults.length > 0
          ? Math.round(
              successfulResults.reduce((sum, r) => sum + r.overallScore, 0) /
                successfulResults.length,
            )
          : 0,
      errors,
    };

    console.log("[librarian-patrol] Patrol completed:", stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Patrol completed for ${stats.processedUsers} users`,
        stats,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("[librarian-patrol] Fatal error:", error);
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

/**
 * 获取活跃用户列表
 */
// deno-lint-ignore no-explicit-any
async function getActiveUsers(supabase: any): Promise<string[]> {
  const { lastActivityDays, minBookmarks, minFolders } =
    CONFIG.ACTIVE_USER_CRITERIA;

  const cutoffDate = new Date(
    Date.now() - lastActivityDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  // 查询最近有活动的用户（启用了巡检通知）
  const { data: recentUsers, error } = await supabase
    .from("bookmarks")
    .select("user_id")
    .gte("created_at", cutoffDate)
    .is("deleted_at", null);

  if (error) {
    console.error("[librarian-patrol] Error fetching active users:", error);
    return [];
  }

  // 去重
  const uniqueUserIds = [
    ...new Set((recentUsers || []).map((u: { user_id: string }) => u.user_id)),
  ];

  // 过滤：检查书签和文件夹数量以及通知偏好
  const qualifiedUsers: string[] = [];

  for (const userId of uniqueUserIds.slice(0, CONFIG.MAX_USERS_PER_RUN)) {
    // 检查用户的通知偏好
    const { data: profile } = await supabase
      .from("profiles")
      .select("patrol_notification_enabled, patrol_frequency")
      .eq("id", userId)
      .single();

    // 跳过禁用通知的用户
    if (profile && profile.patrol_notification_enabled === false) {
      continue;
    }

    // 跳过频率为 "never" 的用户
    if (profile && profile.patrol_frequency === "never") {
      continue;
    }

    const [bookmarkCount, folderCount] = await Promise.all([
      supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null),
      supabase
        .from("folders")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null)
        .eq("is_system", false),
    ]);

    if (
      (bookmarkCount.count || 0) >= minBookmarks &&
      (folderCount.count || 0) >= minFolders
    ) {
      qualifiedUsers.push(userId as string);
    }
  }

  return qualifiedUsers;
}

/**
 * 执行单用户巡检
 */
// deno-lint-ignore no-explicit-any
async function patrolUser(
  supabase: any,
  userId: string,
): Promise<UserPatrolResult> {
  // 1. 检测失效链接
  const brokenLinks = await detectBrokenLinks(supabase, userId);

  // 2. 检测陈旧书签
  const staleBookmarks = await detectStaleBookmarks(supabase, userId);

  // 3. 获取基础健康分数（简化版，不调用完整的 AI Librarian）
  const healthScore = await calculateSimpleHealthScore(supabase, userId);

  // 4. 计算综合分数
  let overallScore = healthScore;
  overallScore -= brokenLinks.length * 3; // 每个失效链接扣 3 分
  overallScore -= staleBookmarks.length * 1; // 每个陈旧书签扣 1 分
  overallScore = Math.max(0, Math.min(100, overallScore));

  const totalIssues = brokenLinks.length + staleBookmarks.length;

  // 5. 保存报告
  const reportId = `patrol-${userId}-${Date.now()}`;
  await supabase.from("patrol_reports").insert({
    id: reportId,
    user_id: userId,
    overall_score: overallScore,
    total_issues: totalIssues,
    broken_links_count: brokenLinks.length,
    stale_bookmarks_count: staleBookmarks.length,
    report_data: {
      baseAnalysis: { healthScore },
      brokenLinks,
      staleBookmarks,
    },
    report_period: "biweekly",
    generated_at: new Date().toISOString(),
  });

  return {
    userId,
    overallScore,
    totalIssues,
    brokenLinks,
    staleBookmarks,
    success: true,
  };
}

/**
 * 检测失效链接
 */
// deno-lint-ignore no-explicit-any
async function detectBrokenLinks(
  supabase: any,
  userId: string,
): Promise<BrokenLink[]> {
  // 获取需要检测的书签（随机采样）
  const { data: bookmarks, error } = await supabase
    .from("bookmarks")
    .select("id, title, url")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("url", "is", null)
    .limit(CONFIG.LINK_CHECK_BATCH_SIZE);

  if (error || !bookmarks) {
    return [];
  }

  const brokenLinks: BrokenLink[] = [];

  // 并发检测
  const checkPromises = bookmarks.map(
    async (bookmark: { id: number; title: string; url: string }) => {
      try {
        const result = await checkLink(bookmark.url);
        if (!result.isValid) {
          return {
            bookmarkId: bookmark.id,
            title: bookmark.title,
            url: bookmark.url,
            statusCode: result.statusCode,
            errorMessage: result.errorMessage,
          };
        }
        return null;
      } catch {
        return null;
      }
    },
  );

  const results = await Promise.allSettled(checkPromises);

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      brokenLinks.push(result.value);
    }
  }

  return brokenLinks;
}

/**
 * 检测单个链接
 */
async function checkLink(
  url: string,
): Promise<{ isValid: boolean; statusCode: number; errorMessage?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      CONFIG.LINK_CHECK_TIMEOUT_MS,
    );

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    const isValid = response.status >= 200 && response.status < 400;

    return {
      isValid,
      statusCode: response.status,
      errorMessage: isValid ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      isValid: false,
      statusCode: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 检测陈旧书签
 */
// deno-lint-ignore no-explicit-any
async function detectStaleBookmarks(
  supabase: any,
  userId: string,
): Promise<StaleBookmark[]> {
  const cutoffDate = new Date(
    Date.now() - CONFIG.STALE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("bookmarks")
    .select(
      `
      id,
      title,
      url,
      created_at,
      last_accessed_at,
      folders (name)
    `,
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or(`last_accessed_at.is.null,last_accessed_at.lt.${cutoffDate}`)
    .lt("created_at", cutoffDate)
    .limit(20);

  if (error || !data) {
    return [];
  }

  const now = new Date();

  return data.map(
    (bookmark: {
      id: number;
      title: string;
      url: string;
      created_at: string;
      last_accessed_at: string | null;
      folders: { name: string } | null;
    }) => {
      const lastAccessed = bookmark.last_accessed_at
        ? new Date(bookmark.last_accessed_at)
        : null;
      const created = new Date(bookmark.created_at);

      const daysSinceAccess = lastAccessed
        ? Math.floor(
            (now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24),
          )
        : Math.floor(
            (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
          );

      return {
        bookmarkId: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        folderName: bookmark.folders?.name || null,
        daysSinceAccess,
      };
    },
  );
}

/**
 * 计算简化版健康分数
 */
// deno-lint-ignore no-explicit-any
async function calculateSimpleHealthScore(
  supabase: any,
  userId: string,
): Promise<number> {
  let score = 100;

  // 获取文件夹统计
  const { data: folders, error: foldersError } = await supabase
    .from("folders")
    .select("id, name, parent_id")
    .eq("user_id", userId)
    .eq("is_system", false)
    .is("deleted_at", null);

  if (foldersError || !folders) {
    return score;
  }

  // 获取书签数量
  const { count: totalBookmarks } = await supabase
    .from("bookmarks")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);

  // 检查空文件夹
  const emptyFolders: string[] = [];
  for (const folder of folders) {
    const { count } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("folder_id", folder.id)
      .is("deleted_at", null);

    if (count === 0) {
      emptyFolders.push(folder.name);
    }
  }

  // 空文件夹扣分（每个扣 2 分）
  score -= emptyFolders.length * 2;

  // 检查文件夹数量是否合理
  if (folders.length > 0 && totalBookmarks && totalBookmarks > 0) {
    const avgPerFolder = totalBookmarks / folders.length;

    // 平均每个文件夹超过 50 个书签扣分
    if (avgPerFolder > 50) {
      score -= 10;
    }

    // 平均每个文件夹少于 2 个书签扣分
    if (avgPerFolder < 2) {
      score -= 5;
    }
  }

  return Math.max(0, Math.min(100, score));
}
