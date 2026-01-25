/**
 * 智能分类 v5.0 - 规则类型存根
 *
 * 此文件为类型存根，用于兼容引用已重构模块的组件
 * @deprecated 这些类型将在后续版本中移除
 */

/**
 * 规则类型
 */
export type RuleType = "url" | "title" | "content" | "domain" | "tag";

/**
 * 模式类型
 */
export type PatternType =
  | "exact"
  | "contains"
  | "regex"
  | "prefix"
  | "suffix"
  | "keyword"
  | "domain";

/**
 * 用户分类规则类型
 */
export interface UserClassificationRule {
  id: number;
  user_id: string;
  type: RuleType;
  pattern_type: PatternType;
  /** @deprecated 使用 pattern_type */
  patternType?: PatternType;
  pattern: string;
  target_folder_id: number;
  target_folder_name?: string;
  /** @deprecated 使用 target_folder_name */
  targetFolderName?: string;
  priority: number;
  is_active: boolean;
  /** @deprecated 使用 is_active */
  isActive?: boolean;
  match_count: number;
  /** @deprecated 使用 match_count */
  matchCount?: number;
  last_matched_at: string | null;
  description: string | null;
  created_at: string;
  /** @deprecated 使用 created_at */
  createdAt?: string;
  updated_at: string;
  /** 置信度 (可选) */
  confidence?: number;
}

/**
 * 规则创建输入
 */
export interface CreateRuleInput {
  type: UserClassificationRule["type"];
  pattern_type: UserClassificationRule["pattern_type"];
  pattern: string;
  target_folder_id: number;
  priority?: number;
  description?: string;
}

/**
 * 规则更新输入
 */
export interface UpdateRuleInput {
  type?: UserClassificationRule["type"];
  pattern_type?: UserClassificationRule["pattern_type"];
  pattern?: string;
  target_folder_id?: number;
  priority?: number;
  is_active?: boolean;
  description?: string;
}

/**
 * 规则匹配结果
 */
export interface RuleMatchResult {
  matched: boolean;
  rule?: UserClassificationRule;
  folder_id?: number;
  folder_name?: string;
}
