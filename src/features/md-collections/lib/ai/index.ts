/**
 * MD 收藏 AI 处理模块
 *
 * 为 Markdown 文档设计的专用 AI 处理系统
 *
 * 核心组件：
 * - MdAIProcessor: AI 处理编排器
 * - MdSummaryService: MD 专用摘要服务
 * - MdContentChunker: 长文档分块器
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

// ============================================================================
// 类型导出
// ============================================================================

export type {
  // 错误类型
  MdAIErrorCode,
  // 摘要类型
  MdSummaryInput,
  MdSummaryResult,
  MdEntity,
  // 分块类型
  ContentChunk,
  ChunkOptions,
  ChunkResult,
  ChunkSummary,
  // 处理器类型
  MdAIProcessOptions,
  MdAIProcessResult,
  StatusUpdateData,
  AtomicStatusUpdateRequest,
  AtomicStatusUpdateResponse,
  // 事件类型
  MdProcessingEventBase,
  MdProcessingStartedEvent,
  MdProcessingCompletedEvent,
  MdProcessingFailedEvent,
  MdTagsGeneratedEvent,
  MdProcessingEvent,
  // 取消类型
  CancellationToken,
  CancellableContext,
} from "./types";

// ============================================================================
// 常量导出
// ============================================================================

export {
  MdAIError,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_CHUNK_MAX_CHARS,
  DEFAULT_CHUNK_MIN_CHARS,
  DEFAULT_CHUNK_OVERLAP_CHARS,
  MIN_CONTENT_LENGTH,
  RETRY_DELAY_BASE_MS,
  EMBEDDING_DIMENSION,
} from "./types";

// ============================================================================
// 处理器导出
// ============================================================================

export {
  MdAIProcessor,
  createCancellationToken,
  processMdCollectionAI,
  processMdCollectionsBatchAI,
  triggerMdAIProcessing,
} from "./md-ai-processor";

// ============================================================================
// 摘要服务导出
// ============================================================================

export { MdSummaryService } from "./md-summary.service";
export type { MdSummaryServiceConfig } from "./md-summary.service";

// ============================================================================
// 分块器导出
// ============================================================================

export {
  MdContentChunker,
  needsChunking,
  chunkContent,
  mergeSummaries,
} from "./md-content-chunker";

// ============================================================================
// Prompt 导出
// ============================================================================

export {
  MD_SUMMARY_SYSTEM_PROMPT,
  MD_SUMMARY_SYSTEM_PROMPT_LITE,
  buildMdSummaryUserPrompt,
  buildChunkSummaryUserPrompt,
  buildMergeSummaryPrompt,
  getMdPromptConfig,
  MD_CONTENT_TYPE_KEYWORDS,
  preDetectMdContentType,
} from "./prompts";
export type { MdPromptConfig } from "./prompts";
