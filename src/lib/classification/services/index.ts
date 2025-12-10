/**
 * Service layer exports (Client-safe)
 *
 * 此文件只导出客户端安全的服务
 * 服务器端服务请从 ./server.ts 导入
 */

export { ClassificationService } from "./classification.service";
export { UserStageService } from "./user-stage.service";
export { InterestService } from "./interest.service";
export { InterestProfileService } from "./interest-profile.service";
export { InboxOrganizerService } from "./inbox-organizer.service";
export { FolderHealthService } from "./folder-health.service";

export type {
  IClassificationService,
  IInboxOrganizerService,
  IInterestService,
  IInterestProfileService,
} from "./interfaces";
export type {
  FolderHealthStatus,
  MergeSuggestion,
  SplitSuggestion,
  FolderHealthReport,
} from "./folder-health.service";

// 注意：服务器端服务（operation-log, job-queue, embedding-ab-test）的类型和服务
// 请从 "@/lib/classification/services/server" 导入
// 这些服务依赖 next/headers，不能在客户端组件中使用
