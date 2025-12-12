/**
 * AI Summary Module - Type Definitions
 *
 * 摘要服务核心类型定义
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

// Re-export existing types for compatibility
import type {
  Sentiment as _Sentiment,
  StructuredSummary as _StructuredSummary,
  AISummaryData as _AISummaryData,
} from "@/lib/classification/types/ai-summary";

import type {
  ContentType as _ContentType,
  ContentTypeResult as _ContentTypeResult,
  DetectionInput as _DetectionInput,
} from "@/lib/classification/content-type-detector";

// Re-export types
export type Sentiment = _Sentiment;
export type StructuredSummary = _StructuredSummary;
export type AISummaryData = _AISummaryData;
export type ContentType = _ContentType;
export type ContentTypeResult = _ContentTypeResult;
export type DetectionInput = _DetectionInput;

// Re-export functions
export {
  isStructuredSummary,
  parseStructuredSummary,
  getDisplaySummary,
  structuredToText,
  safeParseJson,
  tryFixJson,
} from "@/lib/classification/types/ai-summary";

export {
  detectContentType,
  CONTENT_TYPE_LABELS,
} from "@/lib/classification/content-type-detector";

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Provider 名称
 */
export type ProviderName = "deepseek" | "aliyun-bailian" | "ollama";

/**
 * 摘要版本
 */
export type SummaryVersion = 1 | 2;

/**
 * Token 使用统计
 */
export interface TokenUsage {
  /** 输入 Token 数 */
  inputTokens: number;
  /** 输出 Token 数 */
  outputTokens: number;
  /** 总 Token 数 */
  totalTokens?: number;
}

/**
 * Provider 配置
 */
export interface ProviderConfig {
  /** API 密钥 */
  apiKey: string;
  /** API 基础 URL */
  baseUrl: string;
  /** 模型名称 */
  model: string;
  /** 超时时间 (ms) */
  timeoutMs: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 温度参数 */
  temperature: number;
  /** 最大输出 token */
  maxTokens: number;
}

/**
 * Provider 健康状态
 */
export interface ProviderHealth {
  /** 是否可用 */
  available: boolean;
  /** 延迟 (ms) */
  latencyMs?: number;
  /** 错误信息 */
  error?: string;
  /** 检查时间 */
  checkedAt: string;
}

// ============================================================================
// Summary Input/Output Types
// ============================================================================

/**
 * 摘要生成输入
 */
export interface SummaryInput {
  /** 书签 ID */
  bookmarkId: number;
  /** 用户 ID */
  userId: string;
  /** 标题 */
  title: string;
  /** URL */
  url?: string;
  /** 描述 */
  description?: string;
  /** 正文内容 */
  content?: string;
  /** 内容类型（如已检测） */
  contentType?: ContentType;
  /** 内容类型置信度 */
  contentTypeConfidence?: number;
  /** 现有文件夹名称（用于标签参考） */
  existingFolderNames?: string[];
}

/**
 * 摘要生成结果
 */
export interface SummaryResult {
  /** 摘要文本（V1: 纯文本 / V2: JSON 字符串） */
  summary: string;
  /** 生成的标签 */
  tags: string[];
  /** 摘要版本 */
  version: SummaryVersion;
  /** 结构化摘要（仅 V2） */
  structured?: StructuredSummary;
  /** Token 使用量 */
  usage: TokenUsage;
  /** 处理耗时 (ms) */
  latencyMs: number;
  /** 使用的 Provider 名称 */
  providerUsed?: ProviderName;
  /** 使用的模型名称 */
  modelUsed?: string;
  /** 检测到的内容类型 */
  contentType?: ContentType;
  /** 内容类型置信度 */
  contentTypeConfidence?: number;
}

/**
 * 摘要生成选项
 */
export interface GenerateOptions {
  /** 强制使用指定 Provider */
  forceProvider?: ProviderName;
  /** 是否需要分类 */
  needsClassification?: boolean;
  /** 跳过质量追踪 */
  skipQualityTracking?: boolean;
  /** 输出版本 */
  outputVersion?: SummaryVersion;
  /** 强制重新生成（忽略缓存） */
  forceRegenerate?: boolean;
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * 摘要服务配置
 */
export interface SummaryServiceConfig {
  /** 是否启用回退 */
  enableFallback: boolean;
  /** 最大重试次数 */
  maxRetries: number;
  /** 是否发布事件 */
  emitEvents: boolean;
  /** 是否追踪质量 */
  trackQuality: boolean;
  /** 默认输出版本 */
  outputVersion: SummaryVersion;
  /** 默认 Provider */
  defaultProvider: ProviderName;
  /** Fallback Provider */
  fallbackProvider: ProviderName;
}

/**
 * 服务统计
 */
export interface SummaryServiceStats {
  /** 总生成数 */
  totalGenerated: number;
  /** 成功率 */
  successRate: number;
  /** 平均延迟 (ms) */
  averageLatencyMs: number;
  /** Provider 使用统计 */
  providerUsage: Record<ProviderName, number>;
  /** Fallback 触发率 */
  fallbackRate: number;
  /** 按内容类型统计 */
  byContentType: Record<ContentType, number>;
}

// ============================================================================
// Quality Tracking Types
// ============================================================================

/**
 * 质量日志条目
 */
export interface QualityLogEntry {
  /** 书签 ID */
  bookmarkId: number;
  /** 用户 ID */
  userId: string;
  /** 内容长度 */
  contentLength: number;
  /** 内容类型 */
  contentType: string;
  /** 使用的 Provider */
  providerUsed: ProviderName;
  /** 使用的模型 */
  modelUsed: string;
  /** Prompt 版本 */
  promptVersion: string;
  /** 摘要长度 */
  summaryLength: number;
  /** 标签数量 */
  tagsCount: number;
  /** 延迟 (ms) */
  latencyMs: number;
  /** 输入 Token 数 */
  tokensInput: number;
  /** 输出 Token 数 */
  tokensOutput: number;
  /** 自动质量评分 */
  autoQualityScore?: number;
  /** 错误码 */
  errorCode?: string;
  /** 错误信息 */
  errorMessage?: string;
  /** 是否使用了 Fallback */
  fallbackUsed: boolean;
  /** 估算成本（美分） */
  estimatedCost?: number;
}

/**
 * 质量统计
 */
export interface QualityStats {
  /** 总记录数 */
  totalCount: number;
  /** 成功数 */
  successCount: number;
  /** 失败数 */
  failedCount: number;
  /** 平均质量分 */
  averageQualityScore: number;
  /** 平均延迟 */
  averageLatencyMs: number;
  /** 平均用户评分 */
  averageUserRating?: number;
  /** Provider 分布 */
  providerDistribution: Record<ProviderName, number>;
  /** Fallback 率 */
  fallbackRate: number;
}

/**
 * 用户反馈
 */
export interface UserFeedback {
  /** 书签 ID */
  bookmarkId: number;
  /** 评分 (1-5) */
  rating: number;
  /** 文字反馈 */
  feedback?: string;
  /** 反馈时间 */
  createdAt: string;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * 摘要服务错误码
 */
export enum SummaryErrorCode {
  /** Provider 不可用 */
  PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE",
  /** API 调用失败 */
  API_CALL_FAILED = "API_CALL_FAILED",
  /** 响应解析失败 */
  PARSE_FAILED = "PARSE_FAILED",
  /** 超时 */
  TIMEOUT = "TIMEOUT",
  /** 配额超限 */
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  /** 内容过长 */
  CONTENT_TOO_LONG = "CONTENT_TOO_LONG",
  /** 无效输入 */
  INVALID_INPUT = "INVALID_INPUT",
  /** 未知错误 */
  UNKNOWN = "UNKNOWN",
}

/**
 * 摘要服务错误
 */
export class SummaryError extends Error {
  constructor(
    public code: SummaryErrorCode,
    message: string,
    public provider?: ProviderName,
    public cause?: Error,
  ) {
    super(message);
    this.name = "SummaryError";
  }
}
