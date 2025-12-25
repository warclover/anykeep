/**
 * AI Generator 模块
 *
 * 统一的 AI 内容生成工具，支持摘要、标签和文件夹推荐
 *
 * @module ai-generator
 * @version 1.0.0 - 模块化重构
 * @since 2025-12-25
 */

// ============================================
// 类型导出
// ============================================

export type {
  AIGenerateResult,
  AIGenerateRequest,
  AIGenerateOptions,
  FolderRecommendation,
  ExistingFolder,
  GenerateFolderNameRequest,
  GenerateFolderNameResult,
  GenerateWithAIOptions,
  ContentType,
} from "./types";

// ============================================
// API 模块
// ============================================

export { generateWithAI, callDeepSeekAPI } from "./api";
export { parseAIResponse, parseAIResponseV2 } from "./api";

// ============================================
// 内容生成模块
// ============================================

export { generateAIContent } from "./content";
export { generateFallbackContent, getSummaryLimit } from "./content";

// ============================================
// 文件夹推荐模块
// ============================================

export {
  recommendFolder,
  generateFallbackFolderRecommendation,
} from "./folder";
export { generateFolderNameFromBookmarks } from "./folder";
export {
  calculateSemanticSimilarity,
  extractKeyword,
  extractDominantTopic,
} from "./folder";
