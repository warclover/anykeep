/**
 * 兴趣服务 — 桥接导出
 *
 * 实际实现位于 classification/services/interest*.ts，
 * Phase 8 迁移时将物理移入此目录。
 *
 * 预设兴趣域常量已独立于 @/lib/user-interest/interest-domains。
 * 兴趣画像类型已独立于 @/lib/interest-profile。
 *
 * @module interests
 * @version 1.0.0
 * @since 2026-03-10
 */

export { createInterestService } from "@/lib/classification/services/interest-factory";
export { InterestService } from "@/lib/classification/services/interest.service";

// 兴趣画像服务 — 从已独立的模块导出
export { InterestProfileService } from "@/lib/interest-profile";

// 预设兴趣域 — 直接从已独立的模块导出
export {
  PRESET_INTEREST_DOMAINS,
  getAllPresetInterestIds,
  getInterestsByCategory,
  getSuggestedFolders,
  getKeywordsForInterests,
} from "@/lib/user-interest/interest-domains";

// 兴趣相关常量 — 从旧分类模块桥接
export { CUSTOM_INTEREST_LIMITS } from "@/lib/classification/constants/limits";
