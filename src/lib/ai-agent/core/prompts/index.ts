/**
 * KnowledgeAgent 提示语模块导出
 *
 * @module ai-agent/core/prompts
 * @version 3.0.0
 * @since 2025-12-25
 * @updated 2025-12-27 添加任务理解层 v2.0 模块
 */

// 主 System Prompt
export {
  KNOWLEDGE_AGENT_SYSTEM_PROMPT,
  KNOWLEDGE_AGENT_SYSTEM_PROMPT_V2,
  REACT_THINKING_PROMPT,
  TOOL_CALLING_CONVENTION_PROMPT,
  LEGACY_SYSTEM_PROMPT,
} from "./knowledge-agent.prompt";

// 响应模板（新增）
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
