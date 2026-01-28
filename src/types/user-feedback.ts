export type FeedbackType = "bug" | "complaint" | "suggestion";

export type FeedbackStatus =
  | "pending" // 待处理
  | "reviewing" // 审核中
  | "in_progress" // 处理中
  | "resolved" // 已解决
  | "closed" // 已关闭
  | "rejected"; // 已拒绝

export type FeedbackPriority = "low" | "normal" | "high" | "urgent";

// 通用上下文��口
export interface FeedbackContext extends Record<string, unknown> {
  page_path?: string;
  user_agent?: string;
  app_version?: string;
  // 允许任意业务字段注入
  [key: string]: unknown;
}

export interface UserFeedback {
  id: string;
  user_id: string;
  type: FeedbackType;
  category?: string;
  title: string;
  description: string;
  context: FeedbackContext;
  attachments: string[];
  status: FeedbackStatus;
  priority: FeedbackPriority;

  // 管理员处理字段
  admin_notes?: string;
  resolution?: string;
  resolved_at?: string;

  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpenFeedbackOptions {
  type?: FeedbackType;
  title?: string; // 预填充标题
  description?: string; // 预填充描述
  context?: FeedbackContext; // 注入业务上下文
  screenshot?: string; // 自动截图(Base64)
}

export interface FeedbackStore {
  isOpen: boolean;
  options: OpenFeedbackOptions;
  open: (options?: OpenFeedbackOptions) => void;
  close: () => void;
}
