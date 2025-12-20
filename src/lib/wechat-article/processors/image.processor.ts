/**
 * 微信文章图片处理器
 *
 * @module wechat-article/processors
 * @description 处理微信公众号文章图片的提取和持久化
 */

import type { WechatArticleImage } from "../wechat-article.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_CRAWL_CONFIG,
  EXCLUDE_IMAGE_PATTERNS,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future host validation
  ALLOWED_IMAGE_HOSTS,
  IMAGE_FETCH_HEADERS,
  generateImageStoragePath,
  getExtFromMime,
} from "../wechat-article.config";

// =============================================================================
// 图片提取
// =============================================================================

/**
 * 检查图片 URL 是否有效
 *
 * 过滤规则：
 * - 必须是 HTTP/HTTPS URL
 * - 排除表情包、追踪像素、头像等
 * - 优先保留微信图片服务器的图片
 */
function isValidImageUrl(src: string): boolean {
  if (!src) return false;

  // 必须是 HTTP/HTTPS URL
  if (!src.startsWith("http://") && !src.startsWith("https://")) {
    return false;
  }

  // 检查排除规则
  for (const pattern of EXCLUDE_IMAGE_PATTERNS) {
    if (pattern.test(src)) {
      return false;
    }
  }

  return true;
}

/**
 * 从 HTML 提取图片列表
 *
 * @param html - 清理后的 HTML 内容
 * @returns 图片列表（去重后）
 */
export function extractImages(html: string): WechatArticleImage[] {
  if (!html) return [];

  // 匹配 img 标签，支持 src 和 data-src
  const imgRegex = /<img[^>]+(?:src|data-src)="([^"]+)"[^>]*>/gi;
  const images: WechatArticleImage[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const fullMatch = match[0];

    // 提取 src 或 data-src
    const srcMatch = fullMatch.match(/(?:src|data-src)="([^"]+)"/i);
    if (!srcMatch) continue;

    const src = srcMatch[1];

    // 验证 URL 有效性
    if (!isValidImageUrl(src)) continue;

    // 去重
    if (seen.has(src)) continue;
    seen.add(src);

    // 提取 alt 文本
    const altMatch = fullMatch.match(/alt="([^"]*)"/i);
    const alt = altMatch ? altMatch[1] : "";

    // 提取尺寸信息
    const widthMatch = fullMatch.match(/(?:width|data-w)="(\d+)"/i);
    const heightMatch = fullMatch.match(/(?:height|data-h)="(\d+)"/i);

    images.push({
      originalUrl: src,
      persistedUrl: null,
      alt,
      status: "pending",
      width: widthMatch ? parseInt(widthMatch[1], 10) : undefined,
      height: heightMatch ? parseInt(heightMatch[1], 10) : undefined,
    });

    // 限制最大图片数量
    if (images.length >= DEFAULT_CRAWL_CONFIG.maxImages) {
      break;
    }
  }

  return images;
}

// =============================================================================
// 图片持久化
// =============================================================================

/**
 * 下载单张图片
 *
 * @param url - 图片 URL
 * @param timeout - 超时时间 (ms)
 * @returns 图片数据和 MIME 类型
 */
async function downloadImage(
  url: string,
  timeout: number = DEFAULT_CRAWL_CONFIG.imageTimeout,
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: IMAGE_FETCH_HEADERS,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    return { buffer, contentType };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 上传图片到 Supabase Storage
 *
 * @param supabase - Supabase 客户端
 * @param buffer - 图片数据
 * @param path - 存储路径
 * @param contentType - MIME 类型
 * @returns 公开 URL
 */
async function uploadToStorage(
  supabase: SupabaseClient,
  buffer: ArrayBuffer,
  path: string,
  contentType: string,
): Promise<string> {
  const { error } = await supabase.storage
    .from(DEFAULT_CRAWL_CONFIG.storageBucket)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // 获取公开 URL
  const {
    data: { publicUrl },
  } = supabase.storage
    .from(DEFAULT_CRAWL_CONFIG.storageBucket)
    .getPublicUrl(path);

  return publicUrl;
}

/**
 * 生成降级代理 URL
 */
function getFallbackProxyUrl(originalUrl: string): string {
  return DEFAULT_CRAWL_CONFIG.fallbackProxyTemplate.replace(
    "{url}",
    encodeURIComponent(originalUrl),
  );
}

/**
 * 持久化单张图片
 *
 * @param supabase - Supabase 客户端
 * @param image - 图片元数据
 * @param snapshotId - 快照 ID
 * @param index - 图片索引
 * @returns 更新后的图片元数据
 */
async function persistSingleImage(
  supabase: SupabaseClient,
  image: WechatArticleImage,
  snapshotId: number,
  index: number,
): Promise<WechatArticleImage> {
  try {
    // 1. 下载图片
    const { buffer, contentType } = await downloadImage(image.originalUrl);

    // 2. 检查文件大小（跳过过大的图片）
    const fileSize = buffer.byteLength;
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (fileSize > maxSize) {
      console.error(
        `[ImageProcessor] Image too large (${fileSize} bytes), using fallback proxy`,
      );
      return {
        ...image,
        persistedUrl: getFallbackProxyUrl(image.originalUrl),
        status: "fallback",
        fileSize,
        error: "Image exceeds size limit",
      };
    }

    // 3. 上传到 Storage
    const ext = getExtFromMime(contentType);
    const path = generateImageStoragePath(snapshotId, index, ext);
    const publicUrl = await uploadToStorage(
      supabase,
      buffer,
      path,
      contentType,
    );

    return {
      ...image,
      persistedUrl: publicUrl,
      status: "success",
      fileSize,
    };
  } catch (error) {
    console.error(
      `[ImageProcessor] Failed to persist image: ${image.originalUrl}`,
      error instanceof Error ? error.message : error,
    );

    // 降级到代理服务
    return {
      ...image,
      persistedUrl: getFallbackProxyUrl(image.originalUrl),
      status: "fallback",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 批量持久化图片
 *
 * 使用 p-limit 控制并发数量
 *
 * @param images - 图片列表
 * @param snapshotId - 快照 ID
 * @param onProgress - 进度回调
 * @returns 更新后的图片列表
 */
export async function persistImages(
  images: WechatArticleImage[],
  snapshotId: number,
  onProgress?: (completed: number) => void,
): Promise<WechatArticleImage[]> {
  if (images.length === 0) return [];

  // 动态导入 Supabase 客户端和 p-limit
  const [{ createServiceClient }, pLimit] = await Promise.all([
    import("@/lib/supabase/server"),
    import("p-limit").then((m) => m.default),
  ]);

  const supabase = await createServiceClient();
  const limit = pLimit(DEFAULT_CRAWL_CONFIG.imageConcurrency);
  let completed = 0;

  const tasks = images.map((img, index) =>
    limit(async (): Promise<WechatArticleImage> => {
      const result = await persistSingleImage(supabase, img, snapshotId, index);

      completed++;
      onProgress?.(completed);

      return result;
    }),
  );

  return Promise.all(tasks);
}

/**
 * 计算图片统计信息
 */
export function calculateImagesStats(images: WechatArticleImage[]): {
  total: number;
  success: number;
  failed: number;
} {
  return {
    total: images.length,
    success: images.filter((i) => i.status === "success").length,
    failed: images.filter((i) => i.status === "failed").length,
  };
}

/**
 * 获取图片状态
 *
 * @returns 'completed' | 'partial' | 'failed' | 'pending'
 */
export function getImagesStatus(images: WechatArticleImage[]): string {
  if (images.length === 0) return "completed";

  const stats = calculateImagesStats(images);

  if (stats.failed === stats.total) return "failed";
  if (stats.failed > 0) return "partial";
  if (stats.success === stats.total) return "completed";

  return "pending";
}
