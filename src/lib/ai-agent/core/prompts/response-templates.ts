/**
 * AI 响应模板定义
 *
 * 用于约束 AI 输出格式，保持一致性
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

/**
 * 置信度级别
 */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * 风险级别
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * 置信度阈值配置
 */
export const CONFIDENCE_THRESHOLDS = {
  /** 高置信度阈值 - 静默执行 */
  HIGH: 0.85,
  /** 中置信度阈值 - 执行+说明 */
  MEDIUM: 0.6,
} as const;

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
 */
export const BATCH_CONFIRMATION_THRESHOLD = 20;

/**
 * 响应模板 - Prompt 注入部分
 *
 * 这些模板会被注入到 System Prompt 中，指导 AI 输出格式
 */
export const RESPONSE_TEMPLATES_PROMPT = `
## 响应模板

### 高置信度响应（静默执行）
\`\`\`
✅ [结果描述]
[可选：1行补充信息]
\`\`\`

### 中置信度响应（执行+说明）
\`\`\`
✅ [结果描述]
💡 我理解为 [你的理解]，如需调整可以告诉我。
\`\`\`

### 低置信度响应（轻量澄清）
\`\`\`
我理解你想 [初步理解]。请确认：
[问题]？
→ A. [推荐选项]（默认）
→ B. [备选]
\`\`\`

### 高风险操作响应
\`\`\`
⚠️ 即将 [操作描述]（影响 X 条内容）
确认执行？回复"确认"继续，或告诉我调整。
\`\`\`
`;

/**
 * 获取置信度级别
 */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) return "high";
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) return "medium";
  return "low";
}

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
