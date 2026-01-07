/**
 * TTS 服务类型定义
 *
 * 定义语音合成服务的配置、输入输出类型
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

// ============================================
// 配置类型
// ============================================

/**
 * TTS 模型类型
 *
 * V4.2.28: 推荐使用 cosyvoice-v2（更好的音质和自然度）
 */
export type TTSModel = "cosyvoice-v1" | "cosyvoice-v2";

/**
 * 音频采样率
 */
export type TTSSampleRate = 16000 | 22050 | 24000 | 44100 | 48000;

/**
 * 音频格式
 */
export type TTSAudioFormat = "mp3" | "wav" | "pcm";

/**
 * 语音性别
 */
export type TTSVoiceGender = "male" | "female";

/**
 * TTS 合成选项
 */
export interface TTSOptions {
  /** 模型版本 */
  model?: TTSModel;
  /** 语音 ID（如 longxiaochun, longhua_v2） */
  voice?: string;
  /** 采样率 */
  sampleRate?: TTSSampleRate;
  /** 输出格式 */
  format?: TTSAudioFormat;
  /** 语速 (0.5-2.0)，1.0 为正常语速 */
  speed?: number;
  /** 音量 (0-100)，50 为正常音量 */
  volume?: number;
}

/**
 * 默认语音配置
 */
export interface TTSDefaultVoices {
  /** 女声默认语音 ID */
  female: string;
  /** 男声默认语音 ID */
  male: string;
}

// ============================================
// 输入输出类型
// ============================================

/**
 * TTS 合成结果
 */
export interface TTSResult {
  /** 音频数据 (ArrayBuffer) */
  audio: ArrayBuffer;
  /** 音频格式 */
  format: TTSAudioFormat;
  /** 音频时长（秒） */
  durationSec: number;
  /** 请求 ID（用于问题追踪） */
  requestId: string;
  /** 字符数 */
  charCount: number;
}

/**
 * TTS 请求参数
 */
export interface TTSSynthesizeRequest {
  /** 要合成的文本 */
  text: string;
  /** 合成选项 */
  options?: TTSOptions;
}

/**
 * TTS 服务状态
 */
export interface TTSServiceStatus {
  /** 服务是否可用 */
  available: boolean;
  /** 不可用原因 */
  reason?: string;
  /** API Key 是否配置 */
  apiKeyConfigured: boolean;
}

// ============================================
// 内容类型
// ============================================

/**
 * TTS 内容类型
 *
 * 定义可朗读的摘要内容类型
 */
export type TTSContentType =
  | "tldr" // 一句话总结
  | "summary" // 完整摘要
  | "keypoints" // 关键要点
  | "all"; // 全部（TLDR + 摘要 + 要点）

/**
 * TTS 内容类型配置
 */
export interface TTSContentTypeConfig {
  /** 类型 ID */
  type: TTSContentType;
  /** 显示名称 */
  label: string;
  /** 描述 */
  description: string;
  /** 图标名称 */
  icon: string;
}

/**
 * 内容类型配置列表
 */
export const TTS_CONTENT_TYPES: TTSContentTypeConfig[] = [
  {
    type: "tldr",
    label: "一句话总结",
    description: "朗读简短的 TLDR 摘要",
    icon: "Zap",
  },
  {
    type: "summary",
    label: "完整摘要",
    description: "朗读完整的 AI 摘要",
    icon: "FileText",
  },
  {
    type: "keypoints",
    label: "关键要点",
    description: "逐条朗读关键要点",
    icon: "List",
  },
  {
    type: "all",
    label: "全部内容",
    description: "朗读所有摘要内容",
    icon: "BookOpen",
  },
];

// ============================================
// API 响应类型
// ============================================

/**
 * TTS API 请求体
 */
export interface TTSAPIRequest {
  /** 书签 ID */
  bookmarkId: number;
  /** 内容类型 */
  contentType: TTSContentType;
  /** 语速 */
  speed?: number;
  /** 语音性别 */
  voiceGender?: TTSVoiceGender;
  /** 指定语音 ID（覆盖性别默认值） */
  voice?: string;
}

/**
 * TTS API 响应体
 */
export interface TTSAPIResponse {
  /** Base64 编码的音频数据 */
  audioBase64: string;
  /** 音频格式 */
  format: TTSAudioFormat;
  /** 音频时长（秒） */
  durationSec: number;
  /** 字符数 */
  charCount: number;
  /** 书签标题 */
  bookmarkTitle: string;
  /** 内容类型 */
  contentType: TTSContentType;
  /** 请求 ID */
  requestId: string;
}

/**
 * TTS API 错误响应
 */
export interface TTSAPIError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 详细信息 */
  details?: string;
}

// ============================================
// 常量配置
// ============================================

/**
 * TTS 服务默认配置
 *
 * V4.2.28: 更新为 CosyVoice v2 模型（WebSocket API）
 */
export const TTS_DEFAULT_CONFIG = {
  /** 默认模型 - CosyVoice v2 */
  model: "cosyvoice-v2" as TTSModel,
  /** 默认采样率 */
  sampleRate: 22050 as TTSSampleRate,
  /** 默认格式 */
  format: "mp3" as TTSAudioFormat,
  /** 默认语速 */
  speed: 1.0,
  /** 默认音量 */
  volume: 50,
  /** 默认语音 - v2 版本语音 */
  voices: {
    female: "longxiaochun_v2", // 龙小淳 v2 - 温柔女声
    male: "longhua_v2", // 龙华 v2 - 标准男声
  } as TTSDefaultVoices,
  /** 最大文本长度（字符） */
  maxTextLength: 5000,
  /** API 超时时间（毫秒）- 增加到 60 秒以应对网络波动 */
  timeoutMs: 60000,
} as const;

/**
 * TTS 错误代码
 */
export const TTS_ERROR_CODES = {
  /** API Key 未配置 */
  API_KEY_MISSING: "TTS_API_KEY_MISSING",
  /** 文本为空 */
  TEXT_EMPTY: "TTS_TEXT_EMPTY",
  /** 文本过长 */
  TEXT_TOO_LONG: "TTS_TEXT_TOO_LONG",
  /** 书签不存在 */
  BOOKMARK_NOT_FOUND: "TTS_BOOKMARK_NOT_FOUND",
  /** 无摘要内容 */
  NO_SUMMARY: "TTS_NO_SUMMARY",
  /** API 调用失败 */
  API_ERROR: "TTS_API_ERROR",
  /** 网络错误 */
  NETWORK_ERROR: "TTS_NETWORK_ERROR",
  /** 未授权 */
  UNAUTHORIZED: "TTS_UNAUTHORIZED",
} as const;
