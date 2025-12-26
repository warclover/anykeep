/**
 * 任务模板类型定义
 *
 * 模板引擎用于快速匹配常见任务模式，跳过 LLM 调用
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import type { RiskLevel } from "../types";

// =============================================================================
// 模板定义
// =============================================================================

/**
 * 任务模板
 *
 * 定义一个可匹配的任务模式
 */
export interface TaskTemplate {
  /** 模板唯一 ID */
  id: string;

  /** 模板名称（调试用） */
  name: string;

  /** 任务类型 */
  taskType: TaskTemplateType;

  /** 匹配模式（正则表达式） */
  patterns: RegExp[];

  /** 关键词匹配（简单模式） */
  keywords?: string[];

  /** 排除词（匹配到这些词则不使用此模板） */
  excludeKeywords?: string[];

  /** 目标描述模板（支持 {参数} 占位符） */
  goalTemplate: string;

  /** 决策依据模板 */
  reasoningTemplate: string;

  /** 执行计划模板 */
  executionPlanTemplate: ExecutionStepTemplate[];

  /** 风险级别 */
  riskLevel: RiskLevel;

  /** 基础置信度（会根据匹配质量调整） */
  baseConfidence: number;

  /** 是否需要确认 */
  requiresConfirmation: boolean;

  /** 确认原因 */
  confirmationReason?: string;

  /** 优先级（越高越优先匹配） */
  priority: number;

  /** 是否启用 */
  enabled: boolean;
}

/**
 * 模板任务类型
 */
export type TaskTemplateType =
  | "search"
  | "organize"
  | "move"
  | "batch_tags"
  | "export"
  | "delete"
  | "query"
  | "review"
  | "cancel"
  | "other";

/**
 * 执行步骤模板
 */
export interface ExecutionStepTemplate {
  /** 步骤描述模板 */
  descriptionTemplate: string;

  /** 操作 */
  action?: string;

  /** 参数模板 */
  paramsTemplate?: Record<string, string>;

  /** 是否需要确认 */
  requiresConfirmation?: boolean;
}

// =============================================================================
// 匹配结果
// =============================================================================

/**
 * 模板匹配结果
 */
export interface TemplateMatchResult {
  /** 是否匹配成功 */
  matched: boolean;

  /** 匹配的模板（如果匹配成功） */
  template?: TaskTemplate;

  /** 提取的参数 */
  extractedParams: Record<string, string>;

  /** 匹配置信度 (0-1) */
  confidence: number;

  /** 匹配详情（调试用） */
  matchDetails?: TemplateMatchDetails;
}

/**
 * 匹配详情
 */
export interface TemplateMatchDetails {
  /** 匹配方式 */
  matchType: "pattern" | "keyword";

  /** 匹配的模式/关键词 */
  matchedBy: string;

  /** 匹配得分 */
  score: number;
}

// =============================================================================
// 引擎配置
// =============================================================================

/**
 * 模板引擎配置
 */
export interface TaskTemplateEngineConfig {
  /** 模板列表 */
  templates: TaskTemplate[];

  /** 最小匹配置信度（低于此值不使用模板） */
  minConfidence?: number;

  /** 是否启用调试日志 */
  debug?: boolean;
}
