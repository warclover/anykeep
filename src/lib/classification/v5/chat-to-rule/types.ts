/**
 * 智能分类 v5.0 - Chat-to-Rule 类型定义
 */

/**
 * 规则类型
 */
export type RuleType = "positive" | "negative";

/**
 * 模式类型
 */
export type PatternType = "keyword" | "regex" | "domain";

/**
 * 用户分类规则
 */
export interface UserClassificationRule {
  id: number;
  userId: string;
  type: RuleType;
  pattern: string;
  patternType: PatternType;
  targetFolderId: number | null;
  targetFolderName: string;
  priority: number;
  isActive: boolean;
  sourceText: string | null;
  description: string | null;
  matchCount: number;
  lastMatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 提取的规则
 */
export interface ExtractedRule {
  type: RuleType;
  pattern: string;
  patternType: PatternType;
  targetFolderName: string;
  description: string;
  confidence: number; // 0-1
}

/**
 * 规则提取参数
 */
export interface RuleExtractionParams {
  userComment: string;
  suggestedFolderName?: string;
  actualFolderName: string;
  bookmarkTitle?: string;
  bookmarkUrl?: string;
}

/**
 * 规则验证结果
 */
export interface RuleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 规则创建参数
 */
export interface CreateRuleParams {
  type: RuleType;
  pattern: string;
  patternType: PatternType;
  targetFolderId: number | null;
  targetFolderName: string;
  priority?: number;
  sourceText?: string;
  description?: string;
}

/**
 * 规则应用结果
 */
export interface RuleApplicationResult {
  matched: boolean;
  ruleId?: number;
  ruleName?: string;
  targetFolderId?: number;
  targetFolderName?: string;
}
