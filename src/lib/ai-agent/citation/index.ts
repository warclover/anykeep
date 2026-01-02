/**
 * 引用追踪模块入口
 *
 * 导出引用追踪相关的类型、服务和工具函数
 *
 * @module ai-agent/citation
 * @version 1.0.0
 */

// 类型导出
export type {
  Citation,
  CitationIndex,
  SearchResultItem,
  CitationAnnotationResult,
  OrdinalPattern,
  CitationRenderOptions,
  CitationRenderResult,
  CitationEnricherConfig,
  CitationEnrichResult,
  CitationChunkData,
} from "./types";

// 常量和工具函数导出
export {
  CHINESE_ORDINAL_MAP,
  DEFAULT_CITATION_CONFIG,
  createCitationIndex,
  createCitationConfig,
  searchResultToCitation,
} from "./types";

// 引用索引器导出
export {
  CitationIndexer,
  getCitationIndexer,
  resetCitationIndexer,
} from "./citation-indexer";

// 引用标注器导出
export { CitationAnnotator, getCitationAnnotator } from "./citation-annotator";

// 引用渲染器导出
export { CitationRenderer, getCitationRenderer } from "./citation-renderer";

// 引用增强器导出
export {
  CitationEnricher,
  getCitationEnricher,
  resetCitationEnricher,
} from "./citation-enricher";

// Knowledge Studio 引用适配器导出
export {
  toKSCitation,
  toAgentCitation,
  toKSCitations,
  toAgentCitations,
  formatCitationAsFootnote,
  generateReferencesSection,
  extractUsedCitationIndices,
  validateCitations,
  mergeCitations,
} from "./ks-citation-adapter";
