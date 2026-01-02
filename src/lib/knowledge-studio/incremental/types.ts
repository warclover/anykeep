/**
 * Knowledge Studio - 增量更新类型定义
 * @module knowledge-studio/incremental
 * @description Phase 3 存根 - 书签变更后局部重新生成
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 *
 * TODO Phase 3: 完整实现
 * - 变更检测
 * - 差异分析
 * - 局部重生成
 * - 版本合并
 */

// ============================================================================
// 变更类型
// ============================================================================

/**
 * 变更类型
 */
export type ChangeType =
  | "added" // 新增书签
  | "removed" // 删除书签
  | "modified" // 修改书签内容
  | "reordered"; // 重新排序

/**
 * 影响级别
 */
export type ImpactLevel =
  | "none" // 无影响
  | "minor" // 轻微影响（局部更新）
  | "moderate" // 中等影响（部分重生成）
  | "major"; // 重大影响（需完全重生成）

// ============================================================================
// 变更记录
// ============================================================================

/**
 * 书签变更记录
 */
export interface BookmarkChange {
  /** 书签 ID */
  bookmarkId: string;
  /** 变更类型 */
  type: ChangeType;
  /** 变更时间 */
  timestamp: Date;
  /** 变更前内容（修改类型） */
  beforeContent?: string;
  /** 变更后内容（修改类型） */
  afterContent?: string;
  /** 旧位置（重排序类型） */
  oldIndex?: number;
  /** 新位置（重排序类型） */
  newIndex?: number;
}

/**
 * 报告变更集
 */
export interface ReportChangeSet {
  /** 变更集 ID */
  id: string;
  /** 报告 ID */
  reportId: string;
  /** 书签变更列表 */
  changes: BookmarkChange[];
  /** 创建时间 */
  createdAt: Date;
  /** 影响级别 */
  impactLevel: ImpactLevel;
  /** 是否已处理 */
  processed: boolean;
  /** 处理时间 */
  processedAt?: Date;
}

// ============================================================================
// 影响分析
// ============================================================================

/**
 * 段落影响分析
 */
export interface ParagraphImpact {
  /** 段落索引 */
  paragraphIndex: number;
  /** 段落内容摘要 */
  contentPreview: string;
  /** 影响级别 */
  impactLevel: ImpactLevel;
  /** 关联的变更书签 ID */
  affectedBookmarkIds: string[];
  /** 建议操作 */
  suggestedAction: "keep" | "update" | "regenerate" | "remove";
}

/**
 * 报告影响分析结果
 */
export interface ReportImpactAnalysis {
  /** 报告 ID */
  reportId: string;
  /** 变更集 ID */
  changeSetId: string;
  /** 总体影响级别 */
  overallImpact: ImpactLevel;
  /** 段落影响详情 */
  paragraphImpacts: ParagraphImpact[];
  /** 需要更新的段落数 */
  paragraphsToUpdate: number;
  /** 需要重生成的段落数 */
  paragraphsToRegenerate: number;
  /** 预估处理时间（秒） */
  estimatedProcessingTime: number;
  /** 预估 Token 消耗 */
  estimatedTokens: number;
}

// ============================================================================
// 增量更新
// ============================================================================

/**
 * 增量更新配置
 */
export interface IncrementalUpdateConfig {
  /** 是否自动检测变更 */
  autoDetect: boolean;
  /** 自动更新阈值（影响级别） */
  autoUpdateThreshold: ImpactLevel;
  /** 是否保留历史版本 */
  keepHistory: boolean;
  /** 最大历史版本数 */
  maxHistoryVersions: number;
  /** 变更检测间隔（分钟） */
  detectionIntervalMinutes: number;
}

/**
 * 增量更新任务
 */
export interface IncrementalUpdateTask {
  /** 任务 ID */
  id: string;
  /** 报告 ID */
  reportId: string;
  /** 变更集 ID */
  changeSetId: string;
  /** 影响分析 */
  impactAnalysis: ReportImpactAnalysis;
  /** 任务状态 */
  status: "pending" | "processing" | "completed" | "failed";
  /** 创建时间 */
  createdAt: Date;
  /** 开始时间 */
  startedAt?: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 错误信息 */
  error?: string;
  /** 更新后的报告版本 */
  newVersion?: number;
}

/**
 * 更新结果
 */
export interface UpdateResult {
  /** 是否成功 */
  success: boolean;
  /** 报告 ID */
  reportId: string;
  /** 新版本号 */
  newVersion: number;
  /** 更新的段落数 */
  paragraphsUpdated: number;
  /** 重生成的段落数 */
  paragraphsRegenerated: number;
  /** 处理时间（毫秒） */
  processingTimeMs: number;
  /** Token 消耗 */
  tokensUsed: number;
  /** 变更摘要 */
  changeSummary: string;
}

// ============================================================================
// 服务接口 (Phase 3 存根)
// ============================================================================

/**
 * 变更检测服务接口
 * @stub Phase 3 实现
 */
export interface IChangeDetector {
  /** 检测报告的书签变更 */
  detectChanges(reportId: string): Promise<ReportChangeSet | null>;
  /** 分析变更影响 */
  analyzeImpact(changeSet: ReportChangeSet): Promise<ReportImpactAnalysis>;
  /** 获取待处理变更 */
  getPendingChanges(userId: string): Promise<ReportChangeSet[]>;
  /** 标记变更已处理 */
  markProcessed(changeSetId: string): Promise<void>;
}

/**
 * 增量更新服务接口
 * @stub Phase 3 实现
 */
export interface IIncrementalUpdater {
  /** 创建更新任务 */
  createTask(
    reportId: string,
    changeSetId: string,
  ): Promise<IncrementalUpdateTask>;
  /** 执行更新任务 */
  executeTask(taskId: string): Promise<UpdateResult>;
  /** 获取任务状态 */
  getTaskStatus(taskId: string): Promise<IncrementalUpdateTask | null>;
  /** 取消更新任务 */
  cancelTask(taskId: string): Promise<void>;
  /** 获取报告更新历史 */
  getUpdateHistory(reportId: string): Promise<UpdateResult[]>;
  /** 回滚到指定版本 */
  rollback(reportId: string, version: number): Promise<UpdateResult>;
}
