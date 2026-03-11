/**
 * 分类提示词模块
 *
 * V1 (纯文本) 从 @/lib/summary/prompts/summary-prompts 导入
 * V2 (JSON 结构化) 本地实现
 */

// V1 Prompts (纯文本) - 不导出 SummaryLengthConfig 以避免与 V2 重复
export {
  type TypePromptConfig,
  getPromptConfig,
  buildTypeSpecificPrompt,
} from "@/lib/summary/prompts/summary-prompts";

// V2 Prompts (JSON 结构化) - SummaryLengthConfig 由 V2 提供
export {
  type TypePromptConfigV2,
  type SummaryLengthConfig,
  getPromptConfigV2,
  buildTypeSpecificPromptV2,
} from "./summary-prompts-v2";
