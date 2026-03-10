/**
 * 分类提示词桥接模块
 *
 * @deprecated 过渡模块，后续将内联化
 */
export {
  getPromptConfig,
  buildTypeSpecificPrompt,
  getPromptConfigV2,
  buildTypeSpecificPromptV2,
} from "@/lib/classification/prompts";

export type {
  TypePromptConfig,
  TypePromptConfigV2,
  SummaryLengthConfig,
} from "@/lib/classification/prompts";
