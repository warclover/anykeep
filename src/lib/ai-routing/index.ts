/**
 * AI Routing 统一路由层
 *
 * Layer 4 - 统一入口层
 *
 * 职责：
 * - 意图分析：识别用户输入的意图类型
 * - 模式选择：决定使用 atomic / orchestration / workflow 模式
 * - 预处理：指代词解析、上下文增强
 * - 缓存：多级缓存（L1 精确匹配、L2 语义匹配）
 * - Debug Trace：追踪路由过程，便于问题诊断
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

// ============================================
// 统一入口
// ============================================

export {
  UnifiedEntry,
  getUnifiedEntry,
  createUnifiedEntry,
  resetUnifiedEntry,
} from "./entry";

// ============================================
// 意图分析
// ============================================

export {
  ClassifierChain,
  createClassifierChain,
  type IntentClassifier,
  type ClassifierChainConfig,
  type ClassifierMetadata,
  CONFIDENCE_THRESHOLDS,
} from "./intent";

// ============================================
// 路由决策
// ============================================

export {
  ModeSelector,
  createModeSelector,
  ComplexityEvaluator,
  createComplexityEvaluator,
  COMPLEXITY_THRESHOLDS,
  DATA_SCALE_THRESHOLDS,
} from "./routing";

// ============================================
// 预处理
// ============================================

export {
  InputPreprocessor,
  createInputPreprocessor,
  type PreprocessResult,
} from "./preprocessing";

// ============================================
// 缓存
// ============================================

export { IntentCache, createIntentCache, type CacheStats } from "./cache";

// ============================================
// Debug Trace
// ============================================

export {
  DebugTracer,
  createDebugTracer,
  generateRequestId,
  isDebugTraceEnabled,
  type DebugTrace,
  type TraceStage,
  type TraceSummary,
} from "./debug";

// ============================================
// 类型导出
// ============================================

export type {
  // 核心类型
  IntentType,
  ExecutionMode,
  ComplexityLevel,
  ClassificationSource,
  // 实体类型
  ExtractedEntity,
  IntentSlot,
  IntentSlotSchema,
  // 分类结果
  IntentClassification,
  ClassifierResult,
  // 复杂度
  ComplexityFactor,
  ComplexityEvaluation,
  // 路由结果
  ModeSelection,
  RouteResult,
  RouteMetrics,
  // 上下文
  ClassificationContext,
  RequestContext,
  // 请求
  UnifiedRequest,
  UserRequest,
  // 配置
  RouterConfig,
  UnifiedEntryConfig,
} from "./types";
