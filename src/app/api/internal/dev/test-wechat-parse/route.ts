/**
 * DEV API: Test WeChat HTML Parsing
 * 开发环境专用 - 测试微信公众号文章解析效果
 */

import { NextResponse } from "next/server";
import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";

// Only available in development
const isDev = process.env.NODE_ENV === "development";

const FETCH_TIMEOUT = 30000;
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
};

export async function GET(request: Request) {
  if (!isDev) {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const url =
    searchParams.get("url") ||
    "https://mp.weixin.qq.com/s/tp_Rf9IS6ouLe1-P3nfILg";

  try {
    // Fetch the webpage
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    const html = await response.text();

    // Create JSDOM
    const virtualConsole = new VirtualConsole();
    const dom = new JSDOM(html, {
      url,
      runScripts: "outside-only",
      virtualConsole,
    });
    const document = dom.window.document;

    // Analyze HTML structure
    const analysis = {
      url,
      htmlLength: html.length,
      title: document.title,
      hasJsContent: !!document.querySelector("#js_content"),
      jsContentStyle: document
        .querySelector("#js_content")
        ?.getAttribute("style"),
      jsContentChildCount:
        document.querySelector("#js_content")?.children.length || 0,
      dataSourceImages: document.querySelectorAll("img[data-src]").length,
      normalImages: document.querySelectorAll("img[src]:not([data-src])")
        .length,
      articleMeta: {
        author: document.querySelector("#js_name")?.textContent?.trim(),
        originalBadge: !!document.querySelector(".original-primary-bd"),
      },
    };

    // Get raw #js_content text (before preprocessing)
    const jsContentRaw = document
      .querySelector("#js_content")
      ?.textContent?.trim()
      .slice(0, 500);

    // Apply WeChat preprocessing
    preprocessWeChatHtml(document);

    // Get preprocessed #js_content text
    const jsContentAfter = document
      .querySelector("#js_content")
      ?.textContent?.trim()
      .slice(0, 500);

    // Remove general noise
    removeNoisyElements(document);

    // Run Readability
    const reader = new Readability(document, { charThreshold: 50 });
    const article = reader.parse();

    return NextResponse.json({
      success: true,
      analysis,
      jsContentRaw,
      jsContentAfter,
      readability: article
        ? {
            title: article.title,
            excerpt: article.excerpt?.slice(0, 200),
            byline: article.byline,
            length: article.length,
            contentPreview: article.textContent?.slice(0, 500),
            hasContent: !!article.content && article.content.length > 100,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Parse failed" },
      { status: 500 },
    );
  }
}

/**
 * Preprocess WeChat HTML
 */
function preprocessWeChatHtml(document: Document): void {
  // 1. Convert data-src to src for lazy images
  const lazyImages = document.querySelectorAll("img[data-src]");
  lazyImages.forEach((img) => {
    const dataSrc = img.getAttribute("data-src");
    if (dataSrc) {
      img.setAttribute("src", dataSrc);
    }
  });

  // 2. Remove WeChat noise elements
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
    } catch {
      // Ignore selector errors
    }
  }

  // 3. Remove text noise
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
    } catch {
      // Ignore
    }
  });

  // 4. Make content visible
  const contentArea = document.querySelector("#js_content");
  if (contentArea) {
    contentArea.setAttribute("style", "visibility: visible !important;");
  }
}

/**
 * Remove general noise elements
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
      // Ignore
    }
  }
}
