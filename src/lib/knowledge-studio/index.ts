/**
 * Knowledge Studio - 知识工坊
 * @module knowledge-studio
 * @description 写作蓝图合成系统，支持 5 种写作模式和聊天式编辑
 *
 * ## 核心模块
 *
 * - **Blueprint Engine**: 5 种写作蓝图生成引擎
 * - **Chat-to-Edit**: 段落级聊天编辑，滑动窗口上下文
 * - **Quota Manager**: 乐观计费 + 补偿机制
 * - **Material Scorer**: 素材健康度评分
 * - **Streaming**: SSE 流式输出，5 阶段进度
 *
 * ## 使用示例
 *
 * ```typescript
 * import {
 *   blueprintEngine,
 *   chatEditEngine,
 *   quotaManager,
 *   materialScorer,
 * } from '@/lib/knowledge-studio';
 *
 * // 生成蓝图
 * const result = await quotaManager.executeWithQuota(
 *   userId,
 *   'blueprint_generation',
 *   () => blueprintEngine.generate({
 *     requestId: crypto.randomUUID(),
 *     userId,
 *     config: { type: 'debater' },
 *     materials: [...],
 *   }),
 * );
 * ```
 */

// ============================================================================
// Core Types
// ============================================================================

export * from "./types";

// ============================================================================
// Blueprint Engine
// ============================================================================

export {
  BlueprintEngine,
  blueprintEngine,
  buildPromptForBlueprint,
  getBlueprintOutputFormat,
  getAllBlueprintTypes,
  BLUEPRINT_DISPLAY_CONFIG,
} from "./blueprint";

export type {
  GenerationContext,
  MaterialInput,
  BlueprintEngineConfig,
  ProgressCallback,
  GenerationResult,
  BlueprintPromptTemplate,
  StageProgress,
} from "./blueprint";

// ============================================================================
// Chat-to-Edit
// ============================================================================

export {
  ChatEditEngine,
  chatEditEngine,
  buildEditPrompt,
  buildSuggestionPrompt,
  DEFAULT_SLIDING_WINDOW_CONFIG,
  EDIT_MODE_CONFIG,
} from "./chat-edit";

export type {
  EditMode,
  EditIntent,
  ParagraphInfo,
  ChatEditContext,
  ChatTurn,
  ChatEditRequest,
  EditDiff,
  DiffChange,
  ChatEditResponse,
  EditHistory,
  SlidingWindowConfig,
} from "./chat-edit";

// ============================================================================
// Quota Manager
// ============================================================================

export {
  QuotaManager,
  quotaManager,
  DEFAULT_QUOTA_MANAGER_CONFIG,
  DEFAULT_OPERATION_COSTS,
  MEMBERSHIP_QUOTA_LIMITS,
} from "./quota";

export type {
  QuotaManagerConfig,
  DeductQuotaRequest,
  DeductQuotaResult,
  ConfirmQuotaRequest,
  RefundQuotaRequest,
  OperationCostConfig,
  UserQuotaInfo,
  QuotaCheckResult,
} from "./quota";

// ============================================================================
// Material Scorer
// ============================================================================

export {
  MaterialScorer,
  materialScorer,
  QUALITY_THRESHOLDS,
  DIMENSION_WEIGHTS,
  QUALITY_DISPLAY,
  getQualityLevel,
} from "./material";

export type {
  ScoreDimensions,
  MaterialScoreResult,
  MaterialAnalysisRequest,
  MaterialAnalysisResponse,
  MaterialQuality,
} from "./material";

// ============================================================================
// Streaming (SSE)
// ============================================================================

export { StreamEmitter, createSSEResponse, parseSSEEvent } from "./streaming";

export type { StreamEmitterConfig } from "./streaming";
