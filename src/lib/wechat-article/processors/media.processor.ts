/**
 * 微信文章媒体元素处理器
 *
 * @module wechat-article/processors
 * @description 处理微信公众号文章中的视频、音频等媒体元素
 *
 * Phase 3 升级：保留视频/音频占位，尝试下载保存
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CRAWL_CONFIG } from "../wechat-article.config";

// =============================================================================
// 类型定义
// =============================================================================

export interface MediaElement {
  /** 媒体类型 */
  type: "video" | "audio" | "vote" | "miniprogram" | "link";
  /** 标题 */
  title: string;
  /** 封面 URL */
  coverUrl?: string;
  /** 源 URL */
  sourceUrl?: string;
  /** 时长（音频/视频） */
  duration?: string;
  /** 投票选项 */
  options?: string[];
  /** 本地化 URL（下载成功后） */
  localUrl?: string;
  /** 下载状态 */
  downloadStatus?: "pending" | "success" | "failed" | "skipped";
  /** 错误信息 */
  error?: string;
  /** 文件大小 */
  fileSize?: number;
}

export interface MediaProcessResult {
  /** 处理后的 HTML */
  html: string;
  /** 提取的媒体元素列表 */
  media: MediaElement[];
}

// =============================================================================
// HTML 实体解码
// =============================================================================

/**
 * 解码 HTML 实体
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return "";

  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// =============================================================================
// 视频处理
// =============================================================================

/**
 * 提取并转换视频元素
 *
 * 支持的视频格式：
 * - mpvideosnap: 微信原生视频
 * - iframe: 腾讯视频等嵌入视频
 */
export function processVideoElements(html: string): MediaProcessResult {
  const videos: MediaElement[] = [];

  let processedHtml = html;

  // 处理 mpvideosnap（微信原生视频）
  processedHtml = processedHtml.replace(
    /<mpvideosnap[^>]*?(?:data-cover="([^"]*)")?[^>]*?(?:data-title="([^"]*)")?[^>]*?(?:data-url="([^"]*)")?[^>]*>[\s\S]*?<\/mpvideosnap>/gi,
    (match, cover, title, url) => {
      const decodedTitle = decodeHtmlEntities(title || "视频");
      const decodedUrl = decodeHtmlEntities(url || "");
      const decodedCover = decodeHtmlEntities(cover || "");

      videos.push({
        type: "video",
        title: decodedTitle,
        coverUrl: decodedCover || undefined,
        sourceUrl: decodedUrl || undefined,
        downloadStatus: "pending",
      });

      // 生成占位卡片
      return generateVideoPlaceholder(
        decodedTitle,
        decodedCover,
        decodedUrl,
        videos.length - 1,
      );
    },
  );

  // 处理 iframe 视频（腾讯视频等）
  processedHtml = processedHtml.replace(
    /<iframe[^>]*class="[^"]*video_iframe[^"]*"[^>]*(?:data-src|src)="([^"]*)"[^>]*>[\s\S]*?<\/iframe>/gi,
    (match, src) => {
      const decodedSrc = decodeHtmlEntities(src || "");

      videos.push({
        type: "video",
        title: "嵌入视频",
        sourceUrl: decodedSrc || undefined,
        downloadStatus: "skipped", // 嵌入视频无法下载
      });

      return `
        <div class="wechat-iframe-placeholder" data-video-index="${videos.length - 1}">
          <div class="media-icon">🎬</div>
          <div class="media-info">
            <span class="media-title">嵌入视频</span>
            ${decodedSrc ? `<a href="${decodedSrc}" target="_blank" rel="noopener noreferrer">查看原视频</a>` : ""}
          </div>
        </div>
      `.trim();
    },
  );

  return { html: processedHtml, media: videos };
}

/**
 * 生成视频占位卡片 HTML
 */
function generateVideoPlaceholder(
  title: string,
  cover: string,
  url: string,
  index: number,
): string {
  const coverHtml = cover
    ? `<div class="video-cover">
        <img src="${cover}" alt="${title}" loading="lazy" />
        <div class="play-icon">▶</div>
       </div>`
    : `<div class="video-cover video-cover-placeholder">
        <div class="play-icon">▶</div>
       </div>`;

  const linkHtml = url
    ? `<a href="${url}" target="_blank" rel="noopener noreferrer">打开视频</a>`
    : "";

  return `
    <div class="wechat-video-placeholder" data-video-index="${index}">
      ${coverHtml}
      <div class="video-info">
        <span class="video-title">${title}</span>
        ${linkHtml}
      </div>
    </div>
  `.trim();
}

// =============================================================================
// 音频处理
// =============================================================================

/**
 * 提取并转换音频元素
 */
export function processAudioElements(html: string): MediaProcessResult {
  const audios: MediaElement[] = [];

  const processedHtml = html.replace(
    /<mpvoice[^>]*?voice_encode_fileid="([^"]*)"[^>]*?name="([^"]*)"[^>]*?play_length="(\d+)"[^>]*>[\s\S]*?<\/mpvoice>/gi,
    (match, fileId, name, duration) => {
      const durationSeconds = parseInt(duration, 10) || 0;
      const durationStr = formatDuration(durationSeconds);
      const decodedName = decodeHtmlEntities(name || "音频");

      audios.push({
        type: "audio",
        title: decodedName,
        duration: durationStr,
        sourceUrl: fileId ? `https://res.wx.qq.com/voice/getvoice?mediaid=${fileId}` : undefined,
        downloadStatus: "pending",
      });

      return `
        <div class="wechat-audio-placeholder" data-audio-index="${audios.length - 1}">
          <span class="audio-icon">🎵</span>
          <span class="audio-name">${decodedName}</span>
          <span class="audio-duration">${durationStr}</span>
        </div>
      `.trim();
    },
  );

  return { html: processedHtml, media: audios };
}

/**
 * 格式化时长（秒 -> MM:SS）
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// =============================================================================
// 媒体下载
// =============================================================================

/**
 * 下载微信视频
 *
 * 注意：微信视频下载受限较多，成功率不高
 */
export async function downloadWechatVideo(
  videoUrl: string,
  snapshotId: number,
  supabase: SupabaseClient,
): Promise<{ success: boolean; localUrl?: string; fileSize?: number; error?: string }> {
  if (!videoUrl) {
    return { success: false, error: "No video URL provided" };
  }

  try {
    // 解析视频真实地址（微信视频可能需要二次请求）
    const realUrl = await resolveVideoUrl(videoUrl);
    if (!realUrl) {
      return { success: false, error: "Failed to resolve video URL" };
    }

    // 下载视频（限制大小 50MB）
    const maxSize = 50 * 1024 * 1024;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s 超时

    try {
      const response = await fetch(realUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://mp.weixin.qq.com/",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      // 检查 Content-Length
      const contentLength = parseInt(
        response.headers.get("content-length") || "0",
        10,
      );
      if (contentLength > maxSize) {
        return { success: false, error: `Video too large (${Math.round(contentLength / 1024 / 1024)}MB > 50MB)` };
      }

      const buffer = await response.arrayBuffer();
      const fileSize = buffer.byteLength;

      if (fileSize > maxSize) {
        return { success: false, error: `Video too large (${Math.round(fileSize / 1024 / 1024)}MB > 50MB)` };
      }

      const contentType = response.headers.get("content-type") || "video/mp4";

      // 上传到 Storage
      const path = `wechat/${snapshotId}/video_${Date.now()}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from(DEFAULT_CRAWL_CONFIG.storageBucket)
        .upload(path, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        return { success: false, error: `Upload failed: ${uploadError.message}` };
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from(DEFAULT_CRAWL_CONFIG.storageBucket)
        .getPublicUrl(path);

      return { success: true, localUrl: publicUrl, fileSize };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

/**
 * 解析微信视频真实地址
 *
 * 微信视频 URL 通常需要进一步解析才能获取真实下载地址
 */
async function resolveVideoUrl(url: string): Promise<string | null> {
  // 如果已经是直接的视频 URL，直接返回
  if (url.includes(".mp4") || url.includes("video")) {
    return url;
  }

  // 尝试从微信视频页面提取真实 URL
  // 注意：这部分需要根据微信实际 API 调整
  try {
    // 暂时直接返回原 URL，后续可以增加更多解析逻辑
    return url;
  } catch {
    return null;
  }
}

/**
 * 下载微信音频
 */
export async function downloadWechatAudio(
  audioUrl: string,
  snapshotId: number,
  supabase: SupabaseClient,
): Promise<{ success: boolean; localUrl?: string; fileSize?: number; error?: string }> {
  if (!audioUrl) {
    return { success: false, error: "No audio URL provided" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s 超时

    try {
      const response = await fetch(audioUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://mp.weixin.qq.com/",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const buffer = await response.arrayBuffer();
      const fileSize = buffer.byteLength;

      // 音频大小限制 20MB
      const maxSize = 20 * 1024 * 1024;
      if (fileSize > maxSize) {
        return { success: false, error: `Audio too large (${Math.round(fileSize / 1024 / 1024)}MB > 20MB)` };
      }

      const contentType = response.headers.get("content-type") || "audio/mpeg";

      // 上传到 Storage
      const path = `wechat/${snapshotId}/audio_${Date.now()}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from(DEFAULT_CRAWL_CONFIG.storageBucket)
        .upload(path, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        return { success: false, error: `Upload failed: ${uploadError.message}` };
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from(DEFAULT_CRAWL_CONFIG.storageBucket)
        .getPublicUrl(path);

      return { success: true, localUrl: publicUrl, fileSize };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }
}

// =============================================================================
// 综合处理
// =============================================================================

/**
 * 综合处理所有媒体元素
 *
 * 将视频、音频等特殊元素转换为占位卡片，并提取元数据
 */
export function processMediaElements(html: string): MediaProcessResult {
  let result = html;
  const allMedia: MediaElement[] = [];

  // 处理视频
  const { html: afterVideo, media: videos } = processVideoElements(result);
  result = afterVideo;
  allMedia.push(...videos);

  // 处理音频
  const { html: afterAudio, media: audios } = processAudioElements(result);
  result = afterAudio;
  allMedia.push(...audios);

  return { html: result, media: allMedia };
}

/**
 * 批量下载媒体元素
 *
 * @param media - 媒体元素列表
 * @param snapshotId - 快照 ID
 * @param onProgress - 进度回调
 * @returns 更新后的媒体元素列表
 */
export async function persistMedia(
  media: MediaElement[],
  snapshotId: number,
  onProgress?: (completed: number) => void,
): Promise<MediaElement[]> {
  if (media.length === 0) return [];

  // 动态导入 Supabase 客户端
  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  let completed = 0;
  const results: MediaElement[] = [];

  for (const item of media) {
    let result: MediaElement = { ...item };

    // 跳过已标记为 skipped 的媒体
    if (item.downloadStatus === "skipped") {
      results.push(result);
      completed++;
      onProgress?.(completed);
      continue;
    }

    if (item.type === "video" && item.sourceUrl) {
      const downloadResult = await downloadWechatVideo(
        item.sourceUrl,
        snapshotId,
        supabase,
      );

      result = {
        ...item,
        localUrl: downloadResult.localUrl,
        fileSize: downloadResult.fileSize,
        downloadStatus: downloadResult.success ? "success" : "failed",
        error: downloadResult.error,
      };
    } else if (item.type === "audio" && item.sourceUrl) {
      const downloadResult = await downloadWechatAudio(
        item.sourceUrl,
        snapshotId,
        supabase,
      );

      result = {
        ...item,
        localUrl: downloadResult.localUrl,
        fileSize: downloadResult.fileSize,
        downloadStatus: downloadResult.success ? "success" : "failed",
        error: downloadResult.error,
      };
    } else {
      result.downloadStatus = "skipped";
    }

    results.push(result);
    completed++;
    onProgress?.(completed);
  }

  return results;
}
