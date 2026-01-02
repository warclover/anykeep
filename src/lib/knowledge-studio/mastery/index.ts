/**
 * Knowledge Studio - 内化率追踪模块
 * @module knowledge-studio/mastery
 * @description Phase 3 存根 - Brain-Sync 学习效果统计
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 */

// 类型导出
export type {
  // 掌握度类型
  MasteryLevel,
  LearningStatus,
  // 知识点
  KnowledgePoint,
  KnowledgePointMastery,
  // 学习记录
  LearningSession,
  ReviewRecord,
  // 统计
  ReportMasteryStats,
  UserMasteryStats,
  LearningTimeline,
  // 服务接口
  IKnowledgeExtractor,
  IMasteryTracker,
} from "./types";

// 服务导出
export { MasteryTrackerStub, createMasteryTracker } from "./mastery-tracker";
export {
  KnowledgeExtractorStub,
  createKnowledgeExtractor,
} from "./knowledge-extractor";
