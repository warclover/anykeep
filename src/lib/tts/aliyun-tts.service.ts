/**
 * 阿里云 TTS 服务
 *
 * 基于阿里云 DashScope CosyVoice API 实现语音合成
 *
 * API 文档: https://help.aliyun.com/zh/dashscope/developer-reference/api-details-25
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { logger } from "@/lib/logger";
import type {
  TTSOptions,
  TTSResult,
  TTSServiceStatus,
  TTSVoiceGender,
} from "./types";
import { TTS_DEFAULT_CONFIG, TTS_ERROR_CODES } from "./types";

// ============================================
// 常量
// ============================================

/** DashScope TTS API 端点 */
const DASHSCOPE_TTS_ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2audio/generation";

/** 服务模块名 */
const MODULE_NAME = "AliyunTTSService";

// ============================================
// 内部类型
// ============================================

/**
 * DashScope TTS API 请求体
 */
interface DashScopeTTSRequest {
  model: string;
  input: {
    text: string;
  };
  parameters?: {
    voice?: string;
    format?: string;
    sample_rate?: number;
    rate?: number; // 语速 (0.5-2.0)
    volume?: number; // 音量 (0-100)
  };
}

/**
 * DashScope TTS API 响应体
 */
interface DashScopeTTSResponse {
  request_id: string;
  output?: {
    audio?: string; // Base64 编码的音频
  };
  usage?: {
    characters: number;
  };
  code?: string;
  message?: string;
}

// ============================================
// 服务实现
// ============================================

/**
 * 阿里云 TTS 服务类
 */
class AliyunTTSService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.DASHSCOPE_API_KEY;
  }

  /**
   * 检查服务可用性
   */
  isAvailable(): TTSServiceStatus {
    if (!this.apiKey) {
      return {
        available: false,
        reason: "DASHSCOPE_API_KEY 未配置",
        apiKeyConfigured: false,
      };
    }

    return {
      available: true,
      apiKeyConfigured: true,
    };
  }

  /**
   * 语音合成
   *
   * @param text - 要合成的文本
   * @param options - 合成选项
   * @returns 合成结果
   */
  async synthesize(text: string, options?: TTSOptions): Promise<TTSResult> {
    const startTime = Date.now();

    // 检查服务可用性
    const status = this.isAvailable();
    if (!status.available) {
      throw new TTSError(
        TTS_ERROR_CODES.API_KEY_MISSING,
        status.reason ?? "Service unavailable",
      );
    }

    // 预处理文本
    const processedText = this.preprocessText(text);
    if (!processedText) {
      throw new TTSError(TTS_ERROR_CODES.TEXT_EMPTY, "文本内容为空");
    }

    // 检查文本长度
    if (processedText.length > TTS_DEFAULT_CONFIG.maxTextLength) {
      throw new TTSError(
        TTS_ERROR_CODES.TEXT_TOO_LONG,
        `文本长度 ${processedText.length} 超过最大限制 ${TTS_DEFAULT_CONFIG.maxTextLength}`,
      );
    }

    // 合并选项
    const mergedOptions = this.mergeOptions(options);

    logger.info(
      {
        module: MODULE_NAME,
        textLength: processedText.length,
        voice: mergedOptions.voice,
        format: mergedOptions.format,
        speed: mergedOptions.speed,
      },
      "Starting TTS synthesis",
    );

    // 构建请求体
    const requestBody: DashScopeTTSRequest = {
      model: mergedOptions.model,
      input: {
        text: processedText,
      },
      parameters: {
        voice: mergedOptions.voice,
        format: mergedOptions.format,
        sample_rate: mergedOptions.sampleRate,
        rate: mergedOptions.speed,
        volume: mergedOptions.volume,
      },
    };

    try {
      // 发送请求
      const response = await fetch(DASHSCOPE_TTS_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "disable", // 同步模式
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(TTS_DEFAULT_CONFIG.timeoutMs),
      });

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          {
            module: MODULE_NAME,
            status: response.status,
            errorText,
          },
          "TTS API request failed",
        );
        throw new TTSError(
          TTS_ERROR_CODES.API_ERROR,
          `API 请求失败: ${response.status} - ${errorText}`,
        );
      }

      // 解析响应
      const data: DashScopeTTSResponse = await response.json();

      // 检查 API 错误
      if (data.code) {
        logger.error(
          {
            module: MODULE_NAME,
            code: data.code,
            message: data.message,
            requestId: data.request_id,
          },
          "TTS API returned error",
        );
        throw new TTSError(
          TTS_ERROR_CODES.API_ERROR,
          `TTS 合成失败: ${data.code} - ${data.message}`,
        );
      }

      // 检查音频数据
      if (!data.output?.audio) {
        throw new TTSError(TTS_ERROR_CODES.API_ERROR, "API 响应中无音频数据");
      }

      // 解码 Base64 音频
      const audioBuffer = this.base64ToArrayBuffer(data.output.audio);

      // 估算音频时长（基于字符数和语速）
      const estimatedDuration = this.estimateDuration(
        processedText.length,
        mergedOptions.speed,
      );

      const latencyMs = Date.now() - startTime;

      logger.info(
        {
          module: MODULE_NAME,
          requestId: data.request_id,
          charCount: data.usage?.characters || processedText.length,
          audioSize: audioBuffer.byteLength,
          estimatedDuration,
          latencyMs,
        },
        "TTS synthesis completed",
      );

      return {
        audio: audioBuffer,
        format: mergedOptions.format,
        durationSec: estimatedDuration,
        requestId: data.request_id,
        charCount: data.usage?.characters || processedText.length,
      };
    } catch (error) {
      // 处理网络错误
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new TTSError(TTS_ERROR_CODES.NETWORK_ERROR, "网络请求失败");
      }

      // 处理超时
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new TTSError(TTS_ERROR_CODES.NETWORK_ERROR, "请求超时");
      }

      // 重新抛出 TTS 错误
      if (error instanceof TTSError) {
        throw error;
      }

      // 未知错误
      logger.error(
        {
          module: MODULE_NAME,
          error: error instanceof Error ? error.message : String(error),
        },
        "TTS synthesis unexpected error",
      );
      throw new TTSError(
        TTS_ERROR_CODES.API_ERROR,
        `语音合成失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  /**
   * 获取指定性别的默认语音
   */
  getDefaultVoice(gender: TTSVoiceGender): string {
    return TTS_DEFAULT_CONFIG.voices[gender];
  }

  /**
   * 文本预处理
   *
   * - 移除 Markdown 语法
   * - 移除多余空白
   * - 处理特殊字符
   */
  preprocessText(text: string): string {
    if (!text) return "";

    let processed = text;

    // 移除 Markdown 链接 [text](url) -> text
    processed = processed.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // 移除 Markdown 图片 ![alt](url) -> alt
    processed = processed.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

    // 移除 Markdown 粗体/斜体 **text** / *text* / __text__ / _text_ -> text
    processed = processed.replace(/(\*\*|__)(.*?)\1/g, "$2");
    processed = processed.replace(/(\*|_)(.*?)\1/g, "$2");

    // 移除 Markdown 代码块 ```code``` -> code
    processed = processed.replace(/```[\s\S]*?```/g, "");

    // 移除行内代码 `code` -> code
    processed = processed.replace(/`([^`]+)`/g, "$1");

    // 移除 Markdown 标题符号 # ## ### -> (空)
    processed = processed.replace(/^#{1,6}\s*/gm, "");

    // 移除 Markdown 列表符号 - * + 1. -> (空)
    processed = processed.replace(/^[\s]*[-*+]\s+/gm, "");
    processed = processed.replace(/^[\s]*\d+\.\s+/gm, "");

    // 移除 HTML 标签
    processed = processed.replace(/<[^>]+>/g, "");

    // 移除 URL
    processed = processed.replace(/https?:\/\/[^\s]+/g, "");

    // 规范化空白
    processed = processed.replace(/\s+/g, " ").trim();

    return processed;
  }

  /**
   * 合并选项与默认值
   */
  private mergeOptions(options?: TTSOptions): Required<TTSOptions> {
    return {
      model: options?.model || TTS_DEFAULT_CONFIG.model,
      voice: options?.voice || TTS_DEFAULT_CONFIG.voices.female,
      sampleRate: options?.sampleRate || TTS_DEFAULT_CONFIG.sampleRate,
      format: options?.format || TTS_DEFAULT_CONFIG.format,
      speed: options?.speed || TTS_DEFAULT_CONFIG.speed,
      volume: options?.volume || TTS_DEFAULT_CONFIG.volume,
    };
  }

  /**
   * Base64 转 ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // 处理 Data URL 格式
    const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * 估算音频时长
   *
   * 基于中文语速约 4-5 字/秒
   */
  private estimateDuration(charCount: number, speed: number): number {
    const baseCharsPerSecond = 4.5;
    const adjustedCharsPerSecond = baseCharsPerSecond * speed;
    return Math.round((charCount / adjustedCharsPerSecond) * 10) / 10;
  }
}

// ============================================
// TTS 错误类
// ============================================

/**
 * TTS 错误
 */
export class TTSError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TTSError";
  }
}

// ============================================
// 单例导出
// ============================================

let _ttsService: AliyunTTSService | null = null;

/**
 * 获取 TTS 服务实例
 */
export function getTTSService(): AliyunTTSService {
  if (!_ttsService) {
    _ttsService = new AliyunTTSService();
  }
  return _ttsService;
}

/**
 * 重置 TTS 服务（测试用）
 */
export function resetTTSService(): void {
  _ttsService = null;
}
