/**
 * MD 收藏功能 - Lib 模块入口
 *
 * 注意：ai-processor 只能在服务器端使用（API routes），
 * 请直接从 './ai-processor' 导入，不要在此处导出
 */

export {
  isMdFeatureEnabled,
  getMdFeatureLimit,
  canCreateMdCollection,
  getFeatureUnavailableMessage,
  shouldShowUpgradePrompt,
} from "./feature-gate";

export {
  preprocessMarkdownForAI,
  countWords,
  computeContentHash,
  extractTitle,
  truncateContent,
  validateMarkdownContent,
  sanitizeMarkdownContent,
  generateSnippet,
} from "./md-processor";

// Server-only exports - 请直接从 './ai-processor' 导入
// export {
//   processMdCollectionAI,
//   processMdCollectionsBatchAI,
//   triggerMdAIProcessing,
//   type MdAIProcessResult,
//   type MdAIProcessOptions,
// } from './ai-processor';
