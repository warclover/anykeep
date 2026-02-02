/**
 * 批量分类系统类型定义
 *
 * @module classification/batch-classification/types
 * @version 1.0.0
 * @since 2026-02-01
 */

// ============================================
// 基础类型
// ============================================

/**
 * 带向量的书签（用于聚类）
 */
export interface BookmarkWithEmbedding {
  id: number;
  title: string;
  url: string;
  domain: string;
  meaningfulDomain: string;
  embedding: number[];
  createdAt: Date;
  originalPath: string | null;
  originalPathParts: string[] | null;
  keywords: string[];
  description: string | null;
  platform: BookmarkPlatform;
}

/**
 * 书签平台类型
 */
export type BookmarkPlatform =
  | "github"
  | "zhihu"
  | "weixin"
  | "bilibili"
  | "xiaohongshu"
  | "juejin"
  | "medium"
  | "stackoverflow"
  | "other";

// ============================================
// L1.5 预分组类型
// ============================================

/**
 * 超级节点（预分组后的聚合节点）
 */
export interface SuperNode {
  id: string;
  keyword: string;
  embedding: number[];
  memberIds: number[];
  weight: number;
  groupType: "keyword" | "domain" | "url_path";
}

/**
 * 预分组结果
 */
export interface PreGroupingResult {
  groups: Map<string, number[]>;
  ungrouped: number[];
  superNodes: SuperNode[];
  stats: {
    totalBookmarks: number;
    groupedCount: number;
    ungroupedCount: number;
    superNodeCount: number;
    estimatedVectorSavings: number;
  };
}

/**
 * 预分组配置
 */
export interface PreGroupingConfig {
  keywordGrouping: {
    enabled: boolean;
    minCount: number;
  };
  domainGrouping: {
    enabled: boolean;
    whitelist: {
      professional: {
        domains: string[];
        minCount: number;
      };
      contentPlatform: {
        domains: string[];
        minCount: number;
      };
    };
  };
  urlPathGrouping: {
    enabled: boolean;
    patterns: Array<{
      pattern: RegExp;
      minCount: number;
    }>;
  };
}

// ============================================
// 聚类类型
// ============================================

/**
 * 分层采样 DBSCAN 配置
 */
export interface SampledDbscanConfig {
  sampleRatio: number;
  minSampleSize: number;
  eps: number;
  minPts: number;
  assignmentThreshold: number;
}

/**
 * 迭代式 DBSCAN 配置
 */
export interface IterativeDbscanConfig {
  initialEps: number;
  epsStep: number;
  maxIterations: number;
  targetClusterRatio: number;
}

/**
 * ��类结果
 */
export interface ClusteringResult {
  clusters: BatchCluster[];
  noiseBookmarkIds: number[];
  stats: {
    totalPoints: number;
    clusteredPoints: number;
    noisePoints: number;
    clusterCount: number;
    avgClusterSize: number;
    executionTimeMs: number;
  };
}

/**
 * 批量聚类簇
 */
export interface BatchCluster {
  id: string;
  index: number;
  centroid: number[];
  memberIds: number[];
  cohesion: number;
  representatives: {
    core: number[];
    edge: number[];
  };
}

/**
 * 时间近邻权重配置
 */
export interface TemporalBiasConfig {
  windows: Array<{
    maxMinutes: number;
    boost: number;
  }>;
  considerSequence: boolean;
}

/**
 * 域名权重配置
 */
export interface DomainWeightConfig {
  domainCategories: {
    professional: string[];
    contentPlatform: string[];
    portal: string[];
    shortener: string[];
  };
  distanceModifiers: {
    professional: number;
    contentPlatform: number;
    portal: number;
    shortener: number;
  };
}

// ============================================
// 映射类型
// ============================================

/**
 * 文件夹匹配结果
 */
export interface FolderMatch {
  folderId: number;
  folderName: string;
  similarity: number;
  cohesion: number;
}

/**
 * 映射结��
 */
export interface MappingResult {
  clusterId: string;
  action: "MERGE" | "SUGGEST_MERGE" | "CREATE";
  targetFolderId?: number;
  suggestedName?: string;
  confidence: number;
  warning?: "target_folder_messy" | "ambiguous_match";
  conflictType: ConflictType;
}

/**
 * 冲突类型
 */
export type ConflictType =
  | "none"
  | "path_mismatch"
  | "folder_rename"
  | "ambiguous"
  | "merge_suggestion";

/**
 * 分类冲突
 */
export interface ClassificationConflict {
  bookmarkId: number;
  originalPath: string;
  suggestedPath: string;
  conflictType: ConflictType;
  confidence: number;
}

/**
 * 空洞检测配置
 */
export interface VacuumDetectionConfig {
  ambiguityThreshold: number;
  minConfidenceThreshold: number;
  minTargetCohesion: number;
}

// ============================================
// 协调器类型
// ============================================

/**
 * 批量分类阶段
 */
export type ClassificationPhase =
  | "sedimentation"
  | "clustering"
  | "mapping"
  | "completed"
  | "failed";

/**
 * 分类进度
 */
export interface ClassificationProgress {
  phase: ClassificationPhase;
  progress: number;
  estimatedRemainingSeconds: number;
  phaseDetails: {
    sedimentation: PhaseDetail;
    clustering: PhaseDetail;
    mapping: PhaseDetail;
  };
  error?: {
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * 阶段详情
 */
export interface PhaseDetail {
  status: "pending" | "in_progress" | "completed" | "failed";
  processed?: number;
  total?: number;
  clustersFound?: number;
  mapped?: number;
  created?: number;
}

/**
 * 分类结果
 */
export interface ClassificationResult {
  transactionId: string;
  clusters: ClusterResult[];
  conflicts: ClassificationConflict[];
  unclustered: number[];
  stats: {
    totalBookmarks: number;
    clusteredCount: number;
    unclusteredCount: number;
    clusterCount: number;
    conflictCount: number;
    estimatedCost: number;
  };
}

/**
 * 簇结果（用于 UI 展示）
 */
export interface ClusterResult {
  id: string;
  index: number;
  memberCount: number;
  suggestedName: string | null;
  suggestedNameConfidence: number;
  suggestedFolderId: number | null;
  suggestedFolderName: string | null;
  matchConfidence: number;
  matchType: "exact" | "fuzzy" | "create_new";
  conflictType: ConflictType;
  conflictDetails?: Record<string, unknown>;
  status: "pending" | "confirmed" | "rejected" | "modified";
  representatives: {
    core: BookmarkSummary[];
    edge: BookmarkSummary[];
  };
}

/**
 * 书签摘要（用于 UI 展示）
 */
export interface BookmarkSummary {
  id: number;
  title: string;
  url: string;
  domain: string;
}

// ============================================
// 用户决策类型
// ============================================

/**
 * 用户决策
 */
export interface UserDecision {
  clusterId: string;
  action: "accept" | "reject" | "modify";
  targetFolderId?: number;
  customName?: string;
}

/**
 * 确认模式
 */
export type ConfirmationMode = "list" | "cards" | "suggest_cards";

/**
 * 确认模式配置
 */
export interface ConfirmationModeConfig {
  suggestCardModeThreshold: number;
  forceCardModeThreshold: number;
  keepListModeThreshold: number;
}

// ============================================
// 原始结构分析类型
// ============================================

/**
 * 原始结构分析结果
 */
export interface OriginalStructureAnalysis {
  folderCount: number;
  validFolderCount: number;
  classifiedRatio: number;
  avgDepth: number;
  structureQuality: number;
  recommendedMode: StructureMode;
}

/**
 * 结构处理模式
 */
export type StructureMode = "preserve" | "hybrid" | "rebuild" | "auto";

// ============================================
// 事务类型
// ============================================

/**
 * 批量导入事务
 */
export interface BatchImportTransaction {
  id: string;
  batchId: string;
  userId: string;
  importedAt: Date;
  confirmedAt: Date | null;
  undoDeadline: Date | null;
  undoAvailable: boolean;
  status: TransactionStatus;
  structureMode: StructureMode;
  structureAnalysis: OriginalStructureAnalysis | null;
  stats: TransactionStats;
}

/**
 * 事务状态
 */
export type TransactionStatus =
  | "pending"
  | "processing"
  | "ready"
  | "confirmed"
  | "undone"
  | "expired";

/**
 * 事务统计
 */
export interface TransactionStats {
  totalBookmarks: number;
  totalClusters: number;
  autoConfirmedCount: number;
  manualConfirmedCount: number;
  rejectedCount: number;
}

// ============================================
// API 请求/响应类型
// ============================================

/**
 * 启动分类请求
 */
export interface StartClassificationRequest {
  importSessionId?: string;
  batchId?: string;
  bookmarkIds?: number[];
  structureMode?: StructureMode;
  options?: {
    autoApplyHighConfidence?: boolean;
    preserveOriginalStructure?: boolean;
  };
}

/**
 * 确认分类请求
 */
export interface ConfirmClassificationRequest {
  decisions: UserDecision[];
}

/**
 * 撤销响应
 */
export interface UndoResponse {
  success: boolean;
  restoredBookmarks: number;
  deletedFolders: number;
}
