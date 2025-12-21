/**
 * 微信文章创建 API
 *
 * POST /api/wechat-article/create - 为书签创建微信文章快照并抓取内容
 */

import type { NextRequest } from "next/server";
import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import {
  createServerSupabaseClient,
  createServiceClient,
} from "@/lib/supabase/server";
import {
  successResponse,
  errorResponse,
  unauthorizedError,
} from "@/lib/utils/api-response";

export const dynamic = "force-dynamic";

// 常量配置
const FETCH_TIMEOUT = 30000; // 30 秒超时
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024; // 最大 5MB

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate",
  "Cache-Control": "no-cache",
};

/**
 * POST /api/wechat-article/create
 * 为微信公众号文章创建快照记录并抓取内容
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedError();
    }

    const body = await request.json();
    const { bookmarkId } = body;

    if (!bookmarkId || typeof bookmarkId !== "number") {
      return errorResponse("INVALID_REQUEST", "缺少 bookmarkId", 400);
    }

    // 验证书签所有权和平台
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id, url, platform")
      .eq("id", bookmarkId)
      .eq("user_id", user.id)
      .single();

    if (bookmarkError || !bookmark) {
      return errorResponse("NOT_FOUND", "书签不存在或无权访问", 404);
    }

    // 验证是微信平台
    if (bookmark.platform !== "WECHAT_OFFICIAL_ACCOUNT") {
      return errorResponse("NOT_WECHAT_ARTICLE", "仅支持微信公众号文章", 400);
    }

    // 使用 service client 操作（绕过 RLS）
    const serviceClient = await createServiceClient();

    // 检查是否已有快照
    const { data: existingSnapshot } = await supabase
      .from("bookmark_snapshots")
      .select("id, status, readable_content")
      .eq("bookmark_id", bookmarkId)
      .eq("user_id", user.id)
      .maybeSingle();

    // 如果已有已完成的快照，直接返回
    if (existingSnapshot && existingSnapshot.status === "completed") {
      return successResponse({
        snapshotId: existingSnapshot.id,
        status: existingSnapshot.status,
        isExisting: true,
      });
    }

    let snapshotId: number;

    // 如果存在未完成的快照，复用它
    if (existingSnapshot) {
      snapshotId = existingSnapshot.id;
      // 更新状态为处理中
      await serviceClient
        .from("bookmark_snapshots")
        .update({ status: "processing" })
        .eq("id", snapshotId);
    } else {
      // 创建新快照记录
      const { data: newSnapshot, error: createError } = await serviceClient
        .from("bookmark_snapshots")
        .insert({
          bookmark_id: bookmarkId,
          user_id: user.id,
          original_url: bookmark.url,
          snapshot_type: "standard",
          status: "processing",
        })
        .select("id")
        .single();

      if (createError || !newSnapshot) {
        console.error("[API] Failed to create snapshot:", createError);
        return errorResponse("CREATE_FAILED", "创建快照失败", 500);
      }

      snapshotId = newSnapshot.id;
    }

    // 抓取并处理内容
    try {
      const { html, finalUrl } = await fetchWebpage(bookmark.url);
      const readability = parseWechatArticle(html, finalUrl);

      if (!readability) {
        throw new Error("无法提取文章内容");
      }

      // 生成摘要
      const excerpt = generateExcerpt(readability.textContent, 300);

      // 提取并保存原始 HTML（用于样式保留）
      // 只保留 <body> 部分，减少存储空间
      const originalHtml = extractBodyHtml(html);

      // 更新快照记录
      const { error: updateError } = await serviceClient
        .from("bookmark_snapshots")
        .update({
          status: "completed",
          readable_title: readability.title || null,
          readable_content: readability.content,
          readable_text_content: readability.textContent,
          readable_excerpt: excerpt,
          readable_byline: readability.byline || null,
          readable_word_count: readability.length,
          original_html: originalHtml,
          final_url: finalUrl !== bookmark.url ? finalUrl : null,
          captured_at: new Date().toISOString(),
        })
        .eq("id", snapshotId);

      if (updateError) {
        console.error("[API] Failed to update snapshot:", updateError);
        throw new Error("保存内容失败");
      }

      return successResponse(
        {
          snapshotId,
          status: "completed",
          isExisting: false,
          title: readability.title,
          wordCount: readability.length,
        },
        201,
      );
    } catch (fetchError) {
      // 抓取失败，更新状态
      const errorMessage =
        fetchError instanceof Error ? fetchError.message : "抓取失败";

      await serviceClient
        .from("bookmark_snapshots")
        .update({
          status: "failed",
          error_message: errorMessage,
        })
        .eq("id", snapshotId);

      console.error("[API] Content fetch failed:", fetchError);
      return errorResponse("FETCH_FAILED", errorMessage, 500);
    }
  } catch (error) {
    console.error("[API] POST /api/wechat-article/create error:", error);
    return errorResponse(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "创建失败",
      500,
    );
  }
}

/**
 * 获取网页内容
 */
async function fetchWebpage(
  url: string,
): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // 检查内容类型
    const contentType = response.headers.get("content-type") || "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      throw new Error(`不支持的内容类型: ${contentType}`);
    }

    // 检查内容大小
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_CONTENT_LENGTH) {
      throw new Error(`内容过大: ${contentLength} bytes`);
    }

    const html = await response.text();

    // 二次检查大小
    if (html.length > MAX_CONTENT_LENGTH) {
      throw new Error(`内容过大: ${html.length} bytes`);
    }

    return {
      html,
      finalUrl: response.url,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`请求超时 (${FETCH_TIMEOUT / 1000}s)`);
    }

    throw error;
  }
}

/**
 * 微信公众号文章专用解析
 * 包含预处理步骤以处理懒加载和噪音元素
 */
function parseWechatArticle(html: string, url: string) {
  try {
    // 创建 JSDOM，抑制控制台警告
    const virtualConsole = new VirtualConsole();
    const dom = new JSDOM(html, {
      url,
      runScripts: "outside-only",
      virtualConsole,
    });

    const document = dom.window.document;

    // 1. 微信专用预处理
    preprocessWechatHtml(document);

    // 2. 移除通用噪音元素
    removeNoisyElements(document);

    // 3. 运行 Readability
    const reader = new Readability(document, {
      charThreshold: 50,
    });

    const article = reader.parse();

    if (!article) {
      return null;
    }

    return {
      title: article.title || "",
      content: article.content || "",
      textContent: article.textContent || "",
      length: article.length || 0,
      excerpt: article.excerpt || "",
      byline: article.byline || null,
    };
  } catch (error) {
    console.error("[API] WeChat article parsing failed:", error);
    return null;
  }
}

/**
 * 微信公众号 HTML 预处理
 */
function preprocessWechatHtml(document: Document): void {
  // 1. 将 data-src 转换为 src（懒加载图片）
  const lazyImages = document.querySelectorAll("img[data-src]");
  lazyImages.forEach((img) => {
    const dataSrc = img.getAttribute("data-src");
    if (dataSrc) {
      img.setAttribute("src", dataSrc);
    }
  });

  // 2. 移除微信特有噪音元素
  const wechatNoise = [
    ".copyright_logo",
    ".rich_media_tool",
    ".weui-wa-hotarea",
    ".profile_container",
    ".profile_inner",
    ".follow-nickName-tips",
    ".js_hot_article",
    ".hot_article_list",
    ".like_tips",
    ".share_notice",
    ".reward_area",
    ".related_article",
    ".ad_container",
    ".qr_code_pc_outer",
    '[class*="tips"]',
    ".vote_area",
    ".js_vote_container",
    "#js_pc_qr_code",
    "#js_profile_qrcode",
    ".rich_media_area_extra",
    ".rich_media_extra",
    ".qr_code_pc",
    ".reward_qrcode_area",
    ".video_channel_guest_author",
    ".video_channel_guest_meta",
  ];

  for (const selector of wechatNoise) {
    try {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    } catch {
      // 忽略选择器错误
    }
  }

  // 3. 移除包含特定文本的节点
  const textPatterns = [
    "此图片来自微信公众平台",
    "未经允许不可引用",
    "继续滑动看下一个",
    "向上滑动看下一个",
    "轻触阅读原文",
    "点击上方蓝字关注",
    "微信扫一扫",
    "关注该公众号",
    "关注公众号",
    "长按识别",
    "长按二维码",
  ];

  const walker = document.createTreeWalker(document.body, 4, null);
  const nodesToRemove: Element[] = [];
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent || "";
    for (const pattern of textPatterns) {
      if (text.includes(pattern)) {
        const parent = node.parentElement;
        if (parent && !nodesToRemove.includes(parent)) {
          nodesToRemove.push(parent);
        }
        break;
      }
    }
  }
  nodesToRemove.forEach((el) => {
    try {
      el.remove();
    } catch {
      // 忽略
    }
  });

  // 4. 使内容区域可见
  const contentArea = document.querySelector("#js_content");
  if (contentArea) {
    contentArea.setAttribute("style", "visibility: visible !important;");
  }
}

/**
 * 移除通用噪音元素
 */
function removeNoisyElements(document: Document): void {
  const selectorsToRemove = [
    "script",
    "style",
    "noscript",
    "iframe",
    "nav",
    "footer",
    "aside",
    ".advertisement",
    ".ads",
    ".ad",
    "#comments",
    ".comments",
    ".social-share",
    ".related-posts",
  ];

  for (const selector of selectorsToRemove) {
    try {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    } catch {
      // 忽略
    }
  }
}

/**
 * 提取 body HTML
 * 包含 <head> 中的 <style> 标签和 <body> 内容
 */
function extractBodyHtml(html: string): string {
  // 提取 <style> 标签
  const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  const styles = styleMatches.join("\n");

  // 提取 <body> 内容
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;

  // 组合：styles + body
  if (styles) {
    return `${styles}\n${body}`;
  }

  return body;
}

/**
 * 生成摘要
 */
function generateExcerpt(text: string, maxLength: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const truncated = cleaned.substring(0, maxLength);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf("。"),
    truncated.lastIndexOf("！"),
    truncated.lastIndexOf("？"),
  );

  if (lastSentenceEnd > maxLength * 0.6) {
    return truncated.substring(0, lastSentenceEnd + 1);
  }

  return truncated + "...";
}
