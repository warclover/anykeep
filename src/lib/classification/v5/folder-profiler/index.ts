/**
 * 智能分类 v5.1 - FolderProfiler 模块导出
 */

export { FolderProfilerService } from "./folder-profiler.service";
export { AlphaCalculator } from "./alpha-calculator";
export { LazyUpdater } from "./lazy-updater";
export { DualSourceBuilder } from "./dual-source-builder";

// v5.1: 冷启动增强器
export { ColdStartEnricher } from "./cold-start-enricher";

// v5.1: 安全封装器
export { SafeEmbeddingWrapper } from "./safe-embedding-wrapper";

export type {
  FolderProfile,
  FolderStats,
  DualSourceVectors,
  LazyUpdateTrigger,
  FolderProfilerConfig,
} from "./types";

export type {
  BookmarkData,
  BehaviorData,
  // v5.1: 新增类型
  ParentContext,
  BuildOptions,
  HierarchicalWeightConfig,
  DualSourceBuilderOptions,
} from "./dual-source-builder";

// v5.1: 冷启动增强器类型
export type {
  EnrichmentResult,
  ColdStartEnricherConfig,
  CacheConfig,
} from "./cold-start-enricher";

// v5.1: 安全封装器类型
export type {
  SafeEmbeddingConfig,
  SafeEmbeddingResult,
} from "./safe-embedding-wrapper";

export { FolderProfilerError } from "./types";
