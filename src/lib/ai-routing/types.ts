/**
 * AI Routing 统一路由层类型定义
 *
 * 从 ai-skills/router/types.ts 迁移核心类型
 * 作为 Layer 4 的统一类型入口
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

// 从共享类型导入核心类型
import type {
  IntentType as SharedIntentType,
  ComplexityLevel as SharedComplexityLevel,
  ExecutionMode as SharedExecutionMode,
  ClassificationSource as SharedClassificationSource,
} from "@/lib/shared/types";

// 导出类型别名以保持向后兼容
export type IntentType = SharedIntentType;
export type ComplexityLevel = SharedComplexityLevel;
export type ExecutionMode = SharedExecutionMode;
export type ClassificationSource = SharedClassificationSource;

// ============================================
// 实体相关类型
// ============================================

/**
 * 提取的实体
 */
export interface ExtractedEntity {
  /** 实体类型 */
  type: "topic" | "time" | "quantity" | "folder" | "tag" | "platform" | "other";
  /** 实���值 */
  value: string;
  /** 原始文本 */
  raw: string;
  /** 置信度 0-1 */
  confidence: number;
}

/**
 * 槽位定义（结构化参数）
 */
export interface IntentSlot {
  /** 槽位名称 */
  name: string;
  /** 槽位值 */
  value: unknown;
  /** 槽位类型 */
  type: "string" | "number" | "boolean" | "array" | "object";
  /** 置信度 0-1 */
  confidence: number;
  /** 是否必需 */
  required: boolean;
  /** 来源 */
  source: "extracted" | "inferred" | "default" | "context";
}

/**
 * 意图槽位映射
 */
export interface IntentSlotSchema {
  /** 意图类型 */
  intentType: `${IntentType}:${string}`;
  /** 槽位定义 */
  slots: Record<string, IntentSlot>;
  /** 槽位完整性评分 0-1 */
  completeness: number;
}

// ============================================
// 分类结果类型
// ============================================

/**
 * 意图分类结果
 */
export interface IntentClassification {
  /** 意图类型 */
  type: IntentType;
  /** 子类型 */
  subType?: string;
  /** 分类置信度 0-1 */
  confidence: number;
  /** 原始置信度（校准前） */
  originalConfidence?: number;
  /** 提取的实体列表 */
  entities: ExtractedEntity[];
  /** 是否需要多步骤处理 */
  requiresMultiStep: boolean;
  /** 是否期望获得交付物 */
  hasDeliverableExpectation: boolean;
  /** 分类来源 */
  source: ClassificationSource;
  /** 结构化槽位 */
  slots?: IntentSlotSchema;
  /** 备选意图列表 */
  alternatives?: Array<{
    type: IntentType;
    subType?: string;
    confidence: number;
  }>;
  /** 推理说明 */
  reasoning?: string;
}

/**
 * 复杂度因素
 */
export interface ComplexityFactor {
  /** 因素名称 */
  name: string;
  /** 权重 0-1 */
  weight: number;
  /** 评分 0-100 */
  value: number;
  /** 评分理由 */
  reason: string;
}

/**
 * 复杂度评估结果
 */
export interface ComplexityEvaluation {
  /** 复杂度级别 */
  level: ComplexityLevel;
  /** 总分 0-100 */
  score: number;
  /** 各因素评分 */
  factors: ComplexityFactor[];
  /** 预计步骤数 */
  estimatedSteps?: number;
  /** 预计执行时间（毫秒） */
  estimatedDurationMs?: number;
}

// ============================================
// 上下文类型
// ============================================

/**
 * 分类上下文
 */
export interface ClassificationContext {
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  sessionId?: string;
  /** 轮次 ID */
  turnId?: string;
  /** 关联的书签 ID 列表 */
  selectedBookmarks?: number[];
  /** 关联的文件夹 ID */
  folderId?: number;
  /** 消息历史 */
  recentMessages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  /** 用户书签总数 */
  totalBookmarks?: number;
  /** 用户文件夹数量 */
  totalFolders?: number;
  /** 用户统计信息 */
  userStats?: {
    bookmarkCount: number;
    folderCount: number;
    tagCount: number;
  };
}

/**
 * 请求上下文（兼容旧版）
 */
export interface RequestContext extends ClassificationContext {
  /** 会话 ID（别名） */
  conversationId?: string;
  /** 关联的书签 ID 列表（别名） */
  bookmarkIds?: number[];
  /** 消息历史（别名） */
  messageHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

// ============================================
// 路由结果类型
// ============================================

/**
 * 模式选择结果
 */
export interface ModeSelection {
  /** 选择的执行模式 */
  mode: ExecutionMode;
  /** 选择理由 */
  reason: string;
  /** 失败时的回退模式 */
  fallbackMode?: ExecutionMode;
  /** 是否使用 ReAct 循环执行 */
  useReact?: boolean;
  /** ReAct 决策理由 */
  reactReason?: string;
}

/**
 * 路由结果
 */
export interface RouteResult {
  /** 意图分类结果 */
  intent: IntentClassification;
  /** 复杂度评估结果 */
  complexity: ComplexityEvaluation;
  /** 模式选择结果 */
  mode: ExecutionMode;
  /** 建议使用的编排 Skill */
  suggestedSkill: string | null;
  /** 路由决策理由 */
  reason: string;
  /** 路由耗时（毫秒） */
  routingDurationMs: number;
  /** 工作流 ID */
  workflowId?: string;
  /** 工作流名称 */
  workflowName?: string;
  /** 是否使用 ReAct 循环执行 */
  useReact?: boolean;
  /** ReAct 决策理由 */
  reactReason?: string;
  /** 缓存命中级别 */
  cacheHit?: "L0" | "L1" | "L2" | "none";
  /** 预处理后的消息 */
  preprocessedMessage?: string;
  /** 详细性能指标 */
  metrics?: RouteMetrics;
}

/**
 * 路由性能指标
 */
export interface RouteMetrics {
  /** 意图分类耗时（毫秒） */
  classificationDurationMs: number;
  /** 复杂度评估耗时（毫秒） */
  complexityDurationMs: number;
  /** 模式选择耗时（毫秒） */
  modeSelectorDurationMs: number;
  /** 匹配的规则数量 */
  ruleMatchCount: number;
  /** 是否触发了消歧 */
  disambiguationUsed: boolean;
  /** 是否使用了 LLM 兜底 */
  llmFallbackUsed: boolean;
  /** 分类来源 */
  classificationSource: ClassificationSource;
  /** LLM 缓存是否命中 */
  llmCacheHit: boolean;
}

// ============================================
// 统一入口类型
// ============================================

/**
 * 统一请求
 */
export interface UnifiedRequest {
  /** 用户输入的消息 */
  message: string;
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  sessionId?: string;
  /** 请求上下文 */
  context?: Partial<RequestContext>;
}

/**
 * 用户请求（兼容旧版）
 */
export interface UserRequest {
  /** 用户输入的消息 */
  message: string;
  /** 请求上下文 */
  context: RequestContext;
}

// ============================================
// 配置类型
// ============================================

/**
 * 路由器配置
 */
export interface RouterConfig {
  /** 是否启用 LLM 分类 */
  enableLLMClassification?: boolean;
  /** 规则匹配置信度阈值 */
  ruleConfidenceThreshold?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 是否在结果中包含详细指标 */
  includeMetrics?: boolean;
  /** 是否启用指标聚合 */
  enableMetricsAggregation?: boolean;
}

/**
 * 统一入口配置
 */
export interface UnifiedEntryConfig {
  /** 是否启用预处理 */
  enablePreprocessing?: boolean;
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 是否启用 Debug Trace */
  enableDebugTrace?: boolean;
  /** 路由器配置 */
  routerConfig?: RouterConfig;
}

// ============================================
// 分类器接口类型
// ============================================

/**
 * 分类器结果（统一格式）
 */
export interface ClassifierResult {
  /** 意图类型 */
  intent: IntentType;
  /** 子类型 */
  subType?: string;
  /** 置信度 */
  confidence: number;
  /** 提取的实体 */
  entities: ExtractedEntity[];
  /** 匹配的 Skill */
  matchedSkill?: string;
  /** 匹配的 Workflow */
  matchedWorkflow?: string;
  /** 推理说明 */
  reasoning?: string;
}

/**
 * 意图分类器接口
 */
export interface IIntentClassifier {
  /** 分类器名称 */
  readonly name: string;
  /** 优先级（数字越小优先级越高） */
  readonly priority: number;

  /**
   * 判断是否能处理该消息
   */
  canHandle(message: string, context: ClassificationContext): boolean;

  /**
   * 执行分类
   */
  classify(
    message: string,
    context: ClassificationContext,
  ): Promise<ClassifierResult>;

  /**
   * 可选：置信度校准
   */
  calibrate?(result: ClassifierResult): ClassifierResult;
}
