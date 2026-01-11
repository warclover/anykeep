/**
 * 置信度相关类型和常量定义
 *
 * 统一的置信度阈值配置
 *
 * @module @/lib/shared/types/confidence
 * @version 1.0.0
 * @since 2026-01-11
 */

// ============================================
// 置信度阈值常量
// ============================================

/**
 * 统一置信度阈值配置
 *
 * @description
 * 所有模块应使用此统一配置，避免阈值不一致
 *
 * 用户决策：高置信度阈值统一为 0.80
 */
export const CONFIDENCE_THRESHOLDS = {
  // ========== 执行策略阈值 ==========
  /** 高置信度 - 静默执行，完成后简短汇报 */
  HIGH: 0.8,
  /** 中置信度 - 执行 + 简要解释为什么这样做 */
  MEDIUM: 0.6,
  /** 低置信度阈值 - 以下请求澄清 */
  LOW: 0.6,

  // ========== 规则匹配阈值 ==========
  /** 规则高置信度阈值 */
  RULE_HIGH: 0.8,
  /** 规则低置信度阈值 - 触发 LLM 兜底 */
  RULE_LOW: 0.6,

  // ========== LLM 相关阈值 ==========
  /** LLM 兜底触发阈值 */
  LLM_FALLBACK: 0.6,

  // ========== 边界值 ==========
  /** 最小有效置信度 */
  MIN: 0.5,
  /** 最大置信度 */
  MAX: 1.0,

  // ========== 消歧阈值 ==========
  /** 消歧触发阈值（top1 和 top2 差值） */
  DISAMBIGUATION: 0.15,
} as const;

// ============================================
// 置信度级别类型
// ============================================

/**
 * 置信度级别
 */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * 根据置信度值获取级别
 */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return "high";
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return "medium";
  return "low";
}

// ============================================
// 风险级别
// ============================================

/**
 * 风险级别
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * 风险操作定义
 */
export const RISK_OPERATIONS = {
  /** 低风险：查询类操作 */
  LOW: ["list", "search", "count", "get", "read", "preview"],
  /** 中风险：修改类操作 */
  MEDIUM: ["add_tag", "move", "classify", "export"],
  /** 高风险：破坏性操作 */
  HIGH: ["delete", "remove", "batch_delete", "clear"],
} as const;

/**
 * 批量操作确认阈值
 *
 * 超过此数量的批量操作需要用户确认
 */
export const BATCH_CONFIRMATION_THRESHOLD = 50;

/**
 * 判断操作风险级别
 */
export function getOperationRiskLevel(operation: string): RiskLevel {
  const op = operation.toLowerCase();

  if (RISK_OPERATIONS.HIGH.some((r) => op.includes(r))) return "high";
  if (RISK_OPERATIONS.MEDIUM.some((r) => op.includes(r))) return "medium";
  return "low";
}

/**
 * 判断是否需要确认
 */
export function requiresConfirmation(
  operation: string,
  affectedCount: number = 1,
): boolean {
  const riskLevel = getOperationRiskLevel(operation);

  // 高风险操作始终需要确认
  if (riskLevel === "high") return true;

  // 批量操作超过阈值需要确认
  if (affectedCount > BATCH_CONFIRMATION_THRESHOLD) return true;

  return false;
}

// ============================================
// 执行策略
// ============================================

/**
 * 执行策略类型
 */
export type ExecutionStrategy = "silent" | "explain" | "clarify";

/**
 * 根据置信度获取建议的执行策略
 */
export function getSuggestedStrategy(confidence: number): ExecutionStrategy {
  const level = getConfidenceLevel(confidence);

  switch (level) {
    case "high":
      return "silent"; // 静默执行
    case "medium":
      return "explain"; // 执行+解释
    case "low":
      return "clarify"; // 请求澄清
  }
}
