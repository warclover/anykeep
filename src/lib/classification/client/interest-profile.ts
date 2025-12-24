/**
 * Interest Profile Client
 *
 * @deprecated 请从 @/lib/interest-profile 导入
 * 此文件仅为向后兼容保留
 */

export type { ProfileStats } from "@/lib/interest-profile";

export {
  getInterestProfile,
  initializeInterestProfile,
  updateManualDescription,
  analyzeImportedBookmarks,
  learnFromBehavior,
  updateStage,
  shouldTriggerAnalysis,
} from "@/lib/interest-profile";
