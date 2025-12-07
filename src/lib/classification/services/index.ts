/**
 * Service layer exports
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
