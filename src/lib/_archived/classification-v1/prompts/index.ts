/**
 * Classification Prompts
 *
 * LLM Prompts 集合，包含：
 * - CoT 思维链 Prompt
 * - 命名优化 Prompt
 * - 摘要生成 Prompt
 *
 * @since 2025-12-24 (Phase 3.1 - V3 目录重组)
 * @module classification/prompts
 */

// CoT 思维链 Prompt
export * from "./cot-prompt";

// 命名优化 Prompt
export * from "./naming-prompt";

// 摘要生成 Prompts V1 (排除 SummaryLengthConfig，由 V2 提供)
export {
  type TypePromptConfig,
  getPromptConfig,
  buildTypeSpecificPrompt,
} from "./summary-prompts";

// 摘要生成 Prompts V2 (主要版本，包含 SummaryLengthConfig)
export * from "./summary-prompts-v2";
