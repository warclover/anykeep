/**
 * 智能分类 v5.0 - Gardener 模块导出
 */

export { GardenerService } from "./gardener.service";
export type { GardenerReport } from "./gardener.service";

export { ThresholdAdapter } from "./threshold-adapter";
export type { ClassificationStats } from "./threshold-adapter";

export { FolderSuggester } from "./folder-suggester";
export type { FolderStats, UserStats } from "./folder-suggester";

export { SynonymDetector } from "./synonym-detector";
export type { FolderInfo } from "./synonym-detector";

export { NamingEngine } from "./naming-engine";

export type {
  ThresholdConfig,
  ThresholdAdjustment,
  FolderHealthStatus,
  FolderIssueType,
  FolderIssue,
  FolderSuggestion,
  SynonymGroup,
  NamingSuggestion,
  GardenerConfig,
} from "./types";

export { GardenerError } from "./types";
