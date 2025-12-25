/**
 * 智能路由层类型定义
 *
 * 定义意图分类、复杂度评估、模式选择相关的类型
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

// ============================================
// 意图相关类型
// ============================================

/**
 * 意图类型枚举
 */
export type IntentType =
  | "query" // 查询类：数量、列表、搜索
  | "action" // 操作类：移动、删除、标签
  | "organize" // 整理类：清理、分类、去重
  | "analyze" // 分析类：统计、报告、洞察
  | "learn" // 学习类：复习、路径、面试准备
  | "create" // 创建类：摘要、笔记、文档
  | "chitchat"; // 闲聊类：问候、帮助

/**
 * 提取的实体
 */
export interface ExtractedEntity {
  /** 实体类型 */
  type: "topic" | "time" | "quantity" | "folder" | "tag" | "platform" | "other";
  /** 实体值 */
  value: string;
  /** 原始文本 */
  raw: string;
  /** 置信度 0-1 */
  confidence: number;
}

/**
 * 意图分类结果
 */
export interface IntentClassification {
  /** 意图类型 */
  type: IntentType;
  /** 子类型（如 organize:cleanup, learn:review） */
  subType?: string;
  /** 分类置信度 0-1 */
  confidence: number;
  /** 提取的实体列表 */
  entities: ExtractedEntity[];
  /** 是否需要多步骤处理 */
  requiresMultiStep: boolean;
  /** 是否期望获得交付物 */
  hasDeliverableExpectation: boolean;
  /** 分类来源 */
  source: "rule" | "llm";
}

/**
 * 意图分类规则
 */
export interface IntentRule {
  /** 匹配模式（正则表达式） */
  pattern: RegExp;
  /** 意图类型 */
  type: IntentType;
  /** 子类型 */
  subType?: string;
  /** 复杂度提示 */
  complexity: "simple" | "medium" | "complex";
  /** 权重（用于多规则匹配时的优先级） */
  weight?: number;
}

// ============================================
// 复杂度相关类型
// ============================================

/**
 * 复杂度级别
 */
export type ComplexityLevel = "simple" | "medium" | "complex";

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
  estimatedSteps: number;
  /** 预计执行时间（毫秒） */
  estimatedDurationMs: number;
}

// ============================================
// 模式选择相关类型
// ============================================

/**
 * 执行模式
 */
export type ExecutionMode = "atomic" | "orchestration";

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
}

// ============================================
// 路由相关类型
// ============================================

/**
 * 用户请求
 */
export interface UserRequest {
  /** 用户输入的消息 */
  message: string;
  /** 请求上下文 */
  context: RequestContext;
}

/**
 * 请求上下文
 */
export interface RequestContext {
  /** 用户 ID */
  userId: string;
  /** 会话 ID */
  conversationId?: string;
  /** 关联的书签 ID 列表 */
  bookmarkIds?: number[];
  /** 关联的文件夹 ID */
  folderId?: number;
  /** 消息历史 */
  messageHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  /** 用户书签总数（用于数据规模评估） */
  totalBookmarks?: number;
  /** 用户文件夹数量 */
  totalFolders?: number;
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
  /** 建议使用的编排 Skill（仅编排模式） */
  suggestedSkill: string | null;
  /** 路由决策理由 */
  reason: string;
  /** 路由耗时（毫秒） */
  routingDurationMs: number;
  /** 详细性能指标（可选，debug 模式下返回） */
  metrics?: {
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
    classificationSource: "rule" | "llm" | "default";
    /** LLM 缓存是否命中 */
    llmCacheHit: boolean;
  };
}

// ============================================
// 配置类型
// ============================================

/**
 * 路由器配置
 */
export interface RouterConfig {
  /** 是否启用 LLM 分类（规则不匹配时） */
  enableLLMClassification?: boolean;
  /** 规则匹配置信度阈值 */
  ruleConfidenceThreshold?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 是否在结果中包含详细指标 */
  includeMetrics?: boolean;
  /** 是否启用指标聚合（用于监控） */
  enableMetricsAggregation?: boolean;
}

/**
 * 意图分类器配置
 */
export interface IntentClassifierConfig {
  /** 自定义规则列表 */
  customRules?: IntentRule[];
  /** 是否启用实体提取 */
  enableEntityExtraction?: boolean;
  /** LLM 调用超时时间（毫秒） */
  llmTimeoutMs?: number;
  /** 消歧置信度阈值（top1 和 top2 差值小于此值时触发消歧） */
  disambiguationThreshold?: number;
  /** 是否启用 LLM 兜底分类（规则置信度不足时使用） */
  enableLLMFallback?: boolean;
  /** LLM 兜底触发阈值（规则置信度低于此值时触发 LLM） */
  llmFallbackThreshold?: number;
  /** LLM 分类器配置 */
  llmClassifierConfig?: {
    /** 模型 ID */
    modelId?: string;
    /** 超时时间（毫秒） */
    timeoutMs?: number;
    /** 最大重试次数 */
    maxRetries?: number;
    /** 是否启用缓存 */
    cacheEnabled?: boolean;
    /** 缓存 TTL（毫秒） */
    cacheTTLMs?: number;
    /** 温度参数 */
    temperature?: number;
  };
  /** 是否启用调试模式 */
  debug?: boolean;
}

// ============================================
// 多候选分类相关类型 (Phase 1.1)
// ============================================

/**
 * 意图候选项
 *
 * 表示一个可能的意图匹配结果
 */
export interface IntentCandidate {
  /** 匹配的规则模式（用于调试） */
  pattern: string;
  /** 意图类型 */
  type: IntentType;
  /** 子类型 */
  subType?: string;
  /** 权重（规则定义的优先级） */
  weight: number;
  /** 匹配位置索引 */
  matchIndex: number;
  /** 置信度 0-1 */
  confidence: number;
  /** 复杂度提示 */
  complexity: "simple" | "medium" | "complex";
}

/**
 * 多候选分类结果
 *
 * 包含主意图和所有候选项
 */
export interface MultiCandidateResult {
  /** 最终选定的意图 */
  primary: IntentClassification;
  /** 所有候选项（按置信度排序） */
  candidates: IntentCandidate[];
  /** 是否触发了消歧 */
  disambiguated: boolean;
  /** 消歧原因（如果触发） */
  disambiguationReason?: string;
}

/**
 * 消歧规则
 *
 * 定义当多个意图冲突时如何选择
 */
export interface DisambiguationRule {
  /** 规则 ID */
  id: string;
  /** 冲突的意图类型 */
  conflicts: IntentType[];
  /** 匹配模式 */
  pattern: RegExp;
  /** 胜出的意图类型 */
  winner: IntentType;
  /** 优先级（越高越先匹配） */
  priority: number;
  /** 解释说明 */
  reason: string;
}

/**
 * 复杂度评估器配置
 */
export interface ComplexityEvaluatorConfig {
  /** 简单任务阈值 */
  simpleThreshold?: number;
  /** 复杂任务阈值 */
  complexThreshold?: number;
}
