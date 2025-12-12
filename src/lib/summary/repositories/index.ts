/**
 * AI Summary Repositories
 *
 * 仓库层统一导出
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

// Interfaces
export type {
  ISummaryRepository,
  IQualityLogRepository,
  BookmarkSummaryData,
  BatchSummaryUpdate,
  BookmarkForSummary,
  TimeRange,
  ProviderUsageStats,
  ProviderCallStats,
  DailyUsage,
} from "./summary.repository.interface";

// P5: Quality Log Repository
export {
  QualityLogRepository,
  getQualityLogRepository,
  resetQualityLogRepository,
} from "./quality-log.repository";

// TODO: P5+ - 实现 SummaryRepository
// export { SummaryRepository } from './summary.repository';
