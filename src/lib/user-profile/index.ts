/**
 * User Profile Module
 * 用户画像统一模块
 *
 * 整合用户兴趣画像 (Interest Profile) 和来源画像 (Source Profile)，
 * 提供统一的导出入口。
 *
 * @module user-profile
 * @since 2025-12-24
 */

// ============================================================================
// Interest Profile - 用户兴趣画像
// ============================================================================

export {
  // 服务
  InterestProfileService,
  // 客户端工具
  getInterestProfile,
  initializeInterestProfile,
  updateManualDescription,
  analyzeImportedBookmarks,
  learnFromBehavior,
  updateStage,
  shouldTriggerAnalysis,
} from "@/lib/interest-profile";

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
} from "@/lib/interest-profile";

// ============================================================================
// Source Profile - 来源画像
// ============================================================================

export {
  // 服务
  SourceProfileService,
  sourceProfileService,
} from "@/lib/source-profile";

export type {
  // 类型
  SourceProfile,
  SourceType,
  ContentType,
  SourceMatchResult,
  CreateSourceProfileInput,
  UpdateSourceProfileInput,
  ExtractedSourceInfo,
  SourceProfileRecord,
} from "@/types/source-profile";

export {
  // 工具函数
  extractSourceFromUrl,
  isValidSourceType,
  isValidContentType,
  // 常量
  DEFAULT_TRUST_SCORE,
  HIGH_TRUST_THRESHOLD,
  SOURCE_TYPE_INFO,
  CONTENT_TYPE_INFO,
} from "@/types/source-profile";
