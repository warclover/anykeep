/**
 * Chat-to-Edit Engine - 聊天式编辑引擎类型
 * @module knowledge-studio/chat-edit
 */

import type { RecoverableError } from "../types";

/**
 * 编辑模式
 */
export type EditMode = "rewrite" | "expand" | "simplify" | "tone" | "custom";

/**
 * 编辑意图
 */
export interface EditIntent {
  mode: EditMode;
  instruction: string;
  targetTone?: "formal" | "casual" | "academic" | "friendly";
}

/**
 * 段落信息
 */
export interface ParagraphInfo {
  index: number;
  content: string;
  wordCount: number;
  startOffset: number;
  endOffset: number;
}

/**
 * 编辑上下文（滑动窗口 - Decision 4.3）
 */
export interface ChatEditContext {
  /** 当前段落 */
  paragraph: ParagraphInfo;

  /** 前后段落上下文 */
  surroundingContext: {
    before: string;
    after: string;
  };

  /** 最近 3 轮对话 */
  recentTurns: ChatTurn[];

  /** 早期对话摘要（约 500 token） */
  olderTurnsSummary?: string;

  /** 报告元信息 */
  reportContext: {
    blueprintType: string;
    title?: string;
    totalParagraphs: number;
  };
}

/**
 * 对话轮次
 */
export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  editResult?: {
    before: string;
    after: string;
  };
}

/**
 * 编辑请求
 */
export interface ChatEditRequest {
  reportId: string;
  paragraphIndex: number;
  intent: EditIntent;
  context: ChatEditContext;
}

/**
 * 编辑差异
 */
export interface EditDiff {
  before: string;
  after: string;
  changes: DiffChange[];
  stats: {
    added: number;
    removed: number;
    unchanged: number;
  };
}

/**
 * 差异变更
 */
export interface DiffChange {
  type: "add" | "remove" | "unchanged";
  value: string;
  lineNumber?: number;
}

/**
 * 编辑响应
 */
export interface ChatEditResponse {
  success: boolean;
  newContent?: string;
  diff?: EditDiff;
  suggestion?: string;
  error?: RecoverableError;
}

/**
 * 编辑历史记录
 */
export interface EditHistory {
  id: string;
  reportId: string;
  paragraphIndex: number;
  turns: ChatTurn[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 滑动窗口配置
 */
export interface SlidingWindowConfig {
  /** 保留的最近对话轮次数 */
  maxRecentTurns: number;

  /** 早期对话摘要的最大 token 数 */
  maxSummaryTokens: number;

  /** 上下文段落数（前后各几段） */
  contextParagraphs: number;
}

/**
 * 默认滑动窗口配置（Decision 4.3）
 */
export const DEFAULT_SLIDING_WINDOW_CONFIG: SlidingWindowConfig = {
  maxRecentTurns: 3,
  maxSummaryTokens: 500,
  contextParagraphs: 1,
};

/**
 * 编辑模式显示配置
 */
export const EDIT_MODE_CONFIG: Record<
  EditMode,
  {
    name: string;
    description: string;
    icon: string;
  }
> = {
  rewrite: {
    name: "重写",
    description: "完全重写这段内容",
    icon: "✏️",
  },
  expand: {
    name: "扩展",
    description: "添加更多细节和解释",
    icon: "📝",
  },
  simplify: {
    name: "简化",
    description: "简化表达，更易理解",
    icon: "✨",
  },
  tone: {
    name: "调整语气",
    description: "改变写作风格和语气",
    icon: "🎭",
  },
  custom: {
    name: "自定义",
    description: "按照你的指示修改",
    icon: "💬",
  },
};
