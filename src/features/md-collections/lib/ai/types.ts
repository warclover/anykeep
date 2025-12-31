/**
 * MD 收藏 AI 处理 - 类型定义
 *
 * 为 MD 文档专门设计的 AI 处理类型系统
 * 包含摘要、分块、处理器相关类型定义
 */

import type { MdProcessingStatus, MdContentType } from "../../types";

// ============================================================================
// 错误代码枚举
// ============================================================================

/**
 * MD AI 处理错误代码
 */
export enum MdAIErrorCode {
  // 超时错误
  TIMEOUT = "MD_AI_TIMEOUT",
  // Provider 错误
  PROVIDER_ERROR = "MD_AI_PROVIDER_ERROR",
  PROVIDER_UNAVAILABLE = "MD_AI_PROVIDER_UNAVAILABLE",
  // 内容错误
  CONTENT_TOO_SHORT = "MD_AI_CONTENT_TOO_SHORT",
  CONTENT_INVALID = "MD_AI_CONTENT_INVALID",
  // 处理错误
  CHUNK_ERROR = "MD_AI_CHUNK_ERROR",
  PARSE_ERROR = "MD_AI_PARSE_ERROR",
  EMBEDDING_ERROR = "MD_AI_EMBEDDING_ERROR",
  // 状态错误
  STATUS_CONFLICT = "MD_AI_STATUS_CONFLICT",
  ALREADY_PROCESSING = "MD_AI_ALREADY_PROCESSING",
  // 取消
  CANCELLED = "MD_AI_CANCELLED",
  // 通用错误
  UNKNOWN = "MD_AI_UNKNOWN_ERROR",
}

/**
 * MD AI 处理错误
 */
export class MdAIError extends Error {
  constructor(
    public readonly code: MdAIErrorCode,
    message: string,
    public readonly cause?: unknown,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "MdAIError";
  }
}

// ============================================================================
// 摘要相关类型
// ============================================================================

/**
 * MD 摘要输入
 */
export interface MdSummaryInput {
  /** MD 收藏 ID */
  collectionId: number;
  /** 用户 ID */
  userId: string;
  /** 文档标题 */
  title: string;
  /** 处理后的文本内容（已预处理） */
  content: string;
  /** 原始 Markdown 内容 */
  rawContent?: string;
  /** 内容元数据 */
  metadata?: {
    wordCount?: number;
    codeBlockCount?: number;
    readingTimeMinutes?: number;
  };
}

/**
 * MD 摘要结果 - 结构化输出
 */
export interface MdSummaryResult {
  /** AI 建议的标题（15字以内） */
  suggestedTitle?: string;
  /** 一句话总结（50字以内） */
  tldr: string;
  /** 核心要点（3-5个） */
  keyPoints: string[];
  /** 代码亮点（MD 文档特有） */
  codeHighlights?: string[];
  /** 文档结构简述（MD 文档特有） */
  structureOverview?: string;
  /** 关键词 */
  keywords: string[];
  /** 内容类型 */
  contentType: MdContentType;
  /** 内容类型置信度 */
  contentTypeConfidence: number;
  /** 命名实体 */
  entities?: MdEntity[];
  /** 难度等级 */
  difficulty?: "easy" | "medium" | "hard";
  /** 合并的简化摘要（用于存储） */
  summary: string;
  /** AI 生成的标签 */
  tags: string[];
}

/**
 * 命名实体
 */
export interface MdEntity {
  name: string;
  type: "tech" | "person" | "organization" | "concept" | "product";
  confidence: number;
}

// ============================================================================
// 分块相关类型
// ============================================================================

/**
 * 内容分块
 */
export interface ContentChunk {
  /** 分块索引 */
  index: number;
  /** 分块内容 */
  content: string;
  /** 分块类型 */
  type: "heading" | "paragraph" | "code" | "mixed";
  /** 字符数 */
  charCount: number;
  /** 分块元数据 */
  metadata?: {
    headingLevel?: number;
    headingText?: string;
    codeLanguage?: string;
  };
}

/**
 * 分块选项
 */
export interface ChunkOptions {
  /** 最大字符数（默认 5000） */
  maxChars?: number;
  /** 最小字符数（默认 500） */
  minChars?: number;
  /** 是否保持代码块完整 */
  preserveCodeBlocks?: boolean;
  /** 是否按标题分割 */
  splitByHeading?: boolean;
  /** 重叠字符数（用于上下文连续性） */
  overlapChars?: number;
}

/**
 * 分块结果
 */
export interface ChunkResult {
  /** 分块列表 */
  chunks: ContentChunk[];
  /** 总字符数 */
  totalChars: number;
  /** 是否进行了分块 */
  wasChunked: boolean;
  /** 分块策略 */
  strategy: "none" | "heading" | "length" | "mixed";
}

/**
 * 分块摘要（用于合并）
 */
export interface ChunkSummary {
  chunkIndex: number;
  summary: string;
  keyPoints: string[];
  keywords: string[];
}

// ============================================================================
// 处理器相关类型
// ============================================================================

/**
 * MD AI 处理选项
 */
export interface MdAIProcessOptions {
  /** 是否生成摘要 */
  generateSummary?: boolean;
  /** 是否生成标签 */
  generateTags?: boolean;
  /** 是否生成向量嵌入 */
  generateEmbedding?: boolean;
  /** 超时时间（毫秒，默认 30000） */
  timeoutMs?: number;
  /** 最大重试次数（默认 3） */
  maxRetries?: number;
  /** 强制指定 Provider */
  forceProvider?: string;
  /** 是否强制重新处理（忽略当前状态） */
  forceReprocess?: boolean;
}

/**
 * MD AI 处理结果
 */
export interface MdAIProcessResult {
  /** 是否成功 */
  success: boolean;
  /** 收藏 ID */
  collectionId: number;
  /** AI 生成的标题 */
  aiTitle?: string;
  /** 摘要 */
  summary?: string;
  /** AI 生成的标签 */
  aiTags?: string[];
  /** 内容类型 */
  contentType?: MdContentType;
  /** 内容类型置信度 */
  contentTypeConfidence?: number;
  /** 向量嵌入 */
  embedding?: number[];
  /** 向量版本 */
  embeddingVersion?: string;
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  errorCode?: MdAIErrorCode;
  /** 处理耗时（毫秒） */
  durationMs?: number;
  /** 重试次数 */
  retryCount?: number;
  /** 使用的 Provider */
  provider?: string;
  /** 是否被取消 */
  cancelled?: boolean;
}

/**
 * 状态更新数据
 */
export interface StatusUpdateData {
  status: MdProcessingStatus;
  /** AI 生成的标题（用于更新 title 字段） */
  aiTitle?: string;
  aiSummary?: string;
  aiTags?: string[];
  contentType?: MdContentType;
  contentTypeConfidence?: number;
  embedding?: number[];
  embeddingVersion?: string;
  processingError?: string;
  processedAt?: string;
}

/**
 * 原子状态更新请求
 */
export interface AtomicStatusUpdateRequest {
  collectionId: number;
  newStatus: MdProcessingStatus;
  expectedStatus?: MdProcessingStatus;
  updateData?: Partial<StatusUpdateData>;
}

/**
 * 原子状态更新响应
 */
export interface AtomicStatusUpdateResponse {
  success: boolean;
  updatedAt?: string;
  conflict?: boolean;
  currentStatus?: MdProcessingStatus;
}

// ============================================================================
// 事件相关类型
// ============================================================================

/**
 * MD 处理事件基础类型
 */
export interface MdProcessingEventBase {
  collectionId: number;
  userId: string;
  timestamp: string;
}

/**
 * 处理开始事件
 */
export interface MdProcessingStartedEvent extends MdProcessingEventBase {
  type: "md_processing_started";
  options: MdAIProcessOptions;
}

/**
 * 处理完成事件
 */
export interface MdProcessingCompletedEvent extends MdProcessingEventBase {
  type: "md_processing_completed";
  result: MdAIProcessResult;
}

/**
 * 处理失败事件
 */
export interface MdProcessingFailedEvent extends MdProcessingEventBase {
  type: "md_processing_failed";
  error: string;
  errorCode: MdAIErrorCode;
  retryable: boolean;
}

/**
 * 标签生成事件
 */
export interface MdTagsGeneratedEvent extends MdProcessingEventBase {
  type: "md_tags_generated";
  tags: string[];
}

/**
 * MD 处理事件联合类型
 */
export type MdProcessingEvent =
  | MdProcessingStartedEvent
  | MdProcessingCompletedEvent
  | MdProcessingFailedEvent
  | MdTagsGeneratedEvent;

// ============================================================================
// 取消令牌相关类型
// ============================================================================

/**
 * 取消令牌接口
 */
export interface CancellationToken {
  /** 是否已取消 */
  isCancelled: boolean;
  /** 取消原因 */
  reason?: string;
  /** 注册取消回调 */
  onCancel(callback: (reason?: string) => void): void;
  /** 抛出取消错误（如果已取消） */
  throwIfCancelled(): void;
}

/**
 * 可取消的操作上下文
 */
export interface CancellableContext {
  /** 取消令牌 */
  cancellationToken?: CancellationToken;
  /** AbortSignal（用于 fetch 等原生 API） */
  abortSignal?: AbortSignal;
}

// ============================================================================
// 常量定义
// ============================================================================

/** 默认超时时间（毫秒） */
export const DEFAULT_TIMEOUT_MS = 30000;

/** 默认最大重试次数 */
export const DEFAULT_MAX_RETRIES = 3;

/** 默认分块最大字符数 */
export const DEFAULT_CHUNK_MAX_CHARS = 5000;

/** 默认分块最小字符数 */
export const DEFAULT_CHUNK_MIN_CHARS = 500;

/** 默认分块重叠字符数 */
export const DEFAULT_CHUNK_OVERLAP_CHARS = 200;

/** 最小内容长度（字符） */
export const MIN_CONTENT_LENGTH = 50;

/** 重试延迟（毫秒）- 指数退避基数 */
export const RETRY_DELAY_BASE_MS = 1000;

/** 向量维度 */
export const EMBEDDING_DIMENSION = 1024;
