/**
 * AnyKeep 浏览器扩展 - Content Script
 * 从页面 DOM 提取元数据
 */

import type { PageMetadata, Platform } from "@/types";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    // 监听来自 background/popup 的消息
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "GET_PAGE_INFO") {
        const pageInfo = extractPageInfo();
        sendResponse(pageInfo);
        return true;
      }
      return false;
    });

    // Content script 初始化完成
  },
});

/**
 * 提取页面信息
 */
function extractPageInfo(): PageMetadata {
  return {
    title: getTitle(),
    url: window.location.href,
    description: getDescription(),
    coverUrl: getCoverUrl(),
    author: getAuthor(),
    siteName: getSiteName(),
    platform: detectPlatform(window.location.href),
    publishTime: getPublishTime(),
    wordCount: getWordCount(),
    imageCount: getImageCount(),
  };
}

/**
 * 获取页面标题
 * 优先级: og:title > twitter:title > document.title
 */
function getTitle(): string {
  return (
    getMetaContent("og:title") ||
    getMetaContent("twitter:title") ||
    document.title ||
    ""
  );
}

/**
 * 获取页面描述
 * 优先级: og:description > twitter:description > meta[name="description"]
 */
function getDescription(): string | undefined {
  return (
    getMetaContent("og:description") ||
    getMetaContent("twitter:description") ||
    getMetaContent("description", "name") ||
    undefined
  );
}

/**
 * 获取封面图
 * 优先级: og:image > twitter:image > twitter:image:src
 */
function getCoverUrl(): string | undefined {
  let url =
    getMetaContent("og:image") ||
    getMetaContent("twitter:image") ||
    getMetaContent("twitter:image:src");

  // 处理相对路径
  if (url && !url.startsWith("http")) {
    try {
      url = new URL(url, window.location.origin).href;
    } catch {
      // 忽略无效 URL
    }
  }

  return url || undefined;
}

/**
 * 获取作者
 * 优先级: article:author > meta[name="author"] > 平台特定提取
 */
function getAuthor(): string | undefined {
  // 通用 meta 标签
  const author =
    getMetaContent("article:author") ||
    getMetaContent("author", "name") ||
    getMetaContent("twitter:creator");

  if (author) return author;

  // 平台特定提取
  const url = window.location.href;

  // 微信公众号
  if (url.includes("mp.weixin.qq.com")) {
    const nameEl = document.querySelector("#js_name");
    if (nameEl) return nameEl.textContent?.trim();
  }

  // B站
  if (url.includes("bilibili.com")) {
    // 视频页面
    const upNameEl = document.querySelector(".up-name, .username");
    if (upNameEl) return upNameEl.textContent?.trim();

    // 专栏页面
    const authorEl = document.querySelector(".author-name");
    if (authorEl) return authorEl.textContent?.trim();
  }

  // 小红书
  if (url.includes("xiaohongshu.com")) {
    const nicknameEl = document.querySelector(".user-nickname, .author-name");
    if (nicknameEl) return nicknameEl.textContent?.trim();
  }

  // 知乎
  if (url.includes("zhihu.com")) {
    const authorEl = document.querySelector(".AuthorInfo-name, .UserLink-link");
    if (authorEl) return authorEl.textContent?.trim();
  }

  // GitHub
  if (url.includes("github.com")) {
    // 仓库页面
    const match = url.match(/github\.com\/([^/]+)/);
    if (match) return match[1];
  }

  return undefined;
}

/**
 * 获取网站名称
 * 优先级: og:site_name > application-name
 */
function getSiteName(): string | undefined {
  return (
    getMetaContent("og:site_name") ||
    getMetaContent("application-name", "name") ||
    undefined
  );
}

/**
 * 获取发布时间
 * 优先级: article:published_time > datePublished > 平台特定提取
 */
function getPublishTime(): string | undefined {
  const time =
    getMetaContent("article:published_time") ||
    getMetaContent("datePublished", "name") ||
    getMetaContent("pubdate", "name");

  if (time) return time;

  // 平台特定提取
  const url = window.location.href;

  // 微信公众号
  if (url.includes("mp.weixin.qq.com")) {
    const timeEl = document.querySelector("#publish_time");
    if (timeEl) return timeEl.textContent?.trim();
  }

  // 查找 time 元素
  const timeEl = document.querySelector("time[datetime]");
  if (timeEl) {
    return timeEl.getAttribute("datetime") || undefined;
  }

  return undefined;
}

/**
 * 获取字数统计（估算）
 */
function getWordCount(): number | undefined {
  // 查找文章主体
  const articleSelectors = [
    "article",
    ".article-content",
    ".post-content",
    ".content",
    ".rich_media_content", // 微信公众号
    "#read-content", // B站专栏
    "main",
  ];

  for (const selector of articleSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const text = el.textContent || "";
      // 中文按字符计数，英文按单词计数
      const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
      const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
      return chineseCount + englishWords;
    }
  }

  return undefined;
}

/**
 * 获取图片数量
 */
function getImageCount(): number | undefined {
  // 查找文章主体中的图片
  const articleSelectors = [
    "article img",
    ".article-content img",
    ".post-content img",
    ".content img:not(.emoji)",
    ".rich_media_content img", // 微信公众号
  ];

  for (const selector of articleSelectors) {
    const images = document.querySelectorAll(selector);
    if (images.length > 0) {
      return images.length;
    }
  }

  return undefined;
}

/**
 * 获取 meta 标签内容
 * @param name - 属性值
 * @param attr - 属性名，默认为 "property"
 */
function getMetaContent(
  name: string,
  attr: "property" | "name" = "property",
): string | null {
  const selector = `meta[${attr}="${name}"]`;
  const el = document.querySelector(selector);
  return el?.getAttribute("content") || null;
}

/**
 * 平台检测
 */
function detectPlatform(url: string): Platform {
  const platformPatterns: Record<Platform, RegExp[]> = {
    WECHAT_OFFICIAL_ACCOUNT: [/mp\.weixin\.qq\.com/],
    BILIBILI: [/bilibili\.com/, /b23\.tv/],
    XIAOHONGSHU: [/xiaohongshu\.com/, /xhslink\.com/],
    ZHIHU: [/zhihu\.com/, /zhuanlan\.zhihu\.com/],
    DOUYIN: [/douyin\.com/, /v\.douyin\.com/],
    WEIBO: [/weibo\.com/, /weibo\.cn/],
    JUEJIN: [/juejin\.cn/],
    JIANSHU: [/jianshu\.com/],
    CSDN: [/csdn\.net/, /blog\.csdn\.net/],
    GITHUB: [/github\.com/],
    YOUTUBE: [/youtube\.com/, /youtu\.be/],
    TWITTER: [/twitter\.com/, /x\.com/],
    MEDIUM: [/medium\.com/],
    NOTION: [/notion\.so/],
    BROWSER_CHROME: [],
    BROWSER_EDGE: [],
    BROWSER_FIREFOX: [],
    BROWSER_SAFARI: [],
    OTHER: [],
    UNKNOWN: [],
  };

  for (const [platform, patterns] of Object.entries(platformPatterns)) {
    if (patterns.some((pattern) => pattern.test(url))) {
      return platform as Platform;
    }
  }

  return "OTHER";
}
