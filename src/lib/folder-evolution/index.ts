/**
 * 文件夹演进服务模块
 *
 * merge/split/rename/report 服务的统一入口
 *
 * @module folder-evolution
 * @version 2.0.0 - 从 classification-v1 独立迁移
 * @since 2026-03-11
 */
export { mergeService } from "./merge.service";
export { splitService } from "./split.service";
export { renameService } from "./rename.service";
export { reportService } from "./report.service";

// Re-export types for consumer convenience
export type {
  MergeCandidate,
  MergeSuggestion,
  MergeResult,
} from "./merge.service";
export type { SplitSuggestion, SplitResult } from "./split.service";
export type { RenameSuggestion, RenameResult } from "./rename.service";
export type {
  MonthlyReport,
  ReportGenerationOptions,
  ReportSuggestion,
} from "./report.service";
