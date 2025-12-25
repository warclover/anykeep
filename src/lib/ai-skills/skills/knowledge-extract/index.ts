/**
 * Knowledge Extract Skill - 知识萃取模块
 *
 * 从多篇收藏中提取、整合知识
 *
 * @module ai-skills/skills/knowledge-extract
 * @version 1.0.0
 */

// 类型导出
export * from "./types";

// 核心类导出
export { KnowledgeExtractor, knowledgeExtractor } from "./knowledge-extractor";
export {
  ExtractionFormatter,
  extractionFormatter,
  formatExtraction,
} from "./formatter";

// Skill 导出
export {
  KnowledgeExtractSkill,
  knowledgeExtractSkill,
} from "./knowledge-extract.skill";
