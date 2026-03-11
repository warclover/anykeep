/**
 * 兴趣服务 — 独立模块
 *
 * 包含：
 * - InterestService / createInterestService — 兴趣管理（本模块）
 * - InterestProfileService — 兴趣画像（@/lib/interest-profile）
 * - 预设兴趣域常量（@/lib/user-interest/interest-domains）
 * - CUSTOM_INTEREST_LIMITS — 自定义兴趣限制（本模块）
 *
 * @module interests
 * @version 2.0.0 — 脱离 classification-v1 归档依赖
 * @since 2026-03-11
 */

// 兴趣服务 — 本模块实现
export { createInterestService } from "./interest-factory";
export { InterestService } from "./interest.service";
export type { IInterestService } from "./interest.service";

// 兴趣相关常量 — 本模块
export { CUSTOM_INTEREST_LIMITS, INITIAL_FOLDER_LIMITS } from "./constants";

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
