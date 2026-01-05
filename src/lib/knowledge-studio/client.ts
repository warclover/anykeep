/**
 * Knowledge Studio - 客户端安全导出
 * @module knowledge-studio/client
 * @client-safe
 * @description 仅导出可在客户端组件中使用的类型和常量
 *
 * 注意：此文件不包含任何服务端代码（如 Supabase server client）
 * 客户端组件应从此文件导入，而非主 index.ts
 *
 * @example
 * ```typescript
 * // 在客户端组件中
 * import type { BlueprintType, GenerationStage } from "@/lib/knowledge-studio/client";
 * import { BLUEPRINT_DISPLAY_CONFIG } from "@/lib/knowledge-studio/client";
 * ```
 */

// ============================================================================
// 客户端安全验证
// ============================================================================

/**
 * 运行时环境检查
 *
 * 在服务端环境中导入此模块会发出警告
 * 如果需要服务端功能，请从 @/lib/knowledge-studio 导入
 */
if (
  typeof window === "undefined" &&
  process.env.NODE_ENV === "development" &&
  !process.env.NEXT_PHASE // 排除构建阶段
) {
  // 使用 console.info (ESLint 允许) 而非 console.warn
  console.info(
    "[knowledge-studio/client] 在服务端环境中导入客户端模块。" +
      "如需服务端功能，请从 @/lib/knowledge-studio 导入。",
  );
}

// ============================================================================
// Core Types (from types.ts)
// ============================================================================

export type {
  BlueprintType,
  GenerationStage,
  GenerationProgress,
  GenerationCompleteEvent,
  SynthesisReport,
  ReportSection,
  Citation,
} from "./types";

// ============================================================================
// Blueprint Types & Constants
// ============================================================================

export { BLUEPRINT_DISPLAY_CONFIG } from "./blueprint/types";

export type {
  GenerationContext,
  MaterialInput,
  BlueprintEngineConfig,
  ProgressCallback,
  GenerationResult,
  StageProgress,
} from "./blueprint";

// ============================================================================
// Chat-to-Edit Types & Constants
// ============================================================================

export { EDIT_MODE_CONFIG, DEFAULT_SLIDING_WINDOW_CONFIG } from "./chat-edit";

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
// Material Types & Constants
// ============================================================================

export {
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
// Quota Types & Constants (read-only)
// ============================================================================

export {
  DEFAULT_QUOTA_MANAGER_CONFIG,
  DEFAULT_OPERATION_COSTS,
  MEMBERSHIP_QUOTA_LIMITS,
} from "./quota";

export type {
  QuotaManagerConfig,
  OperationCostConfig,
  UserQuotaInfo,
  QuotaCheckResult,
} from "./quota";

// ============================================================================
// Analytics Types (read-only)
// ============================================================================

export type {
  KSUsageStats,
  KSAnalyticsConfig,
  OperationStat,
  BlueprintTypeStat,
  DailyUsageTrend,
  TrialStatus,
  UserTrialInfo,
  ConversionFunnel,
} from "./analytics";

// ============================================================================
// Streaming Types (client-safe parsing only)
// ============================================================================

export { parseSSEEvent } from "./streaming";

export type { StreamEmitterConfig } from "./streaming";
