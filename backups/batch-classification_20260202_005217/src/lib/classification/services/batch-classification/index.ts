/**
 * 批量分类模块入口
 *
 * @module classification/batch-classification
 * @version 1.0.0
 * @since 2026-02-01
 */

// ============================================
// 类型导出
// ============================================

export type {
  // 基础类型
  BookmarkWithEmbedding,
  BookmarkPlatform,
  // 预分组类型
  SuperNode,
  PreGroupingResult,
  PreGroupingConfig,
  // 聚类类型
  SampledDbscanConfig,
  IterativeDbscanConfig,
  ClusteringResult,
  BatchCluster,
  TemporalBiasConfig,
  DomainWeightConfig,
  // 映射类型
  FolderMatch,
  MappingResult,
  ConflictType,
  ClassificationConflict,
  VacuumDetectionConfig,
  // 协调器类型
  ClassificationPhase,
  ClassificationProgress,
  ClassificationResult,
  ClusterResult,
  BookmarkSummary,
  PhaseDetail,
  // 用户决策类型
  UserDecision,
  ConfirmationMode,
  ConfirmationModeConfig,
  // 原始结构类型
  OriginalStructureAnalysis,
  StructureMode,
  // 事务类型
  BatchImportTransaction,
  TransactionStatus,
  TransactionStats,
  // API 类型
  StartClassificationRequest,
  ConfirmClassificationRequest,
  UndoResponse,
} from "./types";

// ============================================
// 服务导出
// ============================================

export { BatchClassificationCoordinator, DEFAULT_COORDINATOR_CONFIG } from "./coordinator";
export type { CoordinatorConfig } from "./coordinator";

// ============================================
// 预分组服务导出
// ============================================

export { KeywordGroupingService, keywordGroupingService } from "./pre-grouping/keyword-grouping";
export { UrlPathGroupingService, urlPathGroupingService } from "./pre-grouping/url-path-grouping";

// ============================================
// 配置导出
// ============================================

export {
  DEFAULT_PRE_GROUPING_CONFIG,
  DEFAULT_DOMAIN_WEIGHT_CONFIG,
  PROFESSIONAL_DOMAINS,
  CONTENT_PLATFORM_DOMAINS,
  PORTAL_DOMAINS,
  SHORTENER_DOMAINS,
  getDomainCategory,
  getDomainDistanceModifier,
  extractMeaningfulDomain,
  isProfessionalDomain,
  isContentPlatform,
  isShortenerDomain,
} from "./config/domain-whitelist";

// ============================================
// 算法导出
// ============================================

export {
  sampledDbscanClustering,
  DEFAULT_SAMPLED_DBSCAN_CONFIG,
} from "./algorithms/sampled-dbscan";

export {
  iterativeDbscanClustering,
  DEFAULT_ITERATIVE_DBSCAN_CONFIG,
} from "./algorithms/iterative-dbscan";

export {
  computeAdjustedDistance,
  computeAdjustedSimilarity,
  computePathSimilarity,
  computeAdjustedDistanceMatrix,
  getDomainWeightInfo,
} from "./algorithms/domain-weighting";

export {
  computeTemporalBoost,
  computeTemporalAdjustedSimilarity,
  computeTemporalAdjustedDistance,
  detectTemporalClusters,
  getTemporalClusterStats,
  applyTemporalBiasToDistanceMatrix,
  DEFAULT_TEMPORAL_BIAS_CONFIG,
} from "./algorithms/temporal-bias";

// ============================================
// 阶段服务导出
// ============================================

export { MappingPhase, DEFAULT_MAPPING_CONFIG } from "./phases/mapping.phase";
export type { MappingConfig } from "./phases/mapping.phase";

// ============================================
// 命名服务导出
// ============================================

export {
  RepresentativeNamingService,
  representativeNamingService,
  DEFAULT_NAMING_CONFIG,
} from "./naming/representative-naming";
export type { NamingConfig } from "./naming/representative-naming";

// ============================================
// 冲突检测导出
// ============================================

export {
  VacuumDetector,
  vacuumDetector,
  DEFAULT_VACUUM_DETECTION_CONFIG,
} from "./conflict/vacuum-detector";
export type { VacuumDetectionResult, VacuumReason } from "./conflict/vacuum-detector";
