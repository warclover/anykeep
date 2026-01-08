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
  extractFallbackTitle,
  truncateContent,
  validateMarkdownContent,
  sanitizeMarkdownContent,
  generateSnippet,
} from "./md-processor";

// 权限验证工具 - 服务端专用，请直接从 './permission-utils' 导入
// export {
//   verifyCollectionOwnership,
//   verifyHighlightOwnership,
//   type OwnershipResult,
// } from "./permission-utils";

// AI 生成文件夹管理
export {
  ensureAIGeneratedFolder,
  getAIGeneratedFolder,
} from "./ensure-ai-folder";

// Server-only exports - 请直接从 './ai-processor' 导入
// export {
//   processMdCollectionAI,
//   processMdCollectionsBatchAI,
//   triggerMdAIProcessing,
//   type MdAIProcessResult,
//   type MdAIProcessOptions,
// } from './ai-processor';
