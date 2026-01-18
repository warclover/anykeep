/**
 * 智能分类 v5.0 - 反馈系统类型定义
 */

/**
 * 反馈类型
 */
export type FeedbackType = "accept" | "reject" | "modify";

/**
 * 分类反馈输入
 */
export interface ClassificationFeedback {
  bookmarkId: number;
  suggestedFolderId: number | null;
  suggestedFolderName: string | null;
  actualFolderId: number;
  actualFolderName: string;
  feedbackType: FeedbackType;
  userComment?: string; // 用于 Chat-to-Rule 提取规则
  confidence?: number; // 原始置信度
}

/**
 * 反馈处理结果
 */
export interface FeedbackResult {
  success: boolean;
  profileUpdated: boolean;
  ruleExtracted: boolean;
  logRecorded: boolean;
  error?: string;
}

/**
 * Profile 更新操作类型
 */
export type ProfileUpdateType = "reinforce" | "weaken";

/**
 * Profile 更新参数
 */
export interface ProfileUpdateParams {
  folderId: number;
  bookmarkId: number;
  updateType: ProfileUpdateType;
  learningRate?: number; // 默认 0.1
}
