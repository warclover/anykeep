/**
 * 直接运行失效检测（不通过 API）
 * 模拟 validate API 的逻辑
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// URL 过滤逻辑
function isUrlValidatable(url: string, platform?: string | null): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // 微信公众号
    if (
      hostname.includes("weixin.qq.com") ||
      hostname.includes("mp.weixin.qq.com")
    ) {
      return false;
    }

    // 需要登录的社交平台
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

    // 非 HTTP(S) 协议
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false;
    }

    // 本地/内网 IP
    if (
      hostname === "localhost" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname.startsWith("127.")
    ) {
      return false;
    }

    // 特定平台
    if (platform === "WECHAT_OFFICIAL_ACCOUNT") {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

function getSkipReason(url: string, platform?: string | null): string {
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

    if (hostname.includes("bilibili.com")) {
      return "B站链接可能需要登录验证";
    }

    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return `不支持的协议: ${urlObj.protocol}`;
    }

    if (platform === "WECHAT_OFFICIAL_ACCOUNT") {
      return "微信公众号平台链接无法验证";
    }

    return "该链接无法自动验证";
  } catch (error) {
    return "URL 格式错误";
  }
}

// 验证单个 URL
async function validateUrl(
  url: string,
  timeout = 5000,
): Promise<{
  valid: boolean;
  statusCode?: number;
  error?: string;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
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
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      return {
        valid: false,
        error: "请求超时",
      };
    }

    return {
      valid: false,
      error: error.message || "网络错误",
    };
  }
}

async function runValidation() {
  console.log("🚀 开始执行失效检测...\n");

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 1. 获取第一个有收藏的用户
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname")
    .limit(1);

  if (!profiles || profiles.length === 0) {
    console.log("⚠️  没有找到用户");
    return;
  }

  const userId = profiles[0].id;
  console.log(`👤 用户: ${profiles[0].nickname || userId}\n`);

  // 2. 获取用户的收藏（限制 20 个进行测试）
  const { data: bookmarks, error: fetchError } = await supabase
    .from("bookmarks")
    .select("id, url, platform")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("is_in_trash", false)
    .limit(20);

  if (fetchError) {
    console.error("❌ 获取收藏失败:", fetchError);
    return;
  }

  if (!bookmarks || bookmarks.length === 0) {
    console.log("⚠️  该用户没有收藏");
    return;
  }

  console.log(`📚 找到 ${bookmarks.length} 个收藏\n`);

  // 3. 智能过滤
  const validatableBookmarks = [];
  const skippedBookmarks = [];

  for (const bookmark of bookmarks) {
    if (isUrlValidatable(bookmark.url, bookmark.platform)) {
      validatableBookmarks.push(bookmark);
    } else {
      skippedBookmarks.push({
        id: bookmark.id,
        url: bookmark.url,
        skipReason: getSkipReason(bookmark.url, bookmark.platform),
      });
    }
  }

  console.log(`✅ 可验证: ${validatableBookmarks.length}`);
  console.log(`⏭️  跳过: ${skippedBookmarks.length}\n`);

  if (skippedBookmarks.length > 0) {
    console.log("跳过原因统计:");
    const reasonCounts: Record<string, number> = {};
    skippedBookmarks.forEach((item) => {
      reasonCounts[item.skipReason] = (reasonCounts[item.skipReason] || 0) + 1;
    });
    Object.entries(reasonCounts).forEach(([reason, count]) => {
      console.log(`  - ${reason}: ${count}`);
    });
    console.log();
  }

  // 4. 批量验证（并发控制）
  const CONCURRENCY = 5;
  const validIds = [];
  const invalidIds = [];
  const invalidDetails = [];

  console.log("🔄 开始验证链接...\n");

  for (let i = 0; i < validatableBookmarks.length; i += CONCURRENCY) {
    const batch = validatableBookmarks.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.allSettled(
      batch.map(async (bookmark) => {
        const result = await validateUrl(bookmark.url);
        return {
          id: bookmark.id,
          url: bookmark.url,
          valid: result.valid,
          statusCode: result.statusCode,
          error: result.error,
        };
      }),
    );

    for (const promiseResult of batchResults) {
      if (promiseResult.status === "fulfilled") {
        const result = promiseResult.value;
        if (result.valid) {
          validIds.push(result.id);
          console.log(
            `  ✓ [${result.id}] ${result.statusCode} - ${result.url.substring(0, 60)}...`,
          );
        } else {
          invalidIds.push(result.id);
          invalidDetails.push(result);
          console.log(
            `  ✗ [${result.id}] ${result.error || result.statusCode} - ${result.url.substring(0, 60)}...`,
          );
        }
      }
    }
  }

  console.log(`\n📊 验证结果:`);
  console.log(`  - 有效: ${validIds.length}`);
  console.log(`  - 失效: ${invalidIds.length}`);

  // 5. 更新失效状态
  if (invalidIds.length > 0) {
    console.log(`\n💾 更新失效状态...`);
    const { error: updateError } = await supabase
      .from("bookmarks")
      .update({
        is_invalid: true,
        invalidated_at: new Date().toISOString(),
        last_validation_at: new Date().toISOString(),
      })
      .in("id", invalidIds);

    if (updateError) {
      console.error("  ❌ 更新失效状态失败:", updateError);
    } else {
      console.log(`  ✅ 已标记 ${invalidIds.length} 个失效收藏`);
    }
  }

  // 6. 更新有效状态
  if (validIds.length > 0) {
    const { error: updateError } = await supabase
      .from("bookmarks")
      .update({
        is_invalid: false,
        invalidated_at: null,
        last_validation_at: new Date().toISOString(),
      })
      .in("id", validIds);

    if (updateError) {
      console.error("  ❌ 更新有效状态失败:", updateError);
    } else {
      console.log(`  ✅ 已确认 ${validIds.length} 个有效收藏`);
    }
  }

  console.log("\n✨ 验证完成！");
  console.log("\n💡 提示: 可以访问 /home?folder=invalid 查看失效的收藏");
}

runValidation().catch((error) => {
  console.error("❌ 验证失败:", error);
  process.exit(1);
});
