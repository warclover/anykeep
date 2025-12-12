/**
 * AI Summary Services
 *
 * 服务层统一导出
 *
 * @version 2.0.0
 * @since 2025-12-12
 */

// Interfaces
export type {
  ISummaryService,
  IContentFetcherService,
  IQualityTrackerService,
  FetchedContent,
  ContentTypeInput,
  ContentTypeOutput,
  QualityLogInput,
  QualityStatsOutput,
} from "./summary.service.interface";

// Concrete Implementations
export {
  SummaryService,
  getSummaryService,
  resetSummaryService,
} from "./summary.service";

// P5: Quality Tracker Service
export {
  QualityTrackerService,
  getQualityTrackerService,
  resetQualityTrackerService,
} from "./quality-tracker.service";

// TODO: P6+ - 实现其他服务
// export { ContentFetcherService } from './content-fetcher.service';
