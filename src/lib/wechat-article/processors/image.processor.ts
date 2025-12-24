/**
 * 微信文章图片处理器
 *
 * @module wechat-article/processors
 * @description 处理微信公众号文章图片的提取和持久化
 */

import type { WechatArticleImage } from "../wechat-article.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import {
  DEFAULT_CRAWL_CONFIG,
  EXCLUDE_IMAGE_PATTERNS,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Reserved for future host validation
  ALLOWED_IMAGE_HOSTS,
  IMAGE_FETCH_HEADERS,
  IMAGE_REFERER_LIST,
  generateImageStoragePath,
  getExtFromMime,
  getProxyUrl,
} from "../wechat-article.config";

// =============================================================================
// 图片提取
// =============================================================================

/**
 * 优化微信图片 URL，获取高清原图
 *
 * 微信图片 URL 参数说明：
 * - wx_fmt: 图片格式（jpeg/png/gif）
 * - tp=webp: 转换为 webp（压缩）
 * - wx_lazy=1: 懒加载标记
 * - wx_co=1: 原图参数（关键！）
 * - wxfrom: 来源标记
 *
 * Phase 2 升级：获取原图质量
 */
export function optimizeWechatImageUrl(url: string): string {
  if (!url.includes("mmbiz.qpic.cn")) return url;

  try {
    const urlObj = new URL(url);

    // 移除压缩参数
    urlObj.searchParams.delete("tp");
    urlObj.searchParams.delete("wx_lazy");
    urlObj.searchParams.delete("wxfrom");

    // 添加原图参数
    urlObj.searchParams.set("wx_co", "1");

    // 保留格式参数，优先 jpeg
    if (!urlObj.searchParams.has("wx_fmt")) {
      urlObj.searchParams.set("wx_fmt", "jpeg");
    }

    return urlObj.toString();
  } catch {
    return url;
  }
}

/**
 * 验证图片数据有效性（检查 magic bytes）
 *
 * Phase 2 升级：确保下载的是真实图片数据
 */
function isValidImageBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;

  const arr = new Uint8Array(buffer);

  // JPEG: FF D8 FF
  if (arr[0] === 0xff && arr[1] === 0xd8 && arr[2] === 0xff) return true;

  // PNG: 89 50 4E 47
  if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4e && arr[3] === 0x47)
    return true;

  // GIF: 47 49 46 38
  if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38)
    return true;

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46)
    return true;

  return false;
}

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
 * 下载选项
 */
interface DownloadOptions {
  /** 超时时间 (ms) */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
  /** 是否使用代理 */
  useProxy?: boolean;
  /** 代理索引 */
  proxyIndex?: number;
}

/**
 * 增强的图片下载函数
 *
 * Phase 2 升级：支持重试、多 Referer、代理降级、数据验证
 *
 * @param url - 图片 URL
 * @param options - 下载选项
 * @returns 图片数据和 MIME 类型
 */
async function downloadImageEnhanced(
  url: string,
  options: DownloadOptions = {},
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const {
    timeout = DEFAULT_CRAWL_CONFIG.imageTimeout,
    retries = 3,
    useProxy = false,
    proxyIndex = 0,
  } = options;

  // 优化 URL 获取原图
  const optimizedUrl = optimizeWechatImageUrl(url);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    const referer = IMAGE_REFERER_LIST[attempt % IMAGE_REFERER_LIST.length];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // 构建请求头（使用 Record 类型以支持动态属性）
      const headers: Record<string, string> = {
        "User-Agent":
          (IMAGE_FETCH_HEADERS as Record<string, string>)["User-Agent"] ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept:
          (IMAGE_FETCH_HEADERS as Record<string, string>)["Accept"] ||
          "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Cache-Control": "no-cache",
      };

      // 设置 Referer（空值时不设置）
      if (referer) {
        headers["Referer"] = referer;
      }

      // 确定目标 URL
      const targetUrl = useProxy
        ? getProxyUrl(optimizedUrl, proxyIndex)
        : optimizedUrl;

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/jpeg";

      // 验证是否为有效图片数据
      if (!isValidImageBuffer(buffer)) {
        throw new Error("Invalid image data (magic bytes check failed)");
      }

      return { buffer, contentType };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.error(
        { attempt: attempt + 1, retries, error: lastError.message },
        "[ImageProcessor] Download attempt failed",
      );

      // 最后一次直接尝试失败，切换到代理
      if (attempt === retries - 1 && !useProxy) {
        logger.error({}, "[ImageProcessor] Switching to proxy service...");
        return downloadImageEnhanced(url, {
          ...options,
          useProxy: true,
          retries: 2, // 代理重试 2 次
        });
      }

      // 等待后重试（指数退避）
      if (attempt < retries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * Math.pow(2, attempt)),
        );
      }
    }
  }

  throw lastError || new Error("Download failed after all retries");
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
 * 持久化单张图片
 *
 * Phase 2 升级：使用增强下载函数，提高成功率
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
    // 1. 使用增强下载函数（自动重试 + 代理降级）
    const { buffer, contentType } = await downloadImageEnhanced(
      image.originalUrl,
    );

    // 2. 检查文件大小（跳过过大的图片）
    const fileSize = buffer.byteLength;
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (fileSize > maxSize) {
      logger.error(
        { fileSize },
        "[ImageProcessor] Image too large, using original URL with referrerPolicy",
      );
      return {
        ...image,
        persistedUrl: null, // 保留原始 URL，前端使用 referrerPolicy="no-referrer" 访问
        status: "fallback",
        fileSize,
        error: "Image exceeds size limit (5MB)",
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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(
      { imageUrl: image.originalUrl, error: errorMessage },
      "[ImageProcessor] Failed to persist image",
    );

    // 持久化失败，保留原始 URL（前端使用 referrerPolicy="no-referrer" 访问）
    return {
      ...image,
      persistedUrl: null,
      status: "fallback",
      error: errorMessage,
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
