/**
 * Summary Prompts Module
 * Exports all prompt-related functions and types
 *
 * V1: 纯文本输出（summary-prompts.ts）
 * V2: JSON 结构化输出（summary-prompts-v2.ts）
 */

// V1 - 纯文本版本（回滚兼容）
export {
  getPromptConfig,
  buildTypeSpecificPrompt,
  type SummaryLengthConfig,
  type TypePromptConfig,
} from "./summary-prompts";

// V2 - JSON 结构化版本（新功能）
export {
  getPromptConfigV2,
  buildTypeSpecificPromptV2,
  type TypePromptConfigV2,
} from "./summary-prompts-v2";
