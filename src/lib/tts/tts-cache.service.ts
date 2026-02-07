/**
 * TTS 音频缓存服务
 *
 * 基于 Supabase Storage 实现服务端音频缓存，避免重复合成
 *
 * 缓存策略：
 * - 缓存键：bookmarkId + contentType + voice + speed
 * - 缓存位置：Supabase Storage tts-cache bucket
 * - 过期策略：通过定时任务清理（可选）
 *
 * @version 1.0.0
 * @since 2026-02-07
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { TTSAudioFormat, TTSContentType } from "./types";

// ============================================
// 常量
// ============================================

const MODULE_NAME = "TTSCacheService";
const CACHE_BUCKET = "tts-cache";

// ============================================
// 类型定义
// ============================================

/**
 * 缓存键参数
 */
export interface TTSCacheKey {
  /** 用户 ID */
  userId: string;
  /** 书签 ID */
  bookmarkId: number;
  /** 内容类型 */
  contentType: TTSContentType;
  /** ��音 ID */
  voice: string;
  /** 语速 */
  speed: number;
}

/**
 * 缓存元数据
 */
export interface TTSCacheMetadata {
  /** 音频格式 */
  format: TTSAudioFormat;
  /** 音频时长（秒） */
  durationSec: number;
  /** 字符数 */
  charCount: number;
  /** 书签标题 */
  bookmarkTitle: string;
  /** 创建时间 */
  createdAt: string;
  /** 原始请求 ID */
  originalRequestId: string;
}

/**
 * 缓存命中结果
 */
export interface TTSCacheHit {
  /** 是否命中 */
  hit: true;
  /** Base64 音频数据 */
  audioBase64: string;
  /** 元数据 */
  metadata: TTSCacheMetadata;
}

/**
 * 缓存未命中结果
 */
export interface TTSCacheMiss {
  /** 是否命中 */
  hit: false;
}

export type TTSCacheResult = TTSCacheHit | TTSCacheMiss;

// ============================================
// 辅助函数
// ============================================

/**
 * 生成缓存键（文件路径）
 *
 * 格式：{userId}/{bookmarkId}/{contentType}_{voice}_{speed}.mp3
 */
function generateCacheKey(params: TTSCacheKey): string {
  const { userId, bookmarkId, contentType, voice, speed } = params;
  // 规范化 speed 为 2 位小数
  const normalizedSpeed = speed.toFixed(2);
  // 清理 voice 中的特殊字符
  const safeVoice = voice.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${userId}/${bookmarkId}/${contentType}_${safeVoice}_${normalizedSpeed}.mp3`;
}

/**
 * 生成元数据文件路径
 */
function generateMetadataKey(params: TTSCacheKey): string {
  return generateCacheKey(params).replace(".mp3", ".json");
}

// ============================================
// 缓存服务类
// ============================================

class TTSCacheService {
  /**
   * 获取缓存
   */
  async get(params: TTSCacheKey): Promise<TTSCacheResult> {
    const startTime = Date.now();
    const cacheKey = generateCacheKey(params);
    const metadataKey = generateMetadataKey(params);

    try {
      const supabase = await createClient();

      // 并行获取音频和元数据
      const [audioResult, metadataResult] = await Promise.all([
        supabase.storage.from(CACHE_BUCKET).download(cacheKey),
        supabase.storage.from(CACHE_BUCKET).download(metadataKey),
      ]);

      // 检查是否都成功
      if (audioResult.error || metadataResult.error) {
        logger.debug(
          {
            module: MODULE_NAME,
            cacheKey,
            audioError: audioResult.error?.message,
            metadataError: metadataResult.error?.message,
            latencyMs: Date.now() - startTime,
          },
          "Cache miss",
        );
        return { hit: false };
      }

      // 读取音频数据并转为 Base64
      const audioArrayBuffer = await audioResult.data.arrayBuffer();
      const audioBase64 = Buffer.from(audioArrayBuffer).toString("base64");

      // 读取元数据
      const metadataText = await metadataResult.data.text();
      const metadata: TTSCacheMetadata = JSON.parse(metadataText);

      logger.info(
        {
          module: MODULE_NAME,
          cacheKey,
          audioSize: audioArrayBuffer.byteLength,
          latencyMs: Date.now() - startTime,
        },
        "Cache hit",
      );

      return {
        hit: true,
        audioBase64,
        metadata,
      };
    } catch (error) {
      logger.warn(
        {
          module: MODULE_NAME,
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
          latencyMs: Date.now() - startTime,
        },
        "Cache get error",
      );
      return { hit: false };
    }
  }

  /**
   * 设置缓存
   */
  async set(
    params: TTSCacheKey,
    audioBuffer: ArrayBuffer,
    metadata: TTSCacheMetadata,
  ): Promise<boolean> {
    const startTime = Date.now();
    const cacheKey = generateCacheKey(params);
    const metadataKey = generateMetadataKey(params);

    try {
      const supabase = await createClient();

      // 准备上传数据
      const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
      const metadataBlob = new Blob([JSON.stringify(metadata)], {
        type: "application/json",
      });

      // 并行上传音频和元数据
      const [audioResult, metadataResult] = await Promise.all([
        supabase.storage.from(CACHE_BUCKET).upload(cacheKey, audioBlob, {
          contentType: "audio/mpeg",
          upsert: true,
        }),
        supabase.storage.from(CACHE_BUCKET).upload(metadataKey, metadataBlob, {
          contentType: "application/json",
          upsert: true,
        }),
      ]);

      if (audioResult.error || metadataResult.error) {
        logger.warn(
          {
            module: MODULE_NAME,
            cacheKey,
            audioError: audioResult.error?.message,
            metadataError: metadataResult.error?.message,
            latencyMs: Date.now() - startTime,
          },
          "Cache set failed",
        );
        return false;
      }

      logger.info(
        {
          module: MODULE_NAME,
          cacheKey,
          audioSize: audioBuffer.byteLength,
          latencyMs: Date.now() - startTime,
        },
        "Cache set success",
      );

      return true;
    } catch (error) {
      logger.warn(
        {
          module: MODULE_NAME,
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
          latencyMs: Date.now() - startTime,
        },
        "Cache set error",
      );
      return false;
    }
  }

  /**
   * 删除缓存（书签更新时调用）
   */
  async invalidate(userId: string, bookmarkId: number): Promise<boolean> {
    const startTime = Date.now();
    const prefix = `${userId}/${bookmarkId}/`;

    try {
      const supabase = await createClient();

      // 列出该书签的所有缓存文件
      const { data: files, error: listError } = await supabase.storage
        .from(CACHE_BUCKET)
        .list(`${userId}/${bookmarkId}`);

      if (listError) {
        logger.warn(
          {
            module: MODULE_NAME,
            prefix,
            error: listError.message,
          },
          "Cache invalidate list error",
        );
        return false;
      }

      if (!files || files.length === 0) {
        logger.debug(
          {
            module: MODULE_NAME,
            prefix,
          },
          "No cache files to invalidate",
        );
        return true;
      }

      // 删除所有文件
      const filePaths = files.map((f) => `${userId}/${bookmarkId}/${f.name}`);
      const { error: removeError } = await supabase.storage
        .from(CACHE_BUCKET)
        .remove(filePaths);

      if (removeError) {
        logger.warn(
          {
            module: MODULE_NAME,
            prefix,
            fileCount: filePaths.length,
            error: removeError.message,
          },
          "Cache invalidate remove error",
        );
        return false;
      }

      logger.info(
        {
          module: MODULE_NAME,
          prefix,
          fileCount: filePaths.length,
          latencyMs: Date.now() - startTime,
        },
        "Cache invalidated",
      );

      return true;
    } catch (error) {
      logger.warn(
        {
          module: MODULE_NAME,
          prefix,
          error: error instanceof Error ? error.message : String(error),
        },
        "Cache invalidate error",
      );
      return false;
    }
  }
}

// ============================================
// 单例导出
// ============================================

let _cacheService: TTSCacheService | null = null;

/**
 * 获取 TTS 缓存服务实例
 */
export function getTTSCacheService(): TTSCacheService {
  if (!_cacheService) {
    _cacheService = new TTSCacheService();
  }
  return _cacheService;
}

/**
 * 重置 TTS 缓存服务（测试用）
 */
export function resetTTSCacheService(): void {
  _cacheService = null;
}
