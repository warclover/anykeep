/**
 * DEV API: Reprocess Snapshot
 * 开发环境专用 - 重新处理指定快照
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { createHash } from "crypto";
import { logger } from "@/lib/logger";

// Only available in development
const isDev = process.env.NODE_ENV === "development";

/**
 * 创建具有完全绕过 RLS 能力的 Supabase 客户端
 */
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "public",
    },
  });
}

const FETCH_TIMEOUT = 30000;
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
};

export async function POST(request: Request) {
  if (!isDev) {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 },
    );
  }

  try {
    const { snapshotId } = await request.json();

    if (!snapshotId) {
      return NextResponse.json(
        { error: "Missing snapshotId" },
        { status: 400 },
      );
    }

    // 使用正确配置的 service client 来绕过 RLS
    const supabase = createServiceClient();

    // Get the snapshot with bookmark URL
    const { data: snapshot, error: fetchError } = await supabase
      .from("bookmark_snapshots")
      .select("id, bookmark_id, bookmarks!inner(url)")
      .eq("id", snapshotId)
      .single();

    if (fetchError || !snapshot) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 },
      );
    }

    // Handle both array and object cases from Supabase join
    const bookmarks = snapshot.bookmarks as unknown;
    const bookmarkUrl = Array.isArray(bookmarks)
      ? (bookmarks[0] as { url: string })?.url
      : (bookmarks as { url: string })?.url;

    if (!bookmarkUrl) {
      return NextResponse.json(
        { error: "Bookmark URL not found" },
        { status: 404 },
      );
    }

    // Fetch the webpage
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(bookmarkUrl, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    const html = await response.text();
    const finalUrl = response.url;

    // Parse with JSDOM and Readability
    const virtualConsole = new VirtualConsole();
    const dom = new JSDOM(html, {
      url: finalUrl,
      runScripts: "outside-only",
      virtualConsole,
    });
    const document = dom.window.document;

    // Check if it's WeChat
    const isWeChat = bookmarkUrl.includes("mp.weixin.qq.com");
    if (isWeChat) {
      preprocessWeChatHtml(document);
    }

    // Remove general noise
    removeNoisyElements(document);

    // Run Readability
    const reader = new Readability(document, { charThreshold: 50 });
    const article = reader.parse();

    if (!article) {
      return NextResponse.json(
        {
          error: "Readability could not extract content",
        },
        { status: 500 },
      );
    }

    // Calculate hash and size (with null safety)
    const textContent = article.textContent || "";
    const htmlContent = article.content || "";
    const contentHash = createHash("sha256")
      .update(textContent, "utf8")
      .digest("hex");
    const fileSize = Buffer.byteLength(htmlContent, "utf8");
    const excerpt = textContent.replace(/\s+/g, " ").trim().slice(0, 300);

    // Update the snapshot
    const updateData = {
      status: "completed",
      readable_title: article.title || null,
      readable_content: htmlContent,
      readable_text_content: textContent,
      readable_excerpt: excerpt,
      readable_byline: article.byline || null,
      readable_word_count: article.length || 0,
      content_hash: contentHash,
      file_size: fileSize,
      final_url: finalUrl !== bookmarkUrl ? finalUrl : null,
      captured_at: new Date().toISOString(),
      error_message: null,
    };

    // Use select to verify update and get row count
    const { data: updateResult, error: updateError } = await supabase
      .from("bookmark_snapshots")
      .update(updateData)
      .eq("id", snapshotId)
      .select("id, readable_word_count, captured_at");

    if (updateError) {
      logger.error(
        { error: updateError, snapshotId },
        "[Reprocess] Update error",
      );
      return NextResponse.json(
        {
          error: `Update failed: ${updateError.message}`,
          details: updateError,
        },
        { status: 500 },
      );
    }

    // Verify the update worked
    if (!updateResult || updateResult.length === 0) {
      logger.error({ snapshotId }, "[Reprocess] No rows updated for snapshot");
      return NextResponse.json(
        {
          error: "No rows were updated",
          snapshotId,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      snapshotId,
      title: article.title,
      wordCount: article.length,
      excerptPreview: excerpt.slice(0, 100),
      isWeChat,
      updated: updateResult[0],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Reprocess failed",
      },
      { status: 500 },
    );
  }
}

function preprocessWeChatHtml(document: Document): void {
  // Convert data-src to src
  document.querySelectorAll("img[data-src]").forEach((img) => {
    const dataSrc = img.getAttribute("data-src");
    if (dataSrc) {
      img.setAttribute("src", dataSrc);
    }
  });

  // Remove WeChat noise
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
  ];

  for (const selector of wechatNoise) {
    try {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    } catch {}
  }

  // Remove text noise
  const textPatterns = [
    "此图片来自微信公众平台",
    "未经允许不可引用",
    "继续滑动看下一个",
    "向上滑动看下一个",
    "轻触阅读原文",
    "点击上方蓝字关注",
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
    } catch {}
  });

  // Make content visible
  const contentArea = document.querySelector("#js_content");
  if (contentArea) {
    contentArea.setAttribute("style", "visibility: visible !important;");
  }
}

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
    } catch {}
  }
}
