/**
 * 智能路由常量定义
 *
 * 将意图类型、子类型和复杂度级别提取为常量，
 * 避免魔法字符串，提高类型安全性和可维护性
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

// ============================================
// 意图类型常量
// ============================================

/**
 * 意图类型常量
 *
 * 定义所有支持的意图类型
 */
export const INTENT_TYPES = {
  /** 查询类：数量、列表、搜索 */
  QUERY: "query",
  /** 操作类：移动、删除、标签 */
  ACTION: "action",
  /** 整理类：清理、分类、去重 */
  ORGANIZE: "organize",
  /** 分析类：统计、报告、洞察 */
  ANALYZE: "analyze",
  /** 学习类：复习、路径、面试准备 */
  LEARN: "learn",
  /** 创建类：摘要、笔记、文档 */
  CREATE: "create",
  /** 闲聊类：问候、帮助 */
  CHITCHAT: "chitchat",
} as const;

/**
 * 意图类型（从常量推断）
 */
export type IntentTypeValue = (typeof INTENT_TYPES)[keyof typeof INTENT_TYPES];

// ============================================
// 意图子类型常量
// ============================================

/**
 * 查询类意图子类型
 */
export const QUERY_SUBTYPES = {
  /** 搜索内容 */
  SEARCH: "search",
  /** 列出内容 */
  LIST: "list",
  /** 统计数量 */
  COUNT: "count",
  /** 查看详情 */
  DETAIL: "detail",
} as const;

/**
 * 操作类意图子类型
 */
export const ACTION_SUBTYPES = {
  /** 移动内容 */
  MOVE: "move",
  /** 删除内容 */
  DELETE: "delete",
  /** 添加标签 */
  TAG: "tag",
  /** 批量操作 */
  BATCH: "batch",
  /** 归档内容 */
  ARCHIVE: "archive",
} as const;

/**
 * 整理类意图子类型
 */
export const ORGANIZE_SUBTYPES = {
  /** 清理内容 */
  CLEANUP: "cleanup",
  /** 分类内容 */
  CLASSIFY: "classify",
  /** 去重处理 */
  DEDUPE: "dedupe",
  /** 批量整理 */
  BATCH_ORGANIZE: "batch_organize",
} as const;

/**
 * 分析类意图子类型
 */
export const ANALYZE_SUBTYPES = {
  /** 统计分析 */
  STATS: "stats",
  /** 生成报告 */
  REPORT: "report",
  /** 洞察分析 */
  INSIGHT: "insight",
  /** 趋势分析 */
  TREND: "trend",
} as const;

/**
 * 学习类意图子类型
 */
export const LEARN_SUBTYPES = {
  /** 知识复习 */
  REVIEW: "review",
  /** 学习路径 */
  PATH: "path",
  /** 面试准备 */
  INTERVIEW: "interview",
  /** 记忆卡片 */
  FLASHCARD: "flashcard",
} as const;

/**
 * 创建类意图子类型
 */
export const CREATE_SUBTYPES = {
  /** 生成摘要 */
  SUMMARY: "summary",
  /** 创建笔记 */
  NOTE: "note",
  /** 生成文档 */
  DOCUMENT: "document",
  /** 导出数据 */
  EXPORT: "export",
} as const;

/**
 * 闲聊类意图子类型
 */
export const CHITCHAT_SUBTYPES = {
  /** 问候 */
  GREETING: "greeting",
  /** 帮助 */
  HELP: "help",
  /** 告别 */
  GOODBYE: "goodbye",
  /** 其他 */
  OTHER: "other",
} as const;

/**
 * 所有意图子类型汇总
 */
export const INTENT_SUBTYPES = {
  [INTENT_TYPES.QUERY]: QUERY_SUBTYPES,
  [INTENT_TYPES.ACTION]: ACTION_SUBTYPES,
  [INTENT_TYPES.ORGANIZE]: ORGANIZE_SUBTYPES,
  [INTENT_TYPES.ANALYZE]: ANALYZE_SUBTYPES,
  [INTENT_TYPES.LEARN]: LEARN_SUBTYPES,
  [INTENT_TYPES.CREATE]: CREATE_SUBTYPES,
  [INTENT_TYPES.CHITCHAT]: CHITCHAT_SUBTYPES,
} as const;

// ============================================
// 复杂度级别常量
// ============================================

/**
 * 复杂度级别常量
 */
export const COMPLEXITY_LEVELS = {
  /** 简单任务 */
  SIMPLE: "simple",
  /** 中等任务 */
  MEDIUM: "medium",
  /** 复杂任务 */
  COMPLEX: "complex",
} as const;

/**
 * 复杂度级别（从常量推断）
 */
export type ComplexityLevelValue =
  (typeof COMPLEXITY_LEVELS)[keyof typeof COMPLEXITY_LEVELS];

// ============================================
// 执行模式常量
// ============================================

/**
 * 执行模式常量
 */
export const EXECUTION_MODES = {
  /** 原子模式（单工具调用） */
  ATOMIC: "atomic",
  /** 编排模式（多步骤任务） */
  ORCHESTRATION: "orchestration",
} as const;

/**
 * 执行模式（从常量推断）
 */
export type ExecutionModeValue =
  (typeof EXECUTION_MODES)[keyof typeof EXECUTION_MODES];

// ============================================
// 分类来源常量
// ============================================

/**
 * 分类来源常量
 */
export const CLASSIFICATION_SOURCES = {
  /** 规则匹配 */
  RULE: "rule",
  /** LLM 分类 */
  LLM: "llm",
  /** 语义匹配 */
  SEMANTIC: "semantic",
  /** 混合匹配 */
  HYBRID: "hybrid",
  /** 默认 */
  DEFAULT: "default",
  /** L1 缓存命中 */
  CACHE_L1: "cache_l1",
  /** L2 语义缓存命中 */
  CACHE_L2: "cache_l2",
} as const;

/**
 * 分类来源（从常量推断）
 */
export type ClassificationSourceValue =
  (typeof CLASSIFICATION_SOURCES)[keyof typeof CLASSIFICATION_SOURCES];

// ============================================
// 实体类型常量
// ============================================

/**
 * 实体类型常量
 */
export const ENTITY_TYPES = {
  /** 主题 */
  TOPIC: "topic",
  /** 时间 */
  TIME: "time",
  /** 数量 */
  QUANTITY: "quantity",
  /** 文件夹 */
  FOLDER: "folder",
  /** 标签 */
  TAG: "tag",
  /** 平台 */
  PLATFORM: "platform",
  /** 其他 */
  OTHER: "other",
} as const;

/**
 * 实体类型（从常量推断）
 */
export type EntityTypeValue = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

// ============================================
// 辅助函数
// ============================================

/**
 * 检查是否为有效的意图类型
 */
export function isValidIntentType(type: string): type is IntentTypeValue {
  return Object.values(INTENT_TYPES).includes(type as IntentTypeValue);
}

/**
 * 检查是否为有效的复杂度级别
 */
export function isValidComplexityLevel(
  level: string,
): level is ComplexityLevelValue {
  return Object.values(COMPLEXITY_LEVELS).includes(
    level as ComplexityLevelValue,
  );
}

/**
 * 检查是否为有效的执行模式
 */
export function isValidExecutionMode(mode: string): mode is ExecutionModeValue {
  return Object.values(EXECUTION_MODES).includes(mode as ExecutionModeValue);
}

/**
 * 获取意图类型的子类型列表
 */
export function getSubtypesForIntent(
  intentType: IntentTypeValue,
): readonly string[] {
  const subtypes = INTENT_SUBTYPES[intentType];
  return subtypes ? Object.values(subtypes) : [];
}
