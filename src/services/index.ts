/**
 * Services Export
 *
 * 服务层统一导出
 *
 * @module services
 */

// Core
export {
  BaseService,
  ServiceError,
  SERVICE_ERROR_HTTP_STATUS,
  type ServiceErrorCode,
} from "./core";

// Domain Services
export {
  BookmarkService,
  FolderService,
  IngestionService,
  SearchService,
  type IngestionResult,
  type BatchIngestionResult,
  type SearchResult,
  type SearchResultItem,
} from "./domain";

// Job Queue Services
export {
  TaskProducer,
  TaskConsumer,
  type TaskConsumerConfig,
  type JobType,
  type JobStatus,
  type JobPriority,
  type Job,
  type CreateJobRequest,
  type ClaimedJob,
  type JobProcessor,
} from "./jobs";
