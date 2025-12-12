/**
 * AI Summary Prompts
 *
 * Prompt 模板统一导出
 *
 * 当前阶段（P0）：重导出现有 Prompt
 * 未来阶段：逐步迁移到本模块
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

// Re-export from existing classification prompts
export {
  // V1 Prompts (纯文本)
  getPromptConfig,
  buildTypeSpecificPrompt,
  // V2 Prompts (JSON 结构化)
  getPromptConfigV2,
  buildTypeSpecificPromptV2,
} from "@/lib/classification/prompts";

// Re-export prompt types
export type {
  TypePromptConfig as PromptConfig,
  TypePromptConfigV2,
  SummaryLengthConfig,
} from "@/lib/classification/prompts";

// ============================================================================
// Prompt Constants
// ============================================================================

/**
 * Prompt 版本
 */
export const PROMPT_VERSIONS = {
  V1: "v1", // 纯文本输出
  V2: "v2", // JSON 结构化输出
} as const;

export type PromptVersion =
  (typeof PROMPT_VERSIONS)[keyof typeof PROMPT_VERSIONS];

/**
 * 默认 Prompt 版本
 */
export const DEFAULT_PROMPT_VERSION: PromptVersion = PROMPT_VERSIONS.V2;

/**
 * 内容类型对应的温度参数
 */
export const CONTENT_TYPE_TEMPERATURE: Record<string, number> = {
  article: 0.7, // 文章：适度创造性
  tutorial: 0.3, // 教程：精确性优先
  video: 0.5, // 视频：平衡
  tool: 0.3, // 工具：精确性优先
};

/**
 * 内容类型对应的最大 Token 数
 */
export const CONTENT_TYPE_MAX_TOKENS: Record<string, number> = {
  article: 2000,
  tutorial: 2500,
  video: 1500,
  tool: 1500,
};

// ============================================================================
// Future: Custom Prompt Builders
// ============================================================================

// TODO: P1 - 实现本模块专用的 Prompt 构建器
// export { buildArticlePrompt } from './article.prompt';
// export { buildTutorialPrompt } from './tutorial.prompt';
// export { buildVideoPrompt } from './video.prompt';
// export { buildToolPrompt } from './tool.prompt';
