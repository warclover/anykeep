/**
 * 意图→Skill 映射配置类型定义
 *
 * 统一的配置结构，支持意图模式和 Skill 映射的声明式配置
 *
 * @version 2.1.0
 * @since 2025-12-27
 * @updated 2026-01-11 迁移核心类型到 shared/types
 */

// 从共享类型导入核心类型
import type {
  IntentType,
  ComplexityLevel,
  ExecutionMode,
} from "@/lib/shared/types";

// 重新导出以保持向后兼容
export type { IntentType, ComplexityLevel, ExecutionMode };

// ============================================
// 意图模式配置
// ============================================

/**
 * 意图模式定义
 *
 * 用于意图分类的模式匹配规则
 */
export interface IntentPattern {
  /** 意图类型 */
  type: IntentType;
  /** 子类型（如 search、review、cleanup） */
  subType: string;
  /** 匹配模式（正则表达式字符串） */
  pattern: string;
  /** 权重 0-100，越大越优先 */
  weight: number;
  /** 默认复杂度 */
  complexity: ComplexityLevel;
  /** 描述（可选，用于调试） */
  description?: string;
}

// ============================================
// Skill 映射配置
// ============================================

/**
 * Skill 映射定义
 *
 * 意图到 Skill 的映射关系
 */
export interface SkillMapping {
  /** 映射键：intentType:subType 或 intentType:* */
  key: string;
  /** 目标 Skill ID */
  skillId: string;
  /** 显示名称 */
  name: string;
  /** 执行模式 */
  mode: ExecutionMode;
  /** 最低复杂度要求（可选） */
  minComplexity?: ComplexityLevel;
  /** 是否启用 */
  enabled: boolean;
  /** 优先级（可选，默认 0） */
  priority?: number;
}

/**
 * 显式工具映射
 *
 * UI 工具直接触发 Skill，跳过意图分类
 */
export interface ExplicitToolMapping {
  /** 工具 ID（UI 层使用） */
  toolId: string;
  /** 目标 Skill ID */
  skillId: string;
  /** 执行模式 */
  mode: ExecutionMode;
  /** 图标名称（可选） */
  icon?: string;
  /** 快捷键（可选） */
  shortcut?: string;
}

// ============================================
// 用户偏好覆盖
// ============================================

/**
 * 用户映射偏好
 *
 * 存储在 ai_preferences 中，用于覆盖默认映射
 */
export interface UserMappingPreference {
  /** 自定义映射：intentKey → skillId */
  customMappings?: Record<string, string>;
  /** 禁用的 Skill ID 列表 */
  disabledSkills?: string[];
  /** 确认阈值覆盖（默认 50） */
  confirmThreshold?: number;
  /** 偏好执行模式（可选） */
  preferredMode?: ExecutionMode;
}

// ============================================
// 配置索引类型
// ============================================

/**
 * 映射索引
 *
 * 预构建的 O(1) 查找结构
 */
export type MappingIndex = Map<string, SkillMapping>;

/**
 * 模式索引
 *
 * 按权重排序的模式列表
 */
export type PatternIndex = IntentPattern[];

// ============================================
// 查找结果类型
// ============================================

/**
 * 映射查找结果
 */
export interface MappingLookupResult {
  /** 是否找到 */
  found: boolean;
  /** 匹配的映射（可能为空） */
  mapping: SkillMapping | null;
  /** 匹配类型 */
  matchType: "exact" | "wildcard" | "fallback" | "none";
}

/**
 * 意图分类结果
 */
export interface IntentMatch {
  /** 意图类型 */
  type: IntentType;
  /** 子类型 */
  subType: string;
  /** 置信度 0-1 */
  confidence: number;
  /** 复杂度 */
  complexity: ComplexityLevel;
  /** 匹配的模式（调试用） */
  matchedPattern?: string;
}
