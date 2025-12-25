/**
 * Folder 模块导出
 *
 * @module ai-generator/folder
 */

export {
  recommendFolder,
  generateFallbackFolderRecommendation,
} from "./folder-recommender";

export { generateFolderNameFromBookmarks } from "./folder-name-generator";

export {
  calculateSemanticSimilarity,
  extractKeyword,
  extractDominantTopic,
} from "./semantic-matcher";
