/**
 * HTML Inliner Utilities (V4.2.1)
 * CSS 内联和图片处理工具
 *
 * 功能：
 * - CSS 样式内联（将外部/内部样式转为行内样式）
 * - 图片资源处理（转为 base64 或代理 URL）
 * - HTML 清理（移除脚本、追踪器等）
 *
 * 设计原则：
 * - 保留原始内容结构
 * - 确保离线可访问
 * - 控制输出大小
 */

import { JSDOM } from "jsdom";
import { logger } from "@/lib/logger";

// ============================================================================
// 配置常量
// ============================================================================

/** 最大图片大小（转 base64） */
const MAX_IMAGE_SIZE = 500 * 1024; // 500KB

/** 图片获取超时 */
const IMAGE_FETCH_TIMEOUT = 10000; // 10s

/** 最大并发图片请求 */
const MAX_CONCURRENT_IMAGES = 5;

/** 支持转换的图片类型 */
const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

/** 需要移除的危险标签 */
const DANGEROUS_TAGS = [
  "script",
  "noscript",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "form",
  "input",
  "button",
  "select",
  "textarea",
];

/** 需要移除的危险属性 */
const DANGEROUS_ATTRS = [
  "onclick",
  "onload",
  "onerror",
  "onmouseover",
  "onmouseout",
  "onkeydown",
  "onkeyup",
  "onfocus",
  "onblur",
  "onsubmit",
  "onreset",
];

/** 需要移除的追踪相关元素 */
const TRACKING_SELECTORS = [
  "[data-tracking]",
  "[data-analytics]",
  ".tracking-pixel",
  'img[width="1"][height="1"]',
  'img[src*="pixel"]',
  'img[src*="beacon"]',
  'img[src*="track"]',
];

// ============================================================================
// 类型定义
// ============================================================================

export interface InlineOptions {
  /** 是否内联图片 */
  inlineImages?: boolean;
  /** 是否内联 CSS */
  inlineCss?: boolean;
  /** 是否移除危险元素 */
  sanitize?: boolean;
  /** 基础 URL（用于解析相对路径） */
  baseUrl: string;
  /** 最大输出大小 (bytes) */
  maxOutputSize?: number;
}

export interface InlineResult {
  /** 处理后的 HTML */
  html: string;
  /** 处理后的大小 (bytes) */
  size: number;
  /** 内联的图片数量 */
  inlinedImages: number;
  /** 跳过的图片数量 */
  skippedImages: number;
  /** 处理错误 */
  errors: string[];
}

// ============================================================================
// 主要函数
// ============================================================================

/**
 * 处理 HTML 内容，内联资源
 */
export async function inlineHtml(
  html: string,
  options: InlineOptions,
): Promise<InlineResult> {
  const {
    inlineImages = true,
    inlineCss = true,
    sanitize = true,
    baseUrl,
    maxOutputSize = 2 * 1024 * 1024, // 2MB
  } = options;

  const errors: string[] = [];
  let inlinedImages = 0;
  let skippedImages = 0;

  try {
    // 创建 DOM
    const dom = new JSDOM(html, { url: baseUrl });
    const document = dom.window.document;

    // 1. 清理危险内容
    if (sanitize) {
      sanitizeDocument(document);
    }

    // 2. 内联 CSS
    if (inlineCss) {
      await inlineCssStyles(document, baseUrl, errors);
    }

    // 3. 内联图片
    if (inlineImages) {
      const result = await inlineImageResources(document, baseUrl, errors);
      inlinedImages = result.inlined;
      skippedImages = result.skipped;
    }

    // 4. 清理追踪元素
    removeTrackingElements(document);

    // 5. 添加基础样式（确保可读性）
    addBaseStyles(document);

    // 6. 获取最终 HTML
    let finalHtml = dom.serialize();

    // 7. 检查大小限制
    const size = Buffer.byteLength(finalHtml, "utf8");
    if (size > maxOutputSize) {
      // 如果超过大小限制，移除内联图片
      logger.warn(
        { size, maxOutputSize },
        "[HtmlInliner] Output exceeds size limit, removing inline images",
      );

      finalHtml = removeInlineImages(finalHtml);
      errors.push(
        `输出超过大小限制 (${Math.round(size / 1024)}KB)，已移除内联图片`,
      );
    }

    return {
      html: finalHtml,
      size: Buffer.byteLength(finalHtml, "utf8"),
      inlinedImages,
      skippedImages,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "[HtmlInliner] Failed to inline HTML",
    );

    return {
      html,
      size: Buffer.byteLength(html, "utf8"),
      inlinedImages: 0,
      skippedImages: 0,
      errors: [errorMessage],
    };
  }
}

// ============================================================================
// 清理函数
// ============================================================================

/**
 * 清理文档中的危险内容
 */
function sanitizeDocument(document: Document): void {
  // 移除危险标签
  for (const tag of DANGEROUS_TAGS) {
    const elements = document.querySelectorAll(tag);
    elements.forEach((el) => el.remove());
  }

  // 移除危险属性
  const allElements = document.querySelectorAll("*");
  allElements.forEach((el) => {
    for (const attr of DANGEROUS_ATTRS) {
      el.removeAttribute(attr);
    }

    // 移除 javascript: 协议链接
    const href = el.getAttribute("href");
    if (href && href.toLowerCase().startsWith("javascript:")) {
      el.removeAttribute("href");
    }

    const src = el.getAttribute("src");
    if (src && src.toLowerCase().startsWith("javascript:")) {
      el.removeAttribute("src");
    }
  });
}

/**
 * 移除追踪元素
 */
function removeTrackingElements(document: Document): void {
  for (const selector of TRACKING_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
    } catch {
      // 忽略无效选择器
    }
  }
}

// ============================================================================
// CSS 处理
// ============================================================================

/**
 * 内联 CSS 样式
 */
async function inlineCssStyles(
  document: Document,
  baseUrl: string,
  errors: string[],
): Promise<void> {
  // 1. 收集外部样式表
  const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
  const cssPromises: Promise<string>[] = [];

  for (const link of linkElements) {
    const href = link.getAttribute("href");
    if (href) {
      const absoluteUrl = resolveUrl(href, baseUrl);
      cssPromises.push(fetchCss(absoluteUrl, errors));
    }
    // 移除 link 标签
    link.remove();
  }

  // 2. 并行获取 CSS
  const cssContents = await Promise.all(cssPromises);
  const allCss = cssContents.filter(Boolean).join("\n");

  // 3. 处理现有 style 标签
  const styleElements = document.querySelectorAll("style");
  let existingCss = "";
  styleElements.forEach((style) => {
    existingCss += style.textContent || "";
    style.remove();
  });

  // 4. 创建合并的 style 标签
  if (allCss || existingCss) {
    const mergedStyle = document.createElement("style");
    mergedStyle.textContent = processCss(allCss + "\n" + existingCss, baseUrl);
    document.head.appendChild(mergedStyle);
  }
}

/**
 * 获取 CSS 内容
 */
async function fetchCss(url: string, errors: string[]): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/css,*/*;q=0.1",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    const message = `CSS 获取失败: ${url}`;
    logger.debug({ url, error }, "[HtmlInliner] CSS fetch failed");
    errors.push(message);
    return "";
  }
}

/**
 * 处理 CSS 内容（修复相对路径等）
 */
function processCss(css: string, baseUrl: string): string {
  // 移除 @import（避免外部依赖）
  css = css.replace(/@import\s+[^;]+;/g, "");

  // 修复 url() 中的相对路径
  css = css.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, url) => {
    if (url.startsWith("data:") || url.startsWith("http")) {
      return match;
    }
    const absoluteUrl = resolveUrl(url, baseUrl);
    return `url('${absoluteUrl}')`;
  });

  return css;
}

// ============================================================================
// 图片处理
// ============================================================================

/**
 * 内联图片资源
 */
async function inlineImageResources(
  document: Document,
  baseUrl: string,
  errors: string[],
): Promise<{ inlined: number; skipped: number }> {
  const images = document.querySelectorAll("img[src]");
  let inlined = 0;
  let skipped = 0;

  // 分批处理图片
  const imageArray = Array.from(images);
  for (let i = 0; i < imageArray.length; i += MAX_CONCURRENT_IMAGES) {
    const batch = imageArray.slice(i, i + MAX_CONCURRENT_IMAGES);

    await Promise.all(
      batch.map(async (img) => {
        const src = img.getAttribute("src");
        if (!src) return;

        // 跳过已经是 data URL 的图片
        if (src.startsWith("data:")) {
          inlined++;
          return;
        }

        try {
          const absoluteUrl = resolveUrl(src, baseUrl);
          const dataUrl = await fetchImageAsDataUrl(absoluteUrl);

          if (dataUrl) {
            img.setAttribute("src", dataUrl);
            // 移除 srcset（避免额外请求）
            img.removeAttribute("srcset");
            inlined++;
          } else {
            // 保留原始 URL
            img.setAttribute("src", absoluteUrl);
            skipped++;
          }
        } catch (error) {
          const message = `图片处理失败: ${src}`;
          logger.debug({ src, error }, "[HtmlInliner] Image processing failed");
          errors.push(message);
          skipped++;
        }
      }),
    );
  }

  return { inlined, skipped };
}

/**
 * 获取图片并转为 data URL
 */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "image/*",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    // 检查内容类型
    const contentType = response.headers.get("content-type") || "";
    const isImage = SUPPORTED_IMAGE_TYPES.some((type) =>
      contentType.includes(type),
    );

    if (!isImage) {
      return null;
    }

    // 检查大小
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
      return null;
    }

    const buffer = await response.arrayBuffer();

    // 二次检查大小
    if (buffer.byteLength > MAX_IMAGE_SIZE) {
      return null;
    }

    // 转为 base64
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = contentType.split(";")[0].trim() || "image/png";

    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * 移除内联图片（超大小时的降级策略）
 */
function removeInlineImages(html: string): string {
  // 将 data URL 图片替换为占位符
  return html.replace(
    /src="data:image\/[^"]+"/g,
    'src="" data-removed="size-limit"',
  );
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 解析相对 URL
 */
function resolveUrl(url: string, baseUrl: string): string {
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * 添加基础样式（确保快照可读性）
 */
function addBaseStyles(document: Document): void {
  const baseStyle = document.createElement("style");
  baseStyle.setAttribute("data-snapshot-base", "true");
  baseStyle.textContent = `
    /* AnyKeep Snapshot Base Styles */
    body {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #333;
      background: #fff;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    pre, code {
      overflow-x: auto;
      max-width: 100%;
    }
    a {
      color: #0066cc;
    }
    @media (prefers-color-scheme: dark) {
      body {
        color: #e0e0e0;
        background: #1a1a1a;
      }
      a {
        color: #66b3ff;
      }
    }
  `;
  document.head.insertBefore(baseStyle, document.head.firstChild);
}

// ============================================================================
// 导出
// ============================================================================

const htmlInliner = {
  inlineHtml,
};

export default htmlInliner;
