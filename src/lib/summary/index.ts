/**
 * AI Summary Module
 *
 * 摘要服务模块统一入口
 *
 * 架构设计：
 * - 四层架构：API → 服务 → Provider → 仓库
 * - 多 Provider 支持：DeepSeek（主力）、阿里百炼云（备选）、Ollama（本地）
 * - 事件驱动：通过 EventBus 与分类系统解耦
 * - 质量追踪：记录每次生成的质量指标
 *
 * @version 2.0.0
 * @since 2025-12-12
 *
 * @example
 * ```typescript
 * import { SummaryService, type SummaryInput } from '@/lib/summary';
 *
 * const service = new SummaryService();
 * const result = await service.generate({
 *   bookmarkId: 123,
 *   userId: 'user-uuid',
 *   title: '文章标题',
 *   content: '文章内容...',
 * });
 *
 * console.log(result.summary, result.tags);
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Provider Types
  ProviderName,
  ProviderConfig,
  ProviderHealth,
  TokenUsage,

  // Summary Types
  SummaryVersion,
  SummaryInput,
  SummaryResult,
  GenerateOptions,

  // Service Types
  SummaryServiceConfig,
  SummaryServiceStats,

  // Quality Types
  QualityLogEntry,
  QualityStats,
  UserFeedback,

  // Re-exported Types
  Sentiment,
  StructuredSummary,
  AISummaryData,
  ContentType,
  ContentTypeResult,
  DetectionInput,
} from "./summary.types";

export {
  // Error Types
  SummaryErrorCode,
  SummaryError,

  // Re-exported Functions
  isStructuredSummary,
  parseStructuredSummary,
  getDisplaySummary,
  structuredToText,
  safeParseJson,
  tryFixJson,
  detectContentType,
  CONTENT_TYPE_LABELS,
} from "./summary.types";

// ============================================================================
// Providers
// ============================================================================

export type {
  ISummaryProvider,
  IProviderFactory,
  ProviderFactoryConfig,
  PromptBuildResult,
  ParsedResponse,
} from "./providers";

// Concrete Provider Implementations
export { DeepSeekProvider } from "./providers";
export { AliyunBailianProvider } from "./providers";
export {
  ProviderFactory,
  getProviderFactory,
  resetProviderFactory,
} from "./providers";

// ============================================================================
// Services
// ============================================================================

export type {
  ISummaryService,
  IContentFetcherService,
  IQualityTrackerService,
  FetchedContent,
  ContentTypeInput,
  ContentTypeOutput,
  QualityLogInput,
  QualityStatsOutput,
} from "./services";

// Concrete Service Implementations
export {
  SummaryService,
  getSummaryService,
  resetSummaryService,
} from "./services";

// P5: Quality Tracker Service
export {
  QualityTrackerService,
  getQualityTrackerService,
  resetQualityTrackerService,
} from "./services";

// Content Fetcher Service
export {
  ContentFetcherService,
  getContentFetcherService,
  resetContentFetcherService,
} from "./services";

export type { FetchOptions } from "./services";

// ============================================================================
// Repositories
// ============================================================================

export type {
  ISummaryRepository,
  IQualityLogRepository,
  BookmarkSummaryData,
  BatchSummaryUpdate,
  BookmarkForSummary,
  TimeRange,
  ProviderUsageStats,
  ProviderCallStats,
  DailyUsage,
} from "./repositories";

// P5: Quality Log Repository
export {
  QualityLogRepository,
  getQualityLogRepository,
  resetQualityLogRepository,
} from "./repositories";

// Summary Repository
export {
  SummaryRepository,
  getSummaryRepository,
  resetSummaryRepository,
} from "./repositories";

// ============================================================================
// Prompts
// ============================================================================

export {
  getPromptConfig,
  buildTypeSpecificPrompt,
  getPromptConfigV2,
  buildTypeSpecificPromptV2,
  PROMPT_VERSIONS,
  DEFAULT_PROMPT_VERSION,
  CONTENT_TYPE_TEMPERATURE,
  CONTENT_TYPE_MAX_TOKENS,
} from "./prompts";

export type {
  PromptConfig,
  PromptVersion,
  TypePromptConfigV2,
  SummaryLengthConfig,
} from "./prompts";

// ============================================================================
// Configuration
// ============================================================================

export {
  // Environment Variables
  ENV_VARS,

  // Default Configurations
  DEEPSEEK_DEFAULT_CONFIG,
  ALIYUN_BAILIAN_DEFAULT_CONFIG,
  ALIYUN_MODELS,
  MODEL_PRICING,
  DEFAULT_SERVICE_CONFIG,

  // Configuration Functions
  isNewSummaryServiceEnabled,
  isJsonOutputEnabled,
  isFallbackEnabled,
  isQualityTrackingEnabled,
  getDefaultProvider,
  getFallbackProvider,
  getSummaryServiceConfig,
  getProviderConfig,
  isProviderConfigured,
  getConfiguredProviders,
  estimateCost,

  // Configuration Service (P4)
  SummaryConfigService,
  getSummaryConfigService,
  resetSummaryConfigService,
} from "./summary.config";

export type {
  ConfigChangeLogEntry,
  SummaryConfigStats,
} from "./summary.config";
