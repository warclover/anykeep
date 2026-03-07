/**
 * 阿里云 TTS 服务（WebSocket 实现）
 *
 * 基于阿里云 DashScope CosyVoice WebSocket API 实现语音合成
 *
 * API 文档: https://help.aliyun.com/zh/model-studio/cosyvoice-websocket-api
 *
 * @version 2.0.0
 * @since 2025-01-05
 */

import WebSocket from "ws";
import { logger } from "@/lib/logger";
import { aiEnv } from "@/lib/env";
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

/** DashScope WebSocket TTS API 端点 */
const DASHSCOPE_WS_ENDPOINT =
  "wss://dashscope.aliyuncs.com/api-ws/v1/inference/";

/** 服务模块名 */
const MODULE_NAME = "AliyunTTSService";

// ============================================
// 内部类型
// ============================================

/**
 * WebSocket 消息 Header
 */
interface WSMessageHeader {
  action: string;
  task_id: string;
  streaming?: string;
  event?: string;
  error_code?: string;
  error_message?: string;
  attributes?: Record<string, unknown>;
}

/**
 * WebSocket 消息 Payload
 */
interface WSMessagePayload {
  task_group?: string;
  task?: string;
  function?: string;
  model?: string;
  parameters?: {
    voice?: string;
    format?: string;
    sample_rate?: number;
    rate?: number;
    volume?: number;
  };
  input?: {
    text?: string;
  };
  output?: Record<string, unknown>;
  usage?: {
    characters?: number;
  };
}

/**
 * WebSocket 消息
 */
interface WSMessage {
  header: WSMessageHeader;
  payload?: WSMessagePayload;
}

// ============================================
// 服务实现
// ============================================

/**
 * 阿里云 TTS 服务类（WebSocket）
 */
class AliyunTTSService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = aiEnv.hasDashscopeApiKey ? aiEnv.dashscopeApiKey : undefined;
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
      "Starting TTS synthesis via WebSocket",
    );

    // 使用 WebSocket 进行合成
    return this.synthesizeViaWebSocket(processedText, mergedOptions, startTime);
  }

  /**
   * 通过 WebSocket 进行语音合成
   */
  private synthesizeViaWebSocket(
    text: string,
    options: Required<TTSOptions>,
    startTime: number,
  ): Promise<TTSResult> {
    return new Promise((resolve, reject) => {
      const taskId = this.generateTaskId();
      const audioChunks: Buffer[] = [];
      const requestId = taskId;
      const charCount = text.length;

      // 创建 WebSocket 连接
      const ws = new WebSocket(DASHSCOPE_WS_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      // 连接超时
      const timeoutId = setTimeout(() => {
        ws.close();
        reject(
          new TTSError(TTS_ERROR_CODES.NETWORK_ERROR, "WebSocket 连接超时"),
        );
      }, TTS_DEFAULT_CONFIG.timeoutMs);

      ws.on("open", () => {
        logger.debug({ module: MODULE_NAME, taskId }, "WebSocket connected");

        // 发送 run-task 指令
        const runTaskMessage: WSMessage = {
          header: {
            action: "run-task",
            task_id: taskId,
            streaming: "out",
          },
          payload: {
            task_group: "audio",
            task: "tts",
            function: "SpeechSynthesizer",
            model: options.model,
            parameters: {
              voice: options.voice,
              format: options.format,
              sample_rate: options.sampleRate,
              rate: options.speed,
              volume: options.volume,
            },
            input: {
              text: text,
            },
          },
        };

        ws.send(JSON.stringify(runTaskMessage));
        logger.debug({ module: MODULE_NAME, taskId }, "Sent run-task command");
      });

      ws.on("message", (data: Buffer | string) => {
        // 处理消息 - DashScope 可能将 JSON 也作为 Buffer 发送
        if (Buffer.isBuffer(data)) {
          const str = data.toString();
          // 检查是否为 JSON 消息（以 '{' 开头）
          if (str.startsWith("{")) {
            try {
              const message: WSMessage = JSON.parse(str);
              this.handleWSMessage(
                message,
                audioChunks,
                timeoutId,
                ws,
                options,
                startTime,
                charCount,
                requestId,
                resolve,
                reject,
              );
              return;
            } catch {
              // 不是有效 JSON，作为音频数据处理
            }
          }
          // 二进制音频数据
          audioChunks.push(data);
          return;
        }

        // 文本消息（JSON 事件）
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleWSMessage(
            message,
            audioChunks,
            timeoutId,
            ws,
            options,
            startTime,
            charCount,
            requestId,
            resolve,
            reject,
          );
        } catch (parseError) {
          logger.warn(
            {
              module: MODULE_NAME,
              taskId,
              error:
                parseError instanceof Error
                  ? parseError.message
                  : String(parseError),
            },
            "Failed to parse WebSocket message",
          );
        }
      });

      ws.on("error", (error: Error) => {
        clearTimeout(timeoutId);
        logger.error(
          {
            module: MODULE_NAME,
            taskId,
            error: error.message,
          },
          "WebSocket error",
        );
        reject(new TTSError(TTS_ERROR_CODES.NETWORK_ERROR, error.message));
      });

      ws.on("close", (code: number, reason: Buffer) => {
        clearTimeout(timeoutId);
        if (code !== 1000 && audioChunks.length === 0) {
          logger.warn(
            {
              module: MODULE_NAME,
              taskId,
              code,
              reason: reason.toString(),
            },
            "WebSocket closed unexpectedly",
          );
        }
      });
    });
  }

  /**
   * 生成任务 ID
   */
  private generateTaskId(): string {
    return `tts-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 处理 WebSocket 消息
   */
  private handleWSMessage(
    message: WSMessage,
    audioChunks: Buffer[],
    timeoutId: ReturnType<typeof setTimeout>,
    ws: WebSocket,
    options: Required<TTSOptions>,
    startTime: number,
    charCount: number,
    requestId: string,
    resolve: (result: TTSResult) => void,
    reject: (error: Error) => void,
  ): void {
    const event = message.header.event;
    const taskId = message.header.task_id;

    if (event === "task-started") {
      logger.debug({ module: MODULE_NAME, taskId }, "Task started");
    } else if (event === "result-generated") {
      // 可能包含 usage 信息
      if (message.payload?.usage?.characters) {
        // 注意：这里不能直接修改外部的 charCount，因为它是按值传递的
        // 但我们可以在 task-finished 时从最后一个 usage 获取
      }
    } else if (event === "task-finished") {
      clearTimeout(timeoutId);
      ws.close();

      // 合并音频数据
      const audioBuffer = Buffer.concat(audioChunks);
      const latencyMs = Date.now() - startTime;

      // 估算音频时长
      const estimatedDuration = this.estimateDuration(charCount, options.speed);

      logger.info(
        {
          module: MODULE_NAME,
          taskId,
          charCount,
          audioSize: audioBuffer.byteLength,
          estimatedDuration,
          latencyMs,
        },
        "TTS synthesis completed",
      );

      resolve({
        audio: audioBuffer.buffer.slice(
          audioBuffer.byteOffset,
          audioBuffer.byteOffset + audioBuffer.byteLength,
        ),
        format: options.format,
        durationSec: estimatedDuration,
        requestId,
        charCount,
      });
    } else if (event === "task-failed") {
      clearTimeout(timeoutId);
      ws.close();

      const errorCode = message.header.error_code || "UNKNOWN";
      const errorMessage = message.header.error_message || "语音合成失败";

      logger.error(
        {
          module: MODULE_NAME,
          taskId,
          errorCode,
          errorMessage,
        },
        "TTS task failed",
      );

      reject(
        new TTSError(
          TTS_ERROR_CODES.API_ERROR,
          `${errorCode}: ${errorMessage}`,
        ),
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
