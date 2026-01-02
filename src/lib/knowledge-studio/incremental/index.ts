/**
 * Knowledge Studio - 增量更新模块
 * @module knowledge-studio/incremental
 * @description P4 实现 - 书签变更后局部重新生成
 * @version 1.0.0
 * @since 2026-01-02
 */

// 类型导出
export type {
  // 变更类型
  ChangeType,
  ImpactLevel,
  BookmarkChange,
  ReportChangeSet,
  // 影响分析
  ParagraphImpact,
  ReportImpactAnalysis,
  // 更新配置
  IncrementalUpdateConfig,
  IncrementalUpdateTask,
  UpdateResult,
  // 服务接口
  IChangeDetector,
  IIncrementalUpdater,
} from "./types";

// 服务导出
export {
  ChangeDetector,
  ChangeDetectorStub, // 兼容别名
  createChangeDetector,
} from "./change-detector";

export {
  IncrementalUpdater,
  IncrementalUpdaterStub, // 兼容别名
  createIncrementalUpdater,
} from "./incremental-updater";
