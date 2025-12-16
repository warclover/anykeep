/**
 * Classification Status Constants
 * 统一的分类状态定义
 *
 * 解决问题：
 * - 状态值在不同位置有不同的定义
 * - 状态转换无约束
 * - 前端和后端使用的状态值不一致
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

/**
 * 书签分类状态常量
 *
 * 状态流转：
 * ```
 * pending → processing → classified | suggested | inbox | failed
 *                                ↓
 *                          (用户确认)
 *                                ↓
 *                           classified
 * ```
 */
export const CLASSIFICATION_STATUS = {
  /** 待分类 - 书签刚创建，尚未开始分类 */
  PENDING: "pending",

  /** 分类中 - 正在执行分类逻辑 */
  PROCESSING: "processing",

  /** 已分类 - 高置信度自动分类完成 (≥80%) */
  CLASSIFIED: "classified",

  /** 已建议 - 中置信度，保存了建议但需用户确认 (60-79%) */
  SUGGESTED: "suggested",

  /** 待整理 - 低置信度，放入收件箱 (<60%) */
  INBOX: "inbox",

  /** 分类失败 - 分类过程出错 */
  FAILED: "failed",
} as const;

/**
 * 分类状态类型
 */
export type ClassificationStatus =
  (typeof CLASSIFICATION_STATUS)[keyof typeof CLASSIFICATION_STATUS];

/**
 * 置信度阈值配置
 */
export const CONFIDENCE_THRESHOLDS = {
  /** 自动分类阈值 - 高于此值直接分类 */
  AUTO_CLASSIFY: 80,

  /** 建议阈值 - 高于此值保存建议 */
  SUGGEST: 60,

  /** 收件箱阈值 - 低于此值放入收件箱 */
  INBOX: 0,
} as const;

/**
 * 根据置信度确定分类状态
 *
 * @param confidence - 分类置信度 (0-100)
 * @returns 对应的分类状态
 */
export function getStatusFromConfidence(
  confidence: number,
): ClassificationStatus {
  if (confidence >= CONFIDENCE_THRESHOLDS.AUTO_CLASSIFY) {
    return CLASSIFICATION_STATUS.CLASSIFIED;
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.SUGGEST) {
    return CLASSIFICATION_STATUS.SUGGESTED;
  }
  return CLASSIFICATION_STATUS.INBOX;
}

/**
 * 检查状态是否为终态
 *
 * 终态：分类流程已完成，无需进一步处理
 */
export function isTerminalStatus(status: string): boolean {
  return (
    status === CLASSIFICATION_STATUS.CLASSIFIED ||
    status === CLASSIFICATION_STATUS.FAILED
  );
}

/**
 * 检查状态是否需要用户操作
 *
 * 需要用户操作：建议状态或收件箱状态
 */
export function requiresUserAction(status: string): boolean {
  return (
    status === CLASSIFICATION_STATUS.SUGGESTED ||
    status === CLASSIFICATION_STATUS.INBOX
  );
}

/**
 * 检查状态转换是否有效
 *
 * 有效的状态转换：
 * - pending → processing
 * - processing → classified | suggested | inbox | failed
 * - suggested → classified (用户确认)
 * - inbox → classified (用户手动分类)
 *
 * @param from - 当前状态
 * @param to - 目标状态
 * @returns 是否为有效转换
 */
export function isValidStatusTransition(from: string, to: string): boolean {
  const validTransitions: Record<string, string[]> = {
    [CLASSIFICATION_STATUS.PENDING]: [CLASSIFICATION_STATUS.PROCESSING],
    [CLASSIFICATION_STATUS.PROCESSING]: [
      CLASSIFICATION_STATUS.CLASSIFIED,
      CLASSIFICATION_STATUS.SUGGESTED,
      CLASSIFICATION_STATUS.INBOX,
      CLASSIFICATION_STATUS.FAILED,
    ],
    [CLASSIFICATION_STATUS.SUGGESTED]: [CLASSIFICATION_STATUS.CLASSIFIED],
    [CLASSIFICATION_STATUS.INBOX]: [CLASSIFICATION_STATUS.CLASSIFIED],
    [CLASSIFICATION_STATUS.FAILED]: [CLASSIFICATION_STATUS.PENDING], // 允许重试
    [CLASSIFICATION_STATUS.CLASSIFIED]: [], // 终态，不允许转换
  };

  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * 获取状态的用户友好描述
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    [CLASSIFICATION_STATUS.PENDING]: "待分类",
    [CLASSIFICATION_STATUS.PROCESSING]: "分类中",
    [CLASSIFICATION_STATUS.CLASSIFIED]: "已分类",
    [CLASSIFICATION_STATUS.SUGGESTED]: "待确认",
    [CLASSIFICATION_STATUS.INBOX]: "待整理",
    [CLASSIFICATION_STATUS.FAILED]: "分类失败",
  };

  return labels[status] ?? "未知状态";
}

/**
 * 类型守卫：验证字符串是否为有效的分类状态
 */
export function isValidClassificationStatus(
  value: unknown,
): value is ClassificationStatus {
  if (typeof value !== "string") {
    return false;
  }

  return Object.values(CLASSIFICATION_STATUS).includes(
    value as ClassificationStatus,
  );
}
