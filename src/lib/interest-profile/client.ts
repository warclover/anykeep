/**
 * Interest Profile Client
 * 客户端兴趣画像操作工具
 *
 * @module interest-profile
 * @since 2025-12-24
 */

import { API_CLASSIFICATION } from "@/lib/constants/api-paths";
import type {
  UserInterestProfile,
  BookmarkAnalysisResult,
  UserStage,
  ProfileStats,
  LearnBehaviorResult,
} from "./types";

/**
 * 获取用户兴趣画像
 */
export async function getInterestProfile(): Promise<{
  profile: UserInterestProfile;
  stats: ProfileStats;
}> {
  const response = await fetch(API_CLASSIFICATION.interestProfile);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to get interest profile");
  }

  const { data } = await response.json();
  return data;
}

/**
 * 初始化兴趣画像（注册/引导时）
 */
export async function initializeInterestProfile(
  manualDescription?: string,
): Promise<UserInterestProfile> {
  const response = await fetch(API_CLASSIFICATION.interestProfile, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manualDescription }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to initialize interest profile",
    );
  }

  const { data } = await response.json();
  return data.profile;
}

/**
 * 更新手动描述
 */
export async function updateManualDescription(
  manualDescription: string,
): Promise<UserInterestProfile> {
  const response = await fetch(API_CLASSIFICATION.interestProfile, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "update_manual",
      manualDescription,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to update manual description",
    );
  }

  const { data } = await response.json();
  return data.data.profile;
}

/**
 * 触发导入后分析
 * 浏览器书签导入完成后调用
 * 使用 PATCH /api/classification/interest-profile with action: "analyze_imported"
 */
export async function analyzeImportedBookmarks(
  importSource: string = "browser",
  triggerStageUpdate: boolean = true,
): Promise<{
  analysis: BookmarkAnalysisResult;
  profile: {
    stage: UserStage;
    confidence: number;
    interestCount: number;
    hasImported: boolean;
  };
  stageUpdated: boolean;
  newStage: UserStage | null;
}> {
  const response = await fetch(API_CLASSIFICATION.interestProfile, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "analyze_imported",
      importSource,
      triggerStageUpdate,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error?.message || "Failed to analyze imported bookmarks",
    );
  }

  const { data } = await response.json();
  return data;
}

/**
 * 触发行为学习
 */
export async function learnFromBehavior(): Promise<LearnBehaviorResult> {
  const response = await fetch(API_CLASSIFICATION.interestProfile, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "learn_behavior" }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to learn from behavior");
  }

  const { data } = await response.json();
  return data.data;
}

/**
 * 更新用户阶段
 */
export async function updateStage(): Promise<UserStage> {
  const response = await fetch(API_CLASSIFICATION.interestProfile, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update_stage" }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to update stage");
  }

  const { data } = await response.json();
  return data.data.stage;
}

/**
 * 辅助函数：检查是否需要触发分析
 * 返回 true 如果：
 * - 用户尚无导入分析，或
 * - 距上次分析超过 24 小时
 */
export async function shouldTriggerAnalysis(): Promise<boolean> {
  try {
    const { stats } = await getInterestProfile();
    return !stats.hasImported;
  } catch {
    // 无法获取画像时建议触发分析
    return true;
  }
}
