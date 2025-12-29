/**
 * Brain-Sync 数据库类型定义
 *
 * 这些类型与 Supabase 数据库表结构对应
 * 注意：当 Supabase 类型重新生成后，这些类型可能需要同步更新
 *
 * @module types/brain-sync
 * @version 1.0.0
 * @since 2025-12-29
 */

/**
 * Flashcard 记录类型
 */
export interface FlashcardRow {
  id: number;
  user_id: string;
  bookmark_id: number;
  question: string;
  answer: string;
  source_paragraph: string | null;
  status: "pending" | "learning" | "mastered";
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string | null;
  last_reviewed_at: string | null;
  difficulty: "easy" | "medium" | "hard";
  created_at: string;
  updated_at: string;
}

/**
 * Flashcard 插入类型
 */
export interface FlashcardInsert {
  user_id: string;
  bookmark_id: number;
  question: string;
  answer: string;
  source_paragraph?: string | null;
  status?: "pending" | "learning" | "mastered";
  ease_factor?: number;
  interval_days?: number;
  repetitions?: number;
  next_review_at?: string | null;
  difficulty?: "easy" | "medium" | "hard";
}

/**
 * 复习会话记录类型
 */
export interface ReviewSessionRow {
  id: number;
  user_id: string;
  flashcard_id: number;
  response: "mastered" | "fuzzy" | "forgotten";
  response_time_ms: number | null;
  prev_interval: number;
  new_interval: number;
  prev_ease: number;
  new_ease: number;
  session_type: "scheduled" | "manual" | "chat";
  created_at: string;
}

/**
 * 复习偏好设置类型
 */
export interface ReviewPreferencesRow {
  user_id: string;
  enabled: boolean;
  preferred_day: string;
  preferred_time: string;
  timezone: string;
  weekly_limit: number;
  included_folder_ids: number[] | null;
  excluded_folder_ids: number[] | null;
  notification_channel: "sidebar" | "push" | "both" | "none";
  created_at: string;
  updated_at: string;
}

/**
 * 每周复习队列类型
 */
export interface WeeklyReviewQueueRow {
  id: number;
  user_id: string;
  week_start: string;
  flashcard_ids: number[];
  completed_ids: number[];
  total_count: number | null;
  completed_count: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * get_pending_flashcards RPC 返回类型
 * 注意：与 supabase.ts 中的类型定义保持同步
 */
export interface PendingFlashcardRow {
  id: number; // flashcard ID
  bookmark_id: number;
  bookmark_title: string;
  bookmark_url: string;
  question: string;
  answer: string;
  source_paragraph: string | null;
  status: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string | null;
}

/**
 * get_review_stats RPC 返回类型
 */
export interface ReviewStatsResult {
  success: boolean;
  total_flashcards: number;
  mastered_count: number;
  learning_count: number;
  pending_count: number;
  mastered_rate: number;
  sessions_in_period: number;
  mastered_sessions: number;
  fuzzy_sessions: number;
  forgotten_sessions: number;
  avg_response_time_ms: number | null;
  time_range: string;
  streak_days: number;
}

/**
 * update_flashcard_review RPC 返回类型
 */
export interface UpdateFlashcardReviewResult {
  success: boolean;
  new_status?: string;
  next_review_at?: string | null;
  previous_interval?: number;
  new_interval?: number;
  error?: string;
  message?: string;
}

/**
 * batch_create_flashcards RPC 返回类型
 */
export interface BatchCreateFlashcardsResult {
  success: boolean;
  inserted_count?: number;
  next_review_at?: string;
  error?: string;
}

/**
 * Flashcard 与 Bookmark 的联合查询结果
 */
export interface FlashcardWithBookmark extends FlashcardRow {
  bookmarks: {
    id: number;
    title: string;
    url: string;
  };
}

/**
 * API 响应格式化后的 Flashcard
 */
export interface FormattedFlashcard {
  id: number;
  bookmarkId: number;
  bookmarkTitle: string;
  bookmarkUrl: string;
  question: string;
  answer: string;
  sourceParagraph: string | null;
  status: string;
  difficulty: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
}

/**
 * API 响应格式化后的偏好设置
 */
export interface FormattedPreferences {
  enabled: boolean;
  preferredDay: string;
  preferredTime: string;
  timezone: string;
  weeklyLimit: number;
  includedFolderIds: number[];
  excludedFolderIds: number[];
  notificationChannel: string;
}
