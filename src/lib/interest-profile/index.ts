/**
 * Interest Profile Module
 * 用户兴趣画像模块
 *
 * @module interest-profile
 * @since 2025-12-24
 */

// ============================================================================
// 类型导出
// ============================================================================

export type {
  // 基础类型
  PresetInterestId,
  InterestCategory,
  PresetInterestDomain,
  CustomInterest,
  CustomInterestInput,
  UserInterestConfig,
  UserInterestConfigFull,
  // 扩展画像
  ExtendedUserProfile,
  UserProfileSettings,
  // Interest Profile V2
  InterestSource,
  UserStage,
  ManualSourceDetail,
  ImportedSourceDetail,
  LearnedSourceDetail,
  InterestSources,
  InterestKeyword,
  UserInterestProfile,
  InterestProfileInput,
  InterestProfileUpdateInput,
  BookmarkAnalysisResult,
  // 服务接口
  ProfileStats,
  LearnBehaviorResult,
} from "./types";

// ============================================================================
// 服务导出
// ============================================================================

export { InterestProfileService } from "./interest-profile.service";

// ============================================================================
// 客户端工具导出
// ============================================================================

export {
  getInterestProfile,
  initializeInterestProfile,
  updateManualDescription,
  analyzeImportedBookmarks,
  learnFromBehavior,
  updateStage,
  shouldTriggerAnalysis,
} from "./client";
