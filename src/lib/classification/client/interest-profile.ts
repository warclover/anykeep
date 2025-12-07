/**
 * Interest Profile Client
 * Client-side utilities for interest profile operations
 */

import type {
  UserInterestProfile,
  BookmarkAnalysisResult,
  UserStage,
} from "../types";

/**
 * Profile stats from API
 */
export interface ProfileStats {
  stage: UserStage;
  confidence: number;
  interestCount: number;
  hasManual: boolean;
  hasImported: boolean;
  hasLearned: boolean;
  importedBookmarkCount: number;
  learnedBookmarkCount: number;
}

/**
 * Get user's interest profile
 */
export async function getInterestProfile(): Promise<{
  profile: UserInterestProfile;
  stats: ProfileStats;
}> {
  const response = await fetch("/api/classification/interest-profile");

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to get interest profile");
  }

  const { data } = await response.json();
  return data;
}

/**
 * Initialize interest profile (during registration/onboarding)
 */
export async function initializeInterestProfile(
  manualDescription?: string,
): Promise<UserInterestProfile> {
  const response = await fetch("/api/classification/interest-profile", {
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
 * Update manual description
 */
export async function updateManualDescription(
  manualDescription: string,
): Promise<UserInterestProfile> {
  const response = await fetch("/api/classification/interest-profile", {
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
 * Trigger post-import analysis
 * Call this after browser bookmark import completes
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
  const response = await fetch("/api/classification/interest-profile/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ importSource, triggerStageUpdate }),
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
 * Trigger behavior learning
 */
export async function learnFromBehavior(): Promise<{
  success: boolean;
  learnedKeywords: number;
  message: string;
}> {
  const response = await fetch("/api/classification/interest-profile", {
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
 * Update user stage
 */
export async function updateStage(): Promise<UserStage> {
  const response = await fetch("/api/classification/interest-profile", {
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
 * Helper: Check if analysis should be triggered after import
 * Returns true if:
 * - User has no imported analysis yet, OR
 * - More than 24 hours since last analysis
 */
export async function shouldTriggerAnalysis(): Promise<boolean> {
  try {
    const { stats } = await getInterestProfile();
    return !stats.hasImported;
  } catch {
    // If we can't get profile, suggest triggering analysis
    return true;
  }
}
