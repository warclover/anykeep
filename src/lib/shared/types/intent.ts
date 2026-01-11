/**
 * 意图相关类型定义
 *
 * 统一的意图分类、复杂度、执行模式类型
 *
 * @module @/lib/shared/types/intent
 * @version 1.0.0
 * @since 2026-01-11
 */

// ============================================
// 意图类型
// ============================================

/**
 * 意图类型枚举
 *
 * @description
 * - query: 查询类 - 搜索、列表、统计、获取信息
 * - action: 操作类 - 删除、移动、标签管理
 * - organize: 整理类 - 清理、去重、分类整理
 * - analyze: 分析类 - 报告、洞察、趋势分析
 * - learn: 学习类 - 复习、学习路径、知识巩固
 * - create: 创建类 - 摘要生成、导出、分享
 * - refine: 过滤类 - 筛选、过滤搜索结果（需上下文支持）
 * - chitchat: 闲聊类 - 问候、帮助、非任务对话
 */
export type IntentType =
  | "query"
  | "action"
  | "organize"
  | "analyze"
  | "learn"
  | "create"
  | "refine"
  | "chitchat";

/**
 * 意图类型常量对象
 *
 * 用于类型安全的意图值引用
 */
export const INTENT_TYPES = {
  QUERY: "query",
  ACTION: "action",
  ORGANIZE: "organize",
  ANALYZE: "analyze",
  LEARN: "learn",
  CREATE: "create",
  REFINE: "refine",
  CHITCHAT: "chitchat",
} as const;

// ============================================
// 复杂度级别
// ============================================

/**
 * 复杂度级别
 *
 * @description
 * - simple: 简单任务 - 单步操作，无需协调
 * - medium: 中等任务 - 需要少量步骤或工具调用
 * - complex: 复杂任务 - 多步骤编排，需要进度反馈
 */
export type ComplexityLevel = "simple" | "medium" | "complex";

/**
 * 复杂度级别常量对象
 */
export const COMPLEXITY_LEVELS = {
  SIMPLE: "simple",
  MEDIUM: "medium",
  COMPLEX: "complex",
} as const;

// ============================================
// 执行模式
// ============================================

/**
 * 执行模式
 *
 * @description
 * - atomic: 原子模式 - 单次工具调用，适合简单任务
 * - orchestration: 编排模式 - 多步骤 Skill 编排，适合复杂任务
 */
export type ExecutionMode = "atomic" | "orchestration";

/**
 * 执行模式常量对象
 */
export const EXECUTION_MODES = {
  ATOMIC: "atomic",
  ORCHESTRATION: "orchestration",
} as const;

// ============================================
// 分类来源
// ============================================

/**
 * 意图分类来源
 *
 * @description
 * - rule: 规则匹配
 * - llm: LLM 分类
 * - semantic: 语义匹配
 * - hybrid: 混合模式
 * - cache_l1: L1 缓存（内存）
 * - cache_l2: L2 缓存（持久化）
 * - default: 默认值
 */
export type ClassificationSource =
  | "rule"
  | "llm"
  | "semantic"
  | "hybrid"
  | "cache_l1"
  | "cache_l2"
  | "default";
