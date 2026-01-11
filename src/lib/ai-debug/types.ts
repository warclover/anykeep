/**
 * AI 调试配置类型定义
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

/**
 * AI 调试 Feature Flags 配置
 *
 * null = 使用环境变量默认值
 * true/false = 强制覆盖
 */
export interface AIDebugFeatureFlags {
  // ============================================
  // 核心优化开关（影响响应速度最大）
  // ============================================

  /** 混合意图分类器 - 禁用后仅使用规则匹配，跳过 LLM Slow Track */
  ENABLE_HYBRID_INTENT_CLASSIFIER: boolean | null;

  /** LLM 查询改写 - 禁用后跳过语义扩展 */
  ENABLE_QUERY_REWRITE: boolean | null;

  /** Rerank 重排序 - 禁用后跳过交叉编码器重排序 */
  ENABLE_RERANK: boolean | null;

  // ============================================
  // 可选优化开关
  // ============================================

  /** System-Reminder 动态注入 */
  ENABLE_SYSTEM_REMINDER: boolean | null;

  /** 情景记忆 Prompt 注入 */
  ENABLE_MEMORY_PROMPT: boolean | null;

  /** 工作流对话触发检测 */
  ENABLE_WORKFLOW_CONVERSATION_TRIGGER: boolean | null;

  /** RAG 监控 */
  ENABLE_RAG_MONITORING: boolean | null;

  /** 引用追踪 */
  ENABLE_CITATION_TRACKING: boolean | null;

  // ============================================
  // 调试信息开关
  // ============================================

  /** 在响应中包含路由信息 */
  INCLUDE_ROUTING_INFO: boolean | null;

  /** 启用详细调试日志 */
  DEBUG_MODE: boolean | null;
}

/**
 * AI 调试配置（完整）
 */
export interface AIDebugConfig {
  /** 配置版本（用于迁移） */
  version: number;

  /** Feature Flags 覆盖 */
  featureFlags: AIDebugFeatureFlags;

  /** 是否启用调试模式 */
  enabled: boolean;

  /** 上次更新时间 */
  updatedAt: number;
}

/**
 * Feature Flag 元数据
 */
export interface FeatureFlagMeta {
  /** 标识符 */
  key: keyof AIDebugFeatureFlags;

  /** 显示名称 */
  label: string;

  /** 描述 */
  description: string;

  /** 分类 */
  category: "core" | "optional" | "debug";

  /** 环境变量默认值 */
  envDefault: boolean;

  /** 性能影响程度 (1-5) */
  performanceImpact: 1 | 2 | 3 | 4 | 5;
}

/**
 * 所有 Feature Flags 的元数据
 */
export const FEATURE_FLAG_META: FeatureFlagMeta[] = [
  // 核心优化
  {
    key: "ENABLE_HYBRID_INTENT_CLASSIFIER",
    label: "混合意图分类器",
    description:
      "禁用后仅使用规则匹配，跳过 LLM Slow Track（可节省 500-1500ms）",
    category: "core",
    envDefault: false,
    performanceImpact: 5,
  },
  {
    key: "ENABLE_QUERY_REWRITE",
    label: "LLM 查询改写",
    description: "对用户查询进行语义扩展和同义词补充（约 300-800ms）",
    category: "core",
    envDefault: true,
    performanceImpact: 4,
  },
  {
    key: "ENABLE_RERANK",
    label: "Rerank 重排序",
    description: "使用交叉编码器对搜索结果进行语义重排序（约 200-500ms）",
    category: "core",
    envDefault: true,
    performanceImpact: 4,
  },

  // 可选优化
  {
    key: "ENABLE_SYSTEM_REMINDER",
    label: "System-Reminder 注入",
    description: "基于用户数据状态主动提供建议（约 50-100ms）",
    category: "optional",
    envDefault: true,
    performanceImpact: 2,
  },
  {
    key: "ENABLE_MEMORY_PROMPT",
    label: "情景记忆 Prompt",
    description: "将情景记忆注入 System Prompt（约 20-50ms）",
    category: "optional",
    envDefault: true,
    performanceImpact: 1,
  },
  {
    key: "ENABLE_WORKFLOW_CONVERSATION_TRIGGER",
    label: "工作流检测",
    description: "检测是否触发工作流模式（约 10-30ms）",
    category: "optional",
    envDefault: true,
    performanceImpact: 1,
  },
  {
    key: "ENABLE_RAG_MONITORING",
    label: "RAG 监控",
    description: "启用 RAG 系统指标收集（约 5-20ms）",
    category: "optional",
    envDefault: true,
    performanceImpact: 1,
  },
  {
    key: "ENABLE_CITATION_TRACKING",
    label: "引用追踪",
    description: "自动为搜索结果建立引用索引（约 10-30ms）",
    category: "optional",
    envDefault: true,
    performanceImpact: 1,
  },

  // 调试信息
  {
    key: "INCLUDE_ROUTING_INFO",
    label: "路由信息",
    description: "在响应中包含意图路由决策信息",
    category: "debug",
    envDefault: false,
    performanceImpact: 1,
  },
  {
    key: "DEBUG_MODE",
    label: "调试模式",
    description: "启用详细调试日志输出",
    category: "debug",
    envDefault: false,
    performanceImpact: 1,
  },
];

/**
 * 默认配置
 */
export const DEFAULT_AI_DEBUG_CONFIG: AIDebugConfig = {
  version: 1,
  featureFlags: {
    ENABLE_HYBRID_INTENT_CLASSIFIER: null,
    ENABLE_QUERY_REWRITE: null,
    ENABLE_RERANK: null,
    ENABLE_SYSTEM_REMINDER: null,
    ENABLE_MEMORY_PROMPT: null,
    ENABLE_WORKFLOW_CONVERSATION_TRIGGER: null,
    ENABLE_RAG_MONITORING: null,
    ENABLE_CITATION_TRACKING: null,
    INCLUDE_ROUTING_INFO: null,
    DEBUG_MODE: null,
  },
  enabled: false,
  updatedAt: Date.now(),
};

/**
 * 最快模式预设
 * 禁用所有可能影响速度的功能
 */
export const FASTEST_MODE_PRESET: Partial<AIDebugFeatureFlags> = {
  ENABLE_HYBRID_INTENT_CLASSIFIER: false,
  ENABLE_QUERY_REWRITE: false,
  ENABLE_RERANK: false,
  ENABLE_SYSTEM_REMINDER: false,
  ENABLE_MEMORY_PROMPT: false,
  ENABLE_WORKFLOW_CONVERSATION_TRIGGER: false,
  ENABLE_RAG_MONITORING: false,
  ENABLE_CITATION_TRACKING: false,
};
