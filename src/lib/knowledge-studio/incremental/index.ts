/**
 * Knowledge Studio - 增量更新模块
 * @module knowledge-studio/incremental
 * @description Phase 3 存根 - 书签变更后局部重新生成
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
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
export { ChangeDetectorStub, createChangeDetector } from "./change-detector";
export {
  IncrementalUpdaterStub,
  createIncrementalUpdater,
} from "./incremental-updater";
