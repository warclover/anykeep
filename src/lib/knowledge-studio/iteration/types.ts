/**
 * Knowledge Studio Iteration Module - Types
 * @module knowledge-studio/iteration
 *
 * Phase 4: 草稿迭代与反馈驱动优化
 */

// ============================================================
// Constants
// ============================================================

/** 最大保留版本数 */
export const MAX_DRAFT_VERSIONS = 3;

/** sessionStorage 存储键前缀 */
export const DRAFT_STORAGE_KEY_PREFIX = "ks-v2-draft-versions:";

// ============================================================
// Feedback Types
// ============================================================

/**
 * 反馈类型
 */
export type FeedbackType =
  | "too_long"
  | "too_short"
  | "off_topic"
  | "style_issue"
  | "other";

/**
 * 反馈类型配置
 */
export const FEEDBACK_TYPES: Record<
  FeedbackType,
  {
    label: string;
    icon: string;
    action: string;
    description: string;
  }
> = {
  too_long: {
    label: "内容太长",
    icon: "📏",
    action: "condense",
    description: "需要精简内容，去除冗余",
  },
  too_short: {
    label: "内容太短",
    icon: "📝",
    action: "expand",
    description: "需要扩展内容，添加更多细节",
  },
  off_topic: {
    label: "偏离主题",
    icon: "🎯",
    action: "refocus",
    description: "需要重新聚焦主题",
  },
  style_issue: {
    label: "风格不符",
    icon: "🎨",
    action: "restyle",
    description: "需要调整写作风格",
  },
  other: {
    label: "其他问题",
    icon: "💬",
    action: "custom",
    description: "请在补充说明中描述具体问题",
  },
} as const;

// ============================================================
// Draft Feedback
// ============================================================

/**
 * 用户反馈
 */
export interface DraftFeedback {
  /** 评分 1-5 */
  rating: number;
  /** 反馈类型 */
  type: FeedbackType;
  /** 具体反馈文本（可选） */
  comment?: string;
  /** 反馈时间戳 */
  timestamp: number;
}

// ============================================================
// Draft Version
// ============================================================

/**
 * 草稿来源类型
 */
export type DraftSource = "initial" | "iteration" | "condense";

/**
 * 草稿版本快照
 */
export interface DraftVersion {
  /** 版本 ID */
  id: string;
  /** 版本号（从 1 开始） */
  version: number;
  /** 创建时间戳 */
  timestamp: number;
  /** 草稿内容 */
  content: string;
  /** 字数 */
  wordCount: number;
  /** 来源 */
  source: DraftSource;
  /** 来源描述（如：精简到 1500 字） */
  sourceDescription?: string;
  /** 用户反馈（如果有） */
  feedback?: DraftFeedback;
}

/**
 * 版本管理器状态
 */
export interface DraftVersionState {
  /** 当前版本索引 */
  currentIndex: number;
  /** 版本列表（按时间倒序，最新在前） */
  versions: DraftVersion[];
}

/**
 * 版本管理器配置
 */
export interface DraftVersionManagerConfig {
  /** 最大版本数 */
  maxVersions?: number;
  /** 会话 ID（用于存储隔离） */
  sessionId?: string;
}

// ============================================================
// Iteration Request/Response
// ============================================================

/**
 * 迭代请求
 */
export interface IterateRequest {
  /** 原始内容 */
  originalContent: string;
  /** 用户反馈 */
  feedback: DraftFeedback;
  /** 蓝图 ID */
  blueprintId: string;
  /** 平台风格（可选） */
  platformStyle?: string;
  /** 大纲（保持结构一致，可选） */
  outlineJson?: string;
  /** 素材摘要（可选） */
  materialsSummary?: string;
}

/**
 * 迭代 SSE 事件类型
 */
export type IterateEventType = "content" | "progress" | "done" | "error";

/**
 * 迭代 SSE 事件
 */
export interface IterateEvent {
  type: IterateEventType;
  /** 内容片段（type=content 时） */
  text?: string;
  /** 进度百分比（type=progress 时） */
  percent?: number;
  /** 完成信息（type=done 时） */
  result?: {
    originalWords: number;
    finalWords: number;
    iterationType: string;
  };
  /** 错误信息（type=error 时） */
  message?: string;
}

// ============================================================
// Version Diff
// ============================================================

/**
 * 版本差异信息
 */
export interface DraftVersionDiff {
  /** 字数差异 */
  wordCountDiff: number;
  /** 字数变化百分比 */
  wordCountPercent: number;
  /** 时间差异（毫秒） */
  timeDiff: number;
}

// ============================================================
// UI State
// ============================================================

/**
 * 反馈对话框状态
 */
export interface FeedbackDialogState {
  /** 是否打开 */
  isOpen: boolean;
  /** 评分 */
  rating: number;
  /** 反馈类型 */
  feedbackType: FeedbackType | null;
  /** 补充说明 */
  comment: string;
  /** 是否提交中 */
  isSubmitting: boolean;
}

/**
 * 版本面板状态
 */
export interface VersionPanelState {
  /** 是否打开 */
  isOpen: boolean;
  /** 选中的版本 ID（用于恢复） */
  selectedVersionId: string | null;
  /** 是否显示对比 */
  showDiff: boolean;
  /** 对比的版本 ID */
  compareVersionId: string | null;
}
