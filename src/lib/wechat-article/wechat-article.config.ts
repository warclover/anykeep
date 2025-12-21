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
  "style", // 新增：允许 style 属性（通过白名单过滤）
];

// =============================================================================
// 样式保留配置（Phase 1 升级 + 样式选项升级）
// =============================================================================

/**
 * 样式保留级别
 *
 * - text-only: 仅文字效果（颜色、字号、对齐等）
 * - full-snapshot: 完整快照（保留完整排版样式）
 */
export type StylePreserveLevel = "text-only" | "full-snapshot";

/**
 * 默认样式保留级别
 */
export const DEFAULT_STYLE_PRESERVE_LEVEL: StylePreserveLevel = "full-snapshot";

/**
 * 仅文字效果 - 基础文字样式白名单
 */
export const TEXT_ONLY_STYLE_PROPERTIES = [
  // 文字颜色
  "color",
  // 字体
  "font-size",
  "font-weight",
  "font-style",
  "font-family",
  // 文字排版
  "text-align",
  "text-decoration",
  "line-height",
  "letter-spacing",
  "text-indent",
  "word-spacing",
];

/**
 * 完整快照 - 保留完整排版样式白名单
 */
export const FULL_SNAPSHOT_STYLE_PROPERTIES = [
  // === 文字样式（继承 text-only）===
  ...TEXT_ONLY_STYLE_PROPERTIES,

  // === 布局 ===
  "display",
  "visibility",
  "opacity",
  "width",
  "max-width",
  "min-width",
  "height",
  "max-height",
  "min-height",

  // === 间距 ===
  "margin",
  "margin-top",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "padding",
  "padding-top",
  "padding-bottom",
  "padding-left",
  "padding-right",

  // === 背景（仅颜色）===
  "background-color",
  "background",

  // === 边框 ===
  "border",
  "border-radius",
  "border-top",
  "border-bottom",
  "border-left",
  "border-right",
  "border-color",
  "border-width",
  "border-style",

  // === 其他安全属性 ===
  "vertical-align",
  "white-space",
  "overflow",
  "overflow-x",
  "overflow-y",
  "box-sizing",
  "box-shadow",
  "flex",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "gap",
  "transform",
];

/**
 * 兼容旧代码：ALLOWED_STYLE_PROPERTIES 指向 TEXT_ONLY
 * @deprecated 请使用 getStylePropertiesByLevel()
 */
export const ALLOWED_STYLE_PROPERTIES = TEXT_ONLY_STYLE_PROPERTIES;

/**
 * 基础危险 CSS 值模式（黑名单）
 *
 * 即使属性在白名单中，如果值匹配这些模式也会被移除
 */
export const DANGEROUS_STYLE_VALUES: RegExp[] = [
  // JavaScript 注入
  /javascript\s*:/i,

  // CSS 表达式（IE 特有，XSS 风险）
  /expression\s*\(/i,

  // URL 函数（可能加载外部资源）
  /url\s*\(/i,

  // Firefox 绑定（XSS 风险）
  /-moz-binding/i,

  // IE 行为（XSS 风险）
  /behavior\s*:/i,

  // 导入外部样式
  /@import/i,
];

/**
 * 完整快照模式 - 额外的危险值过滤
 */
export const FULL_SNAPSHOT_DANGEROUS_VALUES: RegExp[] = [
  // 继承基础危险值
  ...DANGEROUS_STYLE_VALUES,

  // 禁止 fixed/absolute/sticky 定位（防止覆盖攻击）
  /position\s*:\s*(fixed|absolute|sticky)/i,

  // 禁止 z-index > 499（防止覆盖攻击）
  /z-index\s*:\s*([5-9]\d{2,}|\d{4,})/i,
];

/**
 * 根据级别获取样式属性白名单
 */
export function getStylePropertiesByLevel(level: StylePreserveLevel): string[] {
  return level === "full-snapshot"
    ? FULL_SNAPSHOT_STYLE_PROPERTIES
    : TEXT_ONLY_STYLE_PROPERTIES;
}

/**
 * 根据级别获取危险值黑名单
 */
export function getDangerousValuesByLevel(level: StylePreserveLevel): RegExp[] {
  return level === "full-snapshot"
    ? FULL_SNAPSHOT_DANGEROUS_VALUES
    : DANGEROUS_STYLE_VALUES;
}

// =============================================================================
// 图片代理服务配置（Phase 2 升级）
// =============================================================================

/**
 * 图片代理服务列表
 *
 * 当直接下载失败时，按优先级尝试代理服务
 */
export const IMAGE_PROXY_SERVICES = [
  {
    name: "weserv",
    template: "https://images.weserv.nl/?url={url}",
    priority: 1,
  },
  {
    name: "wsrv",
    template: "https://wsrv.nl/?url={url}",
    priority: 2,
  },
] as const;

/**
 * 获取代理 URL
 */
export function getProxyUrl(originalUrl: string, proxyIndex: number = 0): string {
  const proxy = IMAGE_PROXY_SERVICES[proxyIndex] || IMAGE_PROXY_SERVICES[0];
  return proxy.template.replace("{url}", encodeURIComponent(originalUrl));
}

/**
 * Referer 列表（轮换使用）
 *
 * 不同 Referer 可能影响微信图片服务器的响应
 */
export const IMAGE_REFERER_LIST = [
  "https://mp.weixin.qq.com/",
  "https://weixin.qq.com/",
  "", // 空 Referer
];

// =============================================================================
// 本站图片代理配置
// =============================================================================

/**
 * 图片代理 API 路径
 */
export const IMAGE_PROXY_PATH = "/api/image-proxy";

/**
 * 需要代理的图片域名
 */
export const PROXY_REQUIRED_HOSTS = ["mmbiz.qpic.cn", "mmbiz.qlogo.cn"];

/**
 * 获取本站代理 URL
 *
 * @param originalUrl - 原始图片 URL
 * @returns 代理 URL
 */
export function getLocalProxyUrl(originalUrl: string): string {
  return `${IMAGE_PROXY_PATH}?url=${encodeURIComponent(originalUrl)}`;
}

/**
 * 检查 URL 是否需要代理
 *
 * @param url - 图片 URL
 * @returns 是否需要代理
 */
export function requiresProxy(url: string): boolean {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    return PROXY_REQUIRED_HOSTS.some(
      (host) =>
        urlObj.hostname === host || urlObj.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

/**
 * 智能获取图片显示 URL
 *
 * 优先使用已持久化的 URL，否则使用本站代理
 *
 * @param persistedUrl - 已持久化的 URL (Supabase Storage)
 * @param originalUrl - 原始 URL
 * @returns 最终显示 URL
 */
export function getImageDisplayUrl(
  persistedUrl: string | null,
  originalUrl: string,
): string {
  // 已持久化到 Supabase Storage，直接使用
  if (persistedUrl && !requiresProxy(persistedUrl)) {
    return persistedUrl;
  }

  // 原始 URL 需要代理
  if (requiresProxy(originalUrl)) {
    return getLocalProxyUrl(originalUrl);
  }

  // 默认返回原始 URL
  return originalUrl;
}

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
