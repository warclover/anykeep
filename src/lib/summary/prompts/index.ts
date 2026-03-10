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

// Re-export from prompts bridge module
export {
  // V1 Prompts (纯文本)
  getPromptConfig,
  buildTypeSpecificPrompt,
  // V2 Prompts (JSON 结构化)
  getPromptConfigV2,
  buildTypeSpecificPromptV2,
} from "@/lib/prompts";

// Re-export prompt types
export type {
  TypePromptConfig as PromptConfig,
  TypePromptConfigV2,
  SummaryLengthConfig,
} from "@/lib/prompts";

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

// ============================================================================
// V3 Enhanced Prompts (智能浓缩 v3.0)
// ============================================================================

export {
  ENHANCED_SYSTEM_PROMPT,
  ENHANCED_SYSTEM_PROMPT_LITE,
  getEnhancedPromptConfig,
  buildEnhancedUserPrompt,
  CONTENT_TYPE_KEYWORDS,
  type EnhancedPromptConfig,
} from "./enhanced.prompt";

// ============================================================================
// V4 Prompt Engine
// ============================================================================

export { PromptEngineV4 } from "./prompt-engine-v4";

// ============================================================================
// V4 CoT 模板
// ============================================================================

export { getCotTemplate } from "./cot-templates";

// ============================================================================
// V4 负面约束
// ============================================================================

export {
  NEGATIVE_CONSTRAINTS,
  NEGATIVE_CONSTRAINTS_LITE,
} from "./negative-constraints";

// ============================================================================
// V4 Few-shot 示例库
// ============================================================================

export {
  FEW_SHOT_EXAMPLES,
  getFewShotExamples,
  type FewShotExample,
} from "./few-shot-examples";

// ============================================================================
// V4 内容类型专用 Prompt 配置
// ============================================================================

export {
  CONTENT_TYPE_CONFIGS,
  getContentTypeConfig,
  type ContentTypePromptConfig,
  type SummaryLengthRange,
} from "./content-type-configs";
