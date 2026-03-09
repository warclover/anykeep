/**
 * AI Agent 提示语模块导出
 *
 * @module ai-agent/core/prompts
 * @version 3.1.0
 * @since 2025-12-25
 * @updated 2026-03-09 移除 knowledge-agent.prompt
 */

// 响应模板
export {
  CONFIDENCE_THRESHOLDS,
  RISK_OPERATIONS,
  BATCH_CONFIRMATION_THRESHOLD,
  RESPONSE_TEMPLATES_PROMPT,
  getConfidenceLevel,
  getOperationRiskLevel,
  requiresConfirmation,
  type ConfidenceLevel,
  type RiskLevel,
} from "./response-templates";

// 隐含意图规则（新增）
export {
  IMPLICIT_INTENT_RULES,
  IMPLICIT_INTENT_RULES_PROMPT,
  matchImplicitIntent,
  matchAllImplicitIntents,
  type ImplicitIntentRule,
} from "./implicit-intent-rules";
