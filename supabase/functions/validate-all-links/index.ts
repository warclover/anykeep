/**
 * Edge Function: validate-all-links
 * 每月自动验证所有收藏链接的有效性
 *
 * 触发方式：
 * 1. pg_cron 定时任务（每月1日 03:00）
 * 2. 手动触发（POST /api/maintenance/trigger）
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ========== URL 过滤逻辑（与 url-filter.ts 保持一致）==========

type Platform =
  | "WECHAT_OFFICIAL_ACCOUNT"
  | "BILIBILI"
  | "XIAOHONGSHU"
  | "BROWSER_CHROME"
  | "BROWSER_EDGE"
  | "BROWSER_FIREFOX"
  | "BROWSER_SAFARI"
  | "UNKNOWN";

/**
 * 检查 URL 是否可以被验证
 */
function isUrlValidatable(url: string, platform?: Platform | null): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // 1. 微信公众号（需要登录）
    if (
      hostname.includes("weixin.qq.com") ||
      hostname.includes("mp.weixin.qq.com")
    ) {
      return false;
    }

    // 2. 需要登录的社交平台
    const loginRequiredDomains = [
      "xiaohongshu.com",
      "xhs.com",
      "twitter.com",
      "x.com",
      "facebook.com",
      "instagram.com",
      "linkedin.com",
      "weibo.com",
      "zhihu.com",
    ];

    if (loginRequiredDomains.some((domain) => hostname.includes(domain))) {
      return false;
    }

    // 3. 非 HTTP(S) 协议
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false;
    }

    // 4. 本地/内网 IP
    if (
      hostname === "localhost" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.2") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.") ||
      hostname.startsWith("127.")
    ) {
      return false;
    }

    // 5. 特定平台检查
    if (platform === "WECHAT_OFFICIAL_ACCOUNT") {
      return false;
    }

    return true;
  } catch (error) {
    console.error(`[validate-all-links] Invalid URL: ${url}`, error);
    return false;
  }
}

/**
 * 获取跳过原因
 */
function getSkipReason(url: string, platform?: Platform | null): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (
      hostname.includes("weixin.qq.com") ||
      hostname.includes("mp.weixin.qq.com")
    ) {
      return "微信公众号链接需要登录验证";
    }

    if (hostname.includes("xiaohongshu.com") || hostname.includes("xhs.com")) {
      return "小红书链接需要登录验证";
    }

    if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      return "Twitter/X 链接需要登录验证";
    }

    if (hostname.includes("facebook.com")) {
      return "Facebook 链接需要登录验证";
    }

    if (hostname.includes("instagram.com")) {
      return "Instagram 链接需要登录验证";
    }

    if (hostname.includes("linkedin.com")) {
      return "LinkedIn 链接需要登录验证";
    }

    if (hostname.includes("weibo.com")) {
      return "微博链接需要登录验证";
    }

    if (hostname.includes("zhihu.com")) {
      return "知乎链接需要登录验证";
    }

    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return `不支持的协议: ${urlObj.protocol}`;
    }

    if (
      hostname === "localhost" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname.startsWith("127.")
    ) {
      return "本地或内网地址无法验证";
    }

    if (platform === "WECHAT_OFFICIAL_ACCOUNT") {
      return "微信公众号平台链接无法验证";
    }

    return "该链接无法自动验证";
  } catch (error) {
    return "URL 格式错误";
  }
}

// ========== URL 验证逻辑 ==========

interface ValidationResult {
  valid: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * 验证单个 URL 的有效性
 */
async function validateUrl(
  url: string,
  timeout = 5000,
): Promise<ValidationResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AnyKeep/1.0; +https://anykeep.app)",
      },
    });

    clearTimeout(timeoutId);

    // 2xx 和 3xx 状态码视为有效
    const valid = response.status >= 200 && response.status < 400;

    return {
      valid,
      statusCode: response.status,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        valid: false,
        error: "请求超时",
      };
    }

    return {
      valid: false,
      error: error instanceof Error ? error.message : "网络错误",
    };
  }
}

// ========== 主函数 ==========

interface ValidationStats {
  totalBookmarks: number;
  checked: number;
  skipped: number;
  valid: number;
  invalid: number;
  errors: number;
  duration: number;
  usersAffected: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // 1. 创建 Supabase 客户端
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

    console.log("[validate-all-links] Starting validation job...");

    // 2. 获取所有需要验证的收藏（排除垃圾箱、已删除）
    const { data: bookmarks, error: fetchError } = await supabaseClient
      .from("bookmarks")
      .select("id, url, platform, user_id")
      .is("deleted_at", null)
      .eq("is_in_trash", false)
      .limit(1000); // 限制单次验证数量，防止超时

    if (fetchError) {
      console.error(
        "[validate-all-links] Error fetching bookmarks:",
        fetchError,
      );
      throw new Error(`Failed to fetch bookmarks: ${fetchError.message}`);
    }

    if (!bookmarks || bookmarks.length === 0) {
      console.log("[validate-all-links] No bookmarks to validate");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No bookmarks to validate",
          stats: {
            totalBookmarks: 0,
            checked: 0,
            skipped: 0,
            valid: 0,
            invalid: 0,
            errors: 0,
            duration: Date.now() - startTime,
            usersAffected: 0,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    console.log(`[validate-all-links] Found ${bookmarks.length} bookmarks`);

    // 3. 智能过滤：分离可验证和不可验证的链接
    const validatableBookmarks = [];
    const skippedBookmarks = [];

    for (const bookmark of bookmarks) {
      if (isUrlValidatable(bookmark.url, bookmark.platform as Platform)) {
        validatableBookmarks.push(bookmark);
      } else {
        skippedBookmarks.push({
          id: bookmark.id,
          url: bookmark.url,
          skipReason: getSkipReason(
            bookmark.url,
            bookmark.platform as Platform,
          ),
        });
      }
    }

    console.log(
      `[validate-all-links] Validatable: ${validatableBookmarks.length}, Skipped: ${skippedBookmarks.length}`,
    );

    // 4. 批量验证（并发控制）
    const CONCURRENCY = 10;
    const validIds: number[] = [];
    const invalidIds: number[] = [];
    let errorCount = 0;

    for (let i = 0; i < validatableBookmarks.length; i += CONCURRENCY) {
      const batch = validatableBookmarks.slice(i, i + CONCURRENCY);

      const batchResults = await Promise.allSettled(
        batch.map(async (bookmark) => {
          const result = await validateUrl(bookmark.url);
          return {
            id: bookmark.id,
            valid: result.valid,
          };
        }),
      );

      for (const promiseResult of batchResults) {
        if (promiseResult.status === "fulfilled") {
          if (promiseResult.value.valid) {
            validIds.push(promiseResult.value.id);
          } else {
            invalidIds.push(promiseResult.value.id);
          }
        } else {
          errorCount++;
          console.error(
            "[validate-all-links] Batch error:",
            promiseResult.reason,
          );
        }
      }
    }

    console.log(
      `[validate-all-links] Results - Valid: ${validIds.length}, Invalid: ${invalidIds.length}, Errors: ${errorCount}`,
    );

    // 5. 更新失效状态
    if (invalidIds.length > 0) {
      const { error: updateError } = await supabaseClient
        .from("bookmarks")
        .update({
          is_invalid: true,
          invalidated_at: new Date().toISOString(),
          last_validation_at: new Date().toISOString(),
        })
        .in("id", invalidIds);

      if (updateError) {
        console.error(
          "[validate-all-links] Error updating invalid status:",
          updateError,
        );
      }
    }

    // 6. 更新有效状态（清除失效标记）
    if (validIds.length > 0) {
      const { error: updateError } = await supabaseClient
        .from("bookmarks")
        .update({
          is_invalid: false,
          invalidated_at: null,
          last_validation_at: new Date().toISOString(),
        })
        .in("id", validIds);

      if (updateError) {
        console.error(
          "[validate-all-links] Error updating valid status:",
          updateError,
        );
      }
    }

    // 7. 更新所有受影响用户的 last_validation_at
    const affectedUserIds = [...new Set(bookmarks.map((b) => b.user_id))];

    const { error: profileUpdateError } = await supabaseClient
      .from("profiles")
      .update({
        last_validation_at: new Date().toISOString(),
      })
      .in("id", affectedUserIds);

    if (profileUpdateError) {
      console.error(
        "[validate-all-links] Error updating profiles:",
        profileUpdateError,
      );
    }

    // 8. 记录验证历史（按用户分组）
    const endTime = new Date();
    const startTimeISO = new Date(startTime).toISOString();
    const endTimeISO = endTime.toISOString();

    // 按用户分组统计
    const userStatsMap = new Map<
      string,
      {
        totalBookmarks: number;
        checked: number;
        skipped: number;
        valid: number;
        invalid: number;
        skippedReasons: Record<string, number>;
        invalidBookmarks: any[];
      }
    >();

    // 初始化用户统计
    for (const userId of affectedUserIds) {
      userStatsMap.set(userId, {
        totalBookmarks: 0,
        checked: 0,
        skipped: 0,
        valid: 0,
        invalid: 0,
        skippedReasons: {},
        invalidBookmarks: [],
      });
    }

    // 统计每个用户的书签总数
    for (const bookmark of bookmarks) {
      const stats = userStatsMap.get(bookmark.user_id);
      if (stats) {
        stats.totalBookmarks++;
      }
    }

    // 统计每个用户的可验证数量
    for (const bookmark of validatableBookmarks) {
      const stats = userStatsMap.get(bookmark.user_id);
      if (stats) {
        stats.checked++;
      }
    }

    // 统计每个用户的跳过数量和原因
    for (const skipped of skippedBookmarks) {
      const bookmark = bookmarks.find((b) => b.id === skipped.id);
      if (bookmark) {
        const stats = userStatsMap.get(bookmark.user_id);
        if (stats) {
          stats.skipped++;
          stats.skippedReasons[skipped.skipReason] =
            (stats.skippedReasons[skipped.skipReason] || 0) + 1;
        }
      }
    }

    // 统计每个用户的有效和失效数量
    for (const id of validIds) {
      const bookmark = bookmarks.find((b) => b.id === id);
      if (bookmark) {
        const stats = userStatsMap.get(bookmark.user_id);
        if (stats) {
          stats.valid++;
        }
      }
    }

    for (const id of invalidIds) {
      const bookmark = bookmarks.find((b) => b.id === id);
      if (bookmark) {
        const stats = userStatsMap.get(bookmark.user_id);
        if (stats) {
          stats.invalid++;
          stats.invalidBookmarks.push({
            id: bookmark.id,
            url: bookmark.url,
          });
        }
      }
    }

    // 为每个用户插入验证历史记录
    const historyInserts = Array.from(userStatsMap.entries()).map(
      ([userId, stats]) => ({
        user_id: userId,
        total_bookmarks: stats.totalBookmarks,
        total_checked: stats.checked,
        skipped_count: stats.skipped,
        valid_count: stats.valid,
        invalid_count: stats.invalid,
        error_count: 0,
        duration_ms: Date.now() - startTime,
        average_response_time_ms:
          stats.checked > 0
            ? Math.round((Date.now() - startTime) / stats.checked)
            : 0,
        invalid_bookmarks: stats.invalidBookmarks,
        skipped_reasons: stats.skippedReasons,
        started_at: startTimeISO,
        completed_at: endTimeISO,
      }),
    );

    if (historyInserts.length > 0) {
      const { error: historyError } = await supabaseClient
        .from("validation_history")
        .insert(historyInserts);

      if (historyError) {
        console.error(
          "[validate-all-links] Error inserting validation history:",
          historyError,
        );
      } else {
        console.log(
          `[validate-all-links] Inserted ${historyInserts.length} validation history records`,
        );
      }
    }

    // 9. 返回统计信息
    const stats: ValidationStats = {
      totalBookmarks: bookmarks.length,
      checked: validatableBookmarks.length,
      skipped: skippedBookmarks.length,
      valid: validIds.length,
      invalid: invalidIds.length,
      errors: errorCount,
      duration: Date.now() - startTime,
      usersAffected: affectedUserIds.length,
    };

    console.log("[validate-all-links] Validation completed:", stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Validated ${stats.checked} bookmarks`,
        stats,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("[validate-all-links] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
