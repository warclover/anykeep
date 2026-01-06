/**
 * Feedback Collector - 反馈收集服务
 * @module knowledge-studio/iteration
 *
 * 收集用户对生成内容的反馈，用于驱动迭代优化。
 */

import { createLogger } from "@/lib/logger";
import { FEEDBACK_TYPES, type FeedbackType, type DraftFeedback } from "./types";

// ============================================================
// Logger
// ============================================================

const logger = createLogger("knowledge-studio:feedback-collector");

// ============================================================
// Feedback Collector
// ============================================================

/**
 * 验证反馈数据
 *
 * @param feedback - 反馈数据
 * @returns 验证结果
 */
export function validateFeedback(feedback: Partial<DraftFeedback>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证评分
  if (
    feedback.rating === undefined ||
    feedback.rating < 1 ||
    feedback.rating > 5
  ) {
    errors.push("评分必须在 1-5 之间");
  }

  // 验证反馈类型
  if (!feedback.type || !(feedback.type in FEEDBACK_TYPES)) {
    errors.push("请选择反馈类型");
  }

  // 如果是"其他"类型，检查是否有补充说明
  if (
    feedback.type === "other" &&
    (!feedback.comment || feedback.comment.trim().length === 0)
  ) {
    errors.push("请在补充说明中描述具体问题");
  }

  // 验证补充说明长度
  if (feedback.comment && feedback.comment.length > 500) {
    errors.push("补充说明不能超过 500 字");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 创建反馈对象
 *
 * @param rating - 评分 1-5
 * @param type - 反馈类型
 * @param comment - 补充说明（可选）
 * @returns 反馈对象
 */
export function createFeedback(
  rating: number,
  type: FeedbackType,
  comment?: string,
): DraftFeedback {
  return {
    rating,
    type,
    comment: comment?.trim() || undefined,
    timestamp: Date.now(),
  };
}

/**
 * 根据反馈类型生成迭代指令
 *
 * @param feedback - 用户反馈
 * @returns 迭代指令文本
 */
export function generateIterationInstruction(feedback: DraftFeedback): string {
  const baseInstruction = getBaseInstruction(feedback.type);
  const ratingContext = getRatingContext(feedback.rating);

  let instruction = `${ratingContext}\n\n${baseInstruction}`;

  // 如果有补充说明，添加到指令中
  if (feedback.comment) {
    instruction += `\n\n用户补充说明：${feedback.comment}`;
  }

  return instruction;
}

/**
 * 获取反馈类型的基础指令
 */
function getBaseInstruction(type: FeedbackType): string {
  switch (type) {
    case "too_long":
      return `用户认为内容太长。请：
1. 删除冗余和重复的内容
2. 合并相似的段落
3. 保留核心观点，精简表达
4. 目标是将内容精简 20-30%，同时保持完整性`;

    case "too_short":
      return `用户认为内容太短。请：
1. 扩展每个主要观点的论述
2. 添加更多的例子和解释
3. 补充相关的背景信息
4. 目标是将内容扩展 30-50%，同时保持聚焦`;

    case "off_topic":
      return `用户认为内容偏离主题。请：
1. 重新审视主题焦点
2. 删除与主题无关的内容
3. 加强主题相关的论述
4. 确保每个段落都紧扣主题`;

    case "style_issue":
      return `用户认为写作风格不符合预期。请：
1. 调整语气和表达方式
2. 统一全文的风格基调
3. 使用更符合目标平台的表达
4. 保持内容专业性的同时增强可读性`;

    case "other":
      return `用户提出了其他问题。请根据用户的补充说明进行针对性修改。`;

    default:
      return "请根据用户反馈优化内容。";
  }
}

/**
 * 根据评分生成上下文说明
 */
function getRatingContext(rating: number): string {
  if (rating >= 4) {
    return "用户对内容整体满意，但希望进行微调：";
  } else if (rating >= 3) {
    return "用户认为内容基本可用，但需要改进：";
  } else if (rating >= 2) {
    return "用户对内容不太满意，需要较大幅度修改：";
  } else {
    return "用户对内容非常不满意，需要重新生成：";
  }
}

/**
 * 获取反馈类型的显示信息
 *
 * @param type - 反馈类型
 * @returns 显示信息
 */
export function getFeedbackTypeInfo(type: FeedbackType): {
  label: string;
  icon: string;
  description: string;
} {
  return FEEDBACK_TYPES[type];
}

/**
 * 获取所有反馈类型列表
 *
 * @returns 反馈类型数组
 */
export function getAllFeedbackTypes(): Array<{
  type: FeedbackType;
  label: string;
  icon: string;
  description: string;
}> {
  return (Object.keys(FEEDBACK_TYPES) as FeedbackType[]).map((type) => ({
    type,
    ...FEEDBACK_TYPES[type],
  }));
}

/**
 * 记录反馈（用于分析和优化）
 *
 * @param feedback - 用户反馈
 * @param context - 上下文信息
 */
export function logFeedback(
  feedback: DraftFeedback,
  context: {
    blueprintId: string;
    originalWordCount: number;
    versionNumber: number;
  },
): void {
  logger.info(
    {
      rating: feedback.rating,
      type: feedback.type,
      hasComment: !!feedback.comment,
      blueprintId: context.blueprintId,
      originalWordCount: context.originalWordCount,
      versionNumber: context.versionNumber,
    },
    "User feedback recorded",
  );
}

/**
 * 判断是否应该建议使用精简功能
 *
 * @param feedback - 用户反馈
 * @returns 是否建议精简
 */
export function shouldSuggestCondense(feedback: DraftFeedback): boolean {
  return feedback.type === "too_long" && feedback.rating >= 3;
}

/**
 * 判断是否需要完全重新生成
 *
 * @param feedback - 用户反馈
 * @returns 是否需要重新生成
 */
export function shouldRegenerate(feedback: DraftFeedback): boolean {
  // 评分 1 分且是主题偏离，建议重新生成
  return feedback.rating === 1 && feedback.type === "off_topic";
}
