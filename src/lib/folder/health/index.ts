/**
 * 文件夹健康服务
 *
 * 分析文件夹质量，生成合并/拆分建议。
 *
 * @module folder/health
 * @version 2.0.0
 * @since 2026-03-11
 */

export { FolderHealthService } from "./folder-health.service";
export type {
  FolderHealthStatus,
  FolderHealthReport,
  MergeSuggestion,
  SplitSuggestion,
} from "./folder-health.service";
