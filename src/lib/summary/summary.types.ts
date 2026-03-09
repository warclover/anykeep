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
  EnhancedSummary as _EnhancedSummary,
  Entity as _Entity,
  KeyDataItem as _KeyDataItem,
  EntityType as _EntityType,
  DifficultyLevel as _DifficultyLevel,
  SummaryMode as _SummaryMode,
} from "@/lib/summary/types/ai-summary";

import type {
  ContentType as _ContentType,
  ContentTypeResult as _ContentTypeResult,
  DetectionInput as _DetectionInput,
} from "@/lib/summary/content-type-detector";

// Re-export types
export type Sentiment = _Sentiment;
export type StructuredSummary = _StructuredSummary;
export type AISummaryData = _AISummaryData;
export type ContentType = _ContentType;
export type ContentTypeResult = _ContentTypeResult;
export type DetectionInput = _DetectionInput;

// v3.0 增强类型
export type EnhancedSummary = _EnhancedSummary;
export type Entity = _Entity;
export type KeyDataItem = _KeyDataItem;
export type EntityType = _EntityType;
export type DifficultyLevel = _DifficultyLevel;
export type SummaryMode = _SummaryMode;

// Re-export functions
export {
  isStructuredSummary,
  parseStructuredSummary,
  getDisplaySummary,
  structuredToText,
  safeParseJson,
  tryFixJson,
} from "@/lib/summary/types/ai-summary";

export {
  detectContentType,
  CONTENT_TYPE_LABELS,
} from "@/lib/summary/content-type-detector";

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Provider 名称
 * V4.2.7: 添加 "local" 本地降级 Provider
 */
export type ProviderName = "deepseek" | "aliyun-bailian" | "ollama" | "local";

/**
 * 摘要版本
 * - 1: 纯文本输出
 * - 2: JSON 结构化输出
 * - 3: 增强版输出（含实体、关键数据、难度等）
 */
export type SummaryVersion = 1 | 2 | 3;

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
  /** V4.2.5: 健康检查超时时间 (ms)，默认为 timeoutMs 的 1/6 */
  healthCheckTimeoutMs?: number;
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
  /** 摘要文本（V1: 纯文本 / V2-V3: JSON 字符串） */
  summary: string;
  /** 生成的标签 */
  tags: string[];
  /** 摘要版本 */
  version: SummaryVersion;
  /** 结构化摘要（V2-V3） */
  structured?: StructuredSummary;
  /** 增强摘要（仅 V3，包含实体、关键数据等） */
  enhanced?: EnhancedSummary;
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
  /** 摘要模式（v3.0: standard/enhanced） */
  summaryMode?: SummaryMode;
  /** 是否保存实体（仅 enhanced 模式） */
  saveEntities?: boolean;
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
// MapReduce Types (v4.0 长文分段摘要)
// ============================================================================

/**
 * 长文处理策略
 * - truncate: 截断模式（现有默认）
 * - map_reduce: 分段摘要再聚合
 */
export type LongContentStrategy = "truncate" | "map_reduce";

/**
 * MapReduce 中间结果 - 单段摘要
 */
export interface ChunkSummary {
  /** 段落索引 */
  chunkIndex: number;
  /** 段落摘要 */
  summary: string;
  /** 段落关键要点 */
  keyPoints: string[];
  /** 段落 Token 数 */
  tokenCount: number;
}

/**
 * MapReduce 配置
 */
export interface MapReduceConfig {
  /** 触发 MapReduce 的内容长度阈值（字符数） */
  contentLengthThreshold: number;
  /** Map 阶段最大并发数 */
  mapConcurrency: number;
  /** Map 阶段每个 chunk 的最大 Token 数 */
  chunkMaxTokens: number;
  /** Reduce 阶段聚合输入的最大 Token 数 */
  reduceMaxInputTokens: number;
  /** Map 阶段单段超时（ms） */
  mapTimeoutMs: number;
  /** MapReduce 总超时（ms） */
  totalTimeoutMs: number;
}

/**
 * MapReduce 默认配置
 */
export const DEFAULT_MAP_REDUCE_CONFIG: MapReduceConfig = {
  contentLengthThreshold: 6000,
  mapConcurrency: 3,
  chunkMaxTokens: 1024,
  reduceMaxInputTokens: 4000,
  mapTimeoutMs: 20000,
  totalTimeoutMs: 60000,
};

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
