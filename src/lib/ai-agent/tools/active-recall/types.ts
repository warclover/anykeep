/**
 * Brain-Sync Active Recall Tools 类型定义
 *
 * @module tools/active-recall/types
 * @version 1.0.0
 * @since 2025-12-29
 */

import type {
  FlashcardStatus,
  FlashcardDifficulty,
  ReviewResponse,
  PreferredDay,
  NotificationChannel,
} from "@/lib/ai-skills/shared/review/types";

// ============================================
// generate_flashcards Tool 类型
// ============================================

export interface GenerateFlashcardsParams {
  bookmark_id: number;
  count?: number;
  difficulty?: FlashcardDifficulty;
}

export interface GeneratedFlashcardResult {
  id: number;
  question: string;
  answer: string;
  sourceParagraph?: string;
  difficulty: FlashcardDifficulty;
}

export interface GenerateFlashcardsResult {
  success: boolean;
  bookmarkId: number;
  bookmarkTitle: string;
  flashcards: GeneratedFlashcardResult[];
  message: string;
}

// ============================================
// get_review_queue Tool 类型
// ============================================

export interface GetReviewQueueParams {
  limit?: number;
  include_overdue?: boolean;
  include_due_this_week?: boolean;
  include_upcoming?: boolean;
}

export interface ReviewQueueItemResult {
  flashcardId: number;
  bookmarkId: number;
  bookmarkTitle: string;
  question: string;
  answer: string;
  status: FlashcardStatus;
  daysOverdue: number;
  priorityScore: number;
  nextReviewAt: string | null;
}

export interface GetReviewQueueResult {
  items: ReviewQueueItemResult[];
  totalCount: number;
  overdueCount: number;
  dueThisWeekCount: number;
  message: string;
}

// ============================================
// submit_review_response Tool 类型
// ============================================

export interface SubmitReviewResponseParams {
  flashcard_id: number;
  response: ReviewResponse;
  response_time_ms?: number;
}

export interface SubmitReviewResponseResult {
  success: boolean;
  flashcardId: number;
  previousInterval: number;
  newInterval: number;
  nextReviewAt: string;
  message: string;
}

// ============================================
// get_mastery_stats Tool 类型
// ============================================

export interface GetMasteryStatsParams {
  time_range?: "week" | "month" | "all";
}

export interface GetMasteryStatsResult {
  totalFlashcards: number;
  masteredCount: number;
  learningCount: number;
  pendingCount: number;
  masteredRate: number;
  sessionsInPeriod: number;
  masteredSessions: number;
  fuzzySessions: number;
  forgottenSessions: number;
  avgResponseTimeMs?: number;
  streakDays: number;
  message: string;
}

// ============================================
// update_review_preferences Tool 类型
// ============================================

export interface UpdateReviewPreferencesParams {
  enabled?: boolean;
  preferred_day?: PreferredDay;
  preferred_time?: string;
  weekly_limit?: number;
  notification_channel?: NotificationChannel;
}

export interface UpdateReviewPreferencesResult {
  success: boolean;
  preferences: {
    enabled: boolean;
    preferredDay: PreferredDay;
    preferredTime: string;
    weeklyLimit: number;
    notificationChannel: NotificationChannel;
  };
  message: string;
}
