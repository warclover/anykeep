/**
 * AI 自我学习前端组件 - 类型定义
 *
 * @module ai/learning
 * @version 1.0.0
 * @since 2025-12-26
 */

import type { IntentType, CorrectionSignalType } from "@/lib/ai-learning/types";

// =============================================================================
// 纠正检测类型
// =============================================================================

/**
 * 纠正检测结果（前端用）
 */
export interface CorrectionDetection {
  /** 是否检测到纠正 */
  isCorrection: boolean;
  /** 错误的意图 */
  wrongIntent: IntentType;
  /** 推断的正确意图 */
  correctIntent?: IntentType;
  /** 信号类型 */
  signalType: CorrectionSignalType;
  /** 置信度 */
  confidence: number;
  /** 原始用户输入 */
  originalInput: string;
}

/**
 * 意图显示名称映射
 *
 * 注意：IntentType 统一使用 router/types 定义
 * 完整类型：query | action | organize | analyze | learn | create | refine | chitchat
 */
export const INTENT_DISPLAY_NAMES: Record<IntentType, string> = {
  query: "搜索查询",
  action: "数据操作",
  organize: "整理归类",
  analyze: "数据分析",
  learn: "知识学习",
  create: "内容创作",
  refine: "结果筛选",
  chitchat: "闲聊问答",
};

// =============================================================================
// 组件 Props 类型
// =============================================================================

/**
 * CorrectionDetectedToast Props
 */
export interface CorrectionDetectedToastProps {
  /** 检测到的纠正信息 */
  detection: CorrectionDetection;
  /** 用户确认纠正 */
  onConfirm: () => void;
  /** 用户取消/忽略 */
  onCancel: () => void;
  /** 是否显示 */
  isVisible: boolean;
  /** 自动消失时间（毫秒），0 表示不自动消失 */
  autoHideDuration?: number;
}

/**
 * LearningConfirmation Props
 */
export interface LearningConfirmationProps {
  /** 学习的纠正类型 */
  wrongIntent: IntentType;
  correctIntent: IntentType;
  /** 是否显示 */
  isVisible: boolean;
  /** 自动消失时间（毫秒） */
  autoHideDuration?: number;
  /** 消失回调 */
  onDismiss?: () => void;
}

/**
 * WrongIntentButton Props
 */
export interface WrongIntentButtonProps {
  /** 当前消息的意图 */
  currentIntent: IntentType;
  /** 消息 ID */
  messageId: string;
  /** 点击回调 */
  onClick: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 额外样式 */
  className?: string;
}

/**
 * 纠正意图选择器 Props
 */
export interface IntentCorrectionSelectorProps {
  /** 错误的意图 */
  wrongIntent: IntentType;
  /** 选择正确意图的回调 */
  onSelectCorrectIntent: (intent: IntentType) => void;
  /** 关闭回调 */
  onClose: () => void;
  /** 是否显示 */
  isOpen: boolean;
}

// =============================================================================
// 学习状态类型
// =============================================================================

/**
 * 学习反馈状态
 */
export interface LearningFeedbackState {
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 最近的学习记录 */
  lastLearning?: {
    wrongIntent: IntentType;
    correctIntent: IntentType;
    timestamp: Date;
  };
  /** 错误信息 */
  error?: string;
}
