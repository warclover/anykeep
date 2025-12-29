/**
 * MD 收藏 AI 处理 - Prompts 模块导出
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

export {
  // System Prompts
  MD_SUMMARY_SYSTEM_PROMPT,
  MD_SUMMARY_SYSTEM_PROMPT_LITE,
  // Prompt Builders
  buildMdSummaryUserPrompt,
  buildChunkSummaryUserPrompt,
  buildMergeSummaryPrompt,
  // Config
  getMdPromptConfig,
  type MdPromptConfig,
  // Content Type Detection
  MD_CONTENT_TYPE_KEYWORDS,
  preDetectMdContentType,
} from "./md-summary.prompt";
