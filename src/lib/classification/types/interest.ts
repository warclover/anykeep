/**
 * Interest-related type definitions
 *
 * @deprecated 请从 @/lib/interest-profile 导入
 * 此文件仅为向后兼容保留
 */

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
