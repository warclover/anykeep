/**
 * 智能分类 v5.0 - 对话转规则类型定义
 *
 * @version 1.0.0
 * @since 2026-01-26
 */

/**
 * 用户分类规则
 */
export interface UserClassificationRule {
  /** 规则 ID */
  id: number;
  /** 用户 ID */
  user_id?: string;
  userId?: string;
  /** 目标文件夹 ID */
  target_folder_id?: number;
  targetFolderId?: number;
  /** 目标文件夹名称 */
  target_folder_name?: string;
  targetFolderName?: string;
  /** 规则类型: title | url | content */
  type: "title" | "url" | "content";
  /** 模式类型: keyword | domain | regex */
  pattern_type?: "keyword" | "domain" | "regex";
  patternType?: "keyword" | "domain" | "regex";
  /** 匹配模式 */
  pattern: string;
  /** 规则描述 */
  description?: string;
  /** 是否启用 */
  is_active?: boolean;
  isActive?: boolean;
  /** 匹配次数 */
  match_count?: number;
  matchCount?: number;
  /** 创建时间 */
  created_at?: string;
  createdAt?: string;
  /** 更新时间 */
  updated_at?: string;
  updatedAt?: string;
}

/**
 * 规则创建参数
 */
export interface CreateRuleParams {
  /** 目标文件夹 ID */
  targetFolderId: number;
  /** 规则类型 */
  type: "title" | "url" | "content";
  /** 模式类型 */
  patternType: "keyword" | "domain" | "regex";
  /** 匹配模式 */
  pattern: string;
  /** 规则描述 */
  description?: string;
}

/**
 * 规则更新参数
 */
export interface UpdateRuleParams {
  /** 匹配模式 */
  pattern?: string;
  /** 规则描述 */
  description?: string;
  /** 是否启用 */
  isActive?: boolean;
}

/**
 * 对话解析结果
 */
export interface ChatParseResult {
  /** 是否成功解析 */
  success: boolean;
  /** 解析出的规则 */
  rule?: CreateRuleParams;
  /** 解析错误信息 */
  error?: string;
  /** 置信度 */
  confidence: number;
}
