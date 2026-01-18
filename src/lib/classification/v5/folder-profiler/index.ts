/**
 * 智能分类 v5.0 - FolderProfiler 模块导出
 */

export { FolderProfilerService } from './folder-profiler.service';
export { AlphaCalculator } from './alpha-calculator';
export { LazyUpdater } from './lazy-updater';
export { DualSourceBuilder } from './dual-source-builder';

export type {
  FolderProfile,
  FolderStats,
  DualSourceVectors,
  LazyUpdateTrigger,
  FolderProfilerConfig,
} from './types';

export type {
  BookmarkData,
  BehaviorData,
} from './dual-source-builder';

export { FolderProfilerError } from './types';
