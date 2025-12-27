/**
 * 浏览器上下文类型定义
 *
 * @description 定义扩展传递的浏览器上下文结构
 * @version 1.0.0
 */

import { z } from "zod";

// ============================================
// 浏览器上下文 Schema
// ============================================

/**
 * 页面元数据 Schema
 */
export const pageMetadataSchema = z.object({
  /** 页面标题 */
  title: z.string().max(500).optional(),
  /** 页面 URL */
  url: z.string().url().optional(),
  /** 页面描述（meta description） */
  description: z.string().max(2000).optional(),
  /** 页面关键词（meta keywords） */
  keywords: z.array(z.string().max(100)).max(20).optional(),
  /** Open Graph 标题 */
  ogTitle: z.string().max(500).optional(),
  /** Open Graph 描述 */
  ogDescription: z.string().max(2000).optional(),
  /** Open Graph 图片 */
  ogImage: z.string().url().optional(),
  /** 作者 */
  author: z.string().max(200).optional(),
  /** 发布时间 */
  publishedTime: z.string().optional(),
  /** 站点名称 */
  siteName: z.string().max(200).optional(),
  /** Favicon URL */
  favicon: z.string().url().optional(),
});

/**
 * 用户选择 Schema
 */
export const userSelectionSchema = z.object({
  /** 选中的文本 */
  text: z.string().max(10000),
  /** 选择的 HTML（可选） */
  html: z.string().max(50000).optional(),
  /** 选择区域的矩形位置 */
  rect: z
    .object({
      top: z.number(),
      left: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});

/**
 * 浏览器上下文 Schema
 */
export const browserContextSchema = z.object({
  /** 当前标签页 ID */
  tabId: z.number().int().positive().optional(),
  /** 页面元数据 */
  page: pageMetadataSchema.optional(),
  /** 用户选中的内容 */
  selection: userSelectionSchema.optional(),
  /** 页面主要内容（提取后的正文） */
  pageContent: z.string().max(50000).optional(),
  /** 页面上的链接（用于批量保存） */
  links: z
    .array(
      z.object({
        url: z.string().url(),
        text: z.string().max(500),
        title: z.string().max(500).optional(),
      }),
    )
    .max(100)
    .optional(),
  /** 浏览器信息 */
  browser: z
    .object({
      name: z.enum(["chrome", "edge", "firefox", "other"]),
      version: z.string().optional(),
    })
    .optional(),
});

// ============================================
// 类型导出
// ============================================

export type PageMetadata = z.infer<typeof pageMetadataSchema>;
export type UserSelection = z.infer<typeof userSelectionSchema>;
export type BrowserContext = z.infer<typeof browserContextSchema>;

// ============================================
// 工具函数
// ============================================

/**
 * 格式化浏览器上下文为 Prompt 文本
 */
export function formatBrowserContextForPrompt(context: BrowserContext): string {
  const parts: string[] = [];

  if (context.page) {
    const { title, url, description, author, siteName, publishedTime } =
      context.page;
    parts.push("【当前页面】");
    if (title) parts.push(`标题: ${title}`);
    if (url) parts.push(`URL: ${url}`);
    if (siteName) parts.push(`站点: ${siteName}`);
    if (author) parts.push(`作者: ${author}`);
    if (publishedTime) parts.push(`发布时间: ${publishedTime}`);
    if (description) parts.push(`摘要: ${description}`);
    parts.push("");
  }

  if (context.selection?.text) {
    parts.push("【用户选中的内容】");
    parts.push(context.selection.text);
    parts.push("");
  }

  if (context.pageContent) {
    // 限制长度，避免 Token 过多
    const truncatedContent =
      context.pageContent.length > 5000
        ? context.pageContent.substring(0, 5000) + "...[内容已截断]"
        : context.pageContent;
    parts.push("【页面正文】");
    parts.push(truncatedContent);
    parts.push("");
  }

  if (context.links && context.links.length > 0) {
    parts.push(`【页面链接】(共 ${context.links.length} 个)`);
    context.links.slice(0, 10).forEach((link, index) => {
      parts.push(`${index + 1}. ${link.text} - ${link.url}`);
    });
    if (context.links.length > 10) {
      parts.push(`...还有 ${context.links.length - 10} 个链接`);
    }
    parts.push("");
  }

  return parts.join("\n");
}

/**
 * 提取页面的平台类型
 */
export function detectPlatformFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // 微信公众号
    if (hostname.includes("mp.weixin.qq.com")) {
      return "wechat";
    }
    // B站
    if (hostname.includes("bilibili.com")) {
      return "bilibili";
    }
    // 小红书
    if (hostname.includes("xiaohongshu.com") || hostname.includes("xhslink")) {
      return "xiaohongshu";
    }
    // 知乎
    if (hostname.includes("zhihu.com")) {
      return "zhihu";
    }
    // 掘金
    if (hostname.includes("juejin.cn")) {
      return "juejin";
    }
    // GitHub
    if (hostname.includes("github.com")) {
      return "github";
    }
    // 微博
    if (hostname.includes("weibo.com") || hostname.includes("weibo.cn")) {
      return "weibo";
    }
    // Twitter/X
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      return "twitter";
    }
    // YouTube
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      return "youtube";
    }
    // Medium
    if (hostname.includes("medium.com")) {
      return "medium";
    }

    return "browser_extension";
  } catch {
    return "browser_extension";
  }
}
