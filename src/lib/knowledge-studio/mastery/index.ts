/**
 * Knowledge Studio - 内化率追踪模块
 * @module knowledge-studio/mastery
 * @description P4 实现 - Brain-Sync 学习效果统计
 * @version 1.0.0
 * @since 2026-01-02
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
export {
  MasteryTracker,
  MasteryTrackerStub, // 兼容别名
  createMasteryTracker,
} from "./mastery-tracker";

export {
  KnowledgeExtractor,
  KnowledgeExtractorStub, // 兼容别名
  createKnowledgeExtractor,
} from "./knowledge-extractor";
