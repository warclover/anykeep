/**
 * 智能分类 v5.0 - ClassificationPipeline 模块导出
 * v5.1: 新增 AI 标签匹配系统
 */

export { ClassificationPipelineService } from "./classification-pipeline.service";
export type { ClassificationResult } from "./classification-pipeline.service";

export { HybridRetriever } from "./hybrid-retriever";
export type { HybridRetrieverConfig } from "./hybrid-retriever";

export { LLMCaller } from "./llm-caller";
export type { LLMCallerConfig } from "./llm-caller";

export { L0RuleMatcher } from "./l0-rule-matcher";

export { T0Generator } from "./t0-generator";

export { T1Corrector } from "./t1-corrector";

// v5.1 新增：AI 标签匹配系统
export { AiTagMatcher } from "./ai-tag-matcher";
export { FolderTagProfilerService } from "./folder-tag-profiler.service";
export { TagSynonymMapper, tagSynonymMapper } from "./tag-synonym-mapper";
export {
  TagMatchMetrics,
  tagMatchMetrics,
  type MatchType,
  type MatchRecord,
  type MatchStats,
} from "./tag-match-metrics";

export type {
  ClassificationRequest,
  T0Result,
  T1Result,
  L0MatchResult,
  HybridRetrievalResult,
  LLMCallRequest,
  ClassificationPipelineConfig,
  // v5.1 新增类型
  FolderTagProfile,
  TagMatchResult,
  TagMatcherConfig,
} from "./types";

export { ClassificationPipelineError } from "./types";
