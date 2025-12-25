/**
 * AI Skills 集合导出
 *
 * @version 1.4.0
 * @since 2025-12-22
 * @updated 2025-12-24 - 修复类型导出冲突（DuplicateGroup, TagSuggestion）
 */

// SearchSkill - 书签搜索
export * from "./search";

// ClassifySkill - 内容分类
export * from "./classify";

// SummarySkill - 内容摘要
export * from "./summary";

// KnowledgeReviewSkill - 知识复习（编排 Skill）
export * from "./knowledge-review";

// DataExportSkill - 数据导出（编排 Skill）
export * from "./data-export";

// InsightReportSkill - 洞察报告（编排 Skill）
export * from "./insight-report";

// BatchOrganizeSkill - 批量整理（编排 Skill）
// 注意：包含 DuplicateGroup 和 TagSuggestion 类型，与其他模块有冲突
// 使用别名导出避免冲突
export { BatchOrganizeSkill, batchOrganizeSkill } from "./batch-organize";
export type {
  BatchOrganizeInput,
  BatchOrganizeOutput,
  OrganizeAction,
  OrganizeScope,
  CategorizeSuggestion,
  ArchiveCandidate,
  UrlValidationResult,
  OrganizeStats,
  // 重命名冲突类型
  DuplicateGroup as BatchOrganizeDuplicateGroup,
  TagSuggestion as BatchOrganizeTagSuggestion,
} from "./batch-organize/types";
export {
  ORGANIZE_ACTION_CONFIG,
  DEFAULT_ORGANIZE_CONFIG,
} from "./batch-organize/types";

// DuplicateCleanupSkill - 重复清理（编排 Skill，Phase 2）
// 注意：包含 DuplicateGroup 类型，与 batch-organize 有冲突
export {
  DuplicateCleanupSkill,
  duplicateCleanupSkill,
} from "./duplicate-cleanup";
export type {
  DuplicateCleanupInput,
  DuplicateCleanupOutput,
  DuplicateStrategy,
  KeepStrategy,
  DuplicateBookmark,
  // 使用完整名称，这是主要的 DuplicateGroup 定义
  DuplicateGroup,
  CleanupAction,
  CleanupStats,
} from "./duplicate-cleanup/types";
export {
  DUPLICATE_CLEANUP_CONFIG,
  DEFAULT_CLEANUP_INPUT,
} from "./duplicate-cleanup/types";
export { UrlNormalizer } from "./duplicate-cleanup/url-normalizer";

// QuickDigestSkill - 快速摘要（编排 Skill，Phase 2）
export * from "./quick-digest";

// SmartTaggingSkill - 智能标签（编排 Skill，Phase 2）
// 注意：包含 TagSuggestion 类型，与 batch-organize 有冲突
export { SmartTaggingSkill, smartTaggingSkill } from "./smart-tagging";
export type {
  SmartTaggingInput,
  SmartTaggingOutput,
  TaggingScope,
  TaggingMode,
  NormalizeOptions,
  // 使用完整名称，这是主要的 TagSuggestion 定义
  TagSuggestion,
  BookmarkTagSuggestion,
  MergedTag,
  RemovedTag,
  NormalizationResult,
  TagStatistics,
  SmartTaggingStats,
} from "./smart-tagging/types";
export {
  SMART_TAGGING_CONFIG,
  DEFAULT_TAGGING_INPUT,
} from "./smart-tagging/types";

// ReadingPlannerSkill - 阅读计划（编排 Skill，Phase 2）
export * from "./reading-planner";

// RelatedDiscoverySkill - 相关发现（编排 Skill，Phase 2）
export * from "./related-discovery";

// PeriodicReportSkill - 周期报告（编排 Skill，Phase 3）
export * from "./periodic-report";

// ShareBundleSkill - 分享包（编排 Skill，Phase 3）
export * from "./share-bundle";

// LearningPathSkill - 学习路径（编排 Skill，Phase 3）
export * from "./learning-path";

// KnowledgeExtractSkill - 知识萃取（编排 Skill，Phase 3）
// 注意：包含 SourceInfo 类型，与 related-discovery 有冲突
export {
  KnowledgeExtractSkill,
  knowledgeExtractSkill,
} from "./knowledge-extract";
export {
  KnowledgeExtractor,
  knowledgeExtractor,
  ExtractionFormatter,
  extractionFormatter,
  formatExtraction,
} from "./knowledge-extract";
export type {
  ExtractionFormat,
  KnowledgeExtractInput,
  Citation,
  KeyPoint,
  ConceptDefinition,
  // 重命名冲突类型
  SourceInfo as KnowledgeExtractSourceInfo,
  ExtractionMetadata,
  KnowledgeExtraction,
  BookmarkContent,
  RawKeyPointResponse,
  RawConceptResponse,
  ExtractionStepData,
} from "./knowledge-extract/types";
