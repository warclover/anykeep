/**
 * 微信文章模块 - 配置常量
 *
 * @module wechat-article
 */

import type { WechatArticleCrawlConfig } from "./wechat-article.types";

// =============================================================================
// 抓取配置
// =============================================================================

/**
 * 默认抓取配置
 */
export const DEFAULT_CRAWL_CONFIG: WechatArticleCrawlConfig = {
  /** 并发下载图片数（避免触发限流） */
  imageConcurrency: 3,

  /** 图片下载超时 (ms) */
  imageTimeout: 15000,

  /** 最大图片数量（限制存储成本） */
  maxImages: 50,

  /** 最小图片宽度 (px)，低于此值的图片将被过滤（过滤表情包等小图） */
  minImageWidth: 100,

  /** 启用 Markdown 转换 */
  enableMarkdown: true,

  /** Storage bucket 名称 */
  storageBucket: process.env.WECHAT_ARTICLE_IMAGES_BUCKET || "article-images",

  /** 降级代理 URL 模板 */
  fallbackProxyTemplate: "https://images.weserv.nl/?url={url}",
};

// =============================================================================
// 图片过滤规则
// =============================================================================

/**
 * 需要排除的图片 URL 正则模式
 */
export const EXCLUDE_IMAGE_PATTERNS: RegExp[] = [
  // 表情包（GIF 格式且来自微信）
  /wx_fmt=gif/i,

  // 追踪像素
  /tp=webp.*wxfrom=5/i,

  // 微信内置资源
  /res\.wx\.qq\.com/i,

  // 微信头像
  /mmbiz\.qlogo\.cn/i,

  // Base64 内嵌图片（数据量小，无需持久化）
  /^data:image/i,

  // 二维码相关
  /qrcode/i,

  // 分割线等装饰图
  /line|divider|separator/i,
];

/**
 * 允许的图片域名
 */
export const ALLOWED_IMAGE_HOSTS = [
  "mmbiz.qpic.cn",
  "mmbiz.qlogo.cn", // 仅用于特殊情况
];

// =============================================================================
// 存储路径
// =============================================================================

/**
 * 生成图片存储路径
 *
 * @param snapshotId 快照 ID
 * @param index 图片索引
 * @param ext 文件扩展名
 */
export function generateImageStoragePath(
  snapshotId: number,
  index: number,
  ext: string = "jpg",
): string {
  const timestamp = Date.now();
  return `wechat/${snapshotId}/${timestamp}_${index}.${ext}`;
}

// =============================================================================
// HTTP 请求配置
// =============================================================================

/**
 * 图片下载请求头
 */
export const IMAGE_FETCH_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://mp.weixin.qq.com/",
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
};

// =============================================================================
// MIME 类型映射
// =============================================================================

/**
 * MIME 类型到文件扩展名映射
 */
export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

/**
 * 获取文件扩展名
 */
export function getExtFromMime(contentType: string | null): string {
  if (!contentType) return "jpg";

  const mimeType = contentType.split(";")[0].trim().toLowerCase();
  return MIME_TO_EXT[mimeType] || "jpg";
}

// =============================================================================
// HTML 清理规则
// =============================================================================

/**
 * DOMPurify 允许的标签
 */
export const ALLOWED_HTML_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "a",
  "code",
  "pre",
  "blockquote",
  "img",
  "figure",
  "figcaption",
  "section",
  "article",
  "span",
  "div",
];

/**
 * DOMPurify 允许的属性
 */
export const ALLOWED_HTML_ATTRS = [
  "href",
  "target",
  "rel",
  "class",
  "src",
  "alt",
  "title",
  "data-src",
  "width",
  "height",
];

// =============================================================================
// 错误码
// =============================================================================

export const ERROR_CODES = {
  SNAPSHOT_NOT_FOUND: "SNAPSHOT_NOT_FOUND",
  NOT_WECHAT_ARTICLE: "NOT_WECHAT_ARTICLE",
  CRAWL_FAILED: "CRAWL_FAILED",
  IMAGE_PERSIST_FAILED: "IMAGE_PERSIST_FAILED",
  REFETCH_FAILED: "REFETCH_FAILED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
