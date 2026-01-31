/**
 * Manual definition for RPC function parameters and return types
 * because they are not yet available in the generated types or need manual override.
 */

export interface BatchTagsParams {
  p_bookmark_ids: number[];
  p_tags: string[];
}

export interface BatchTagsReturn {
  affected_ids: number[];
  affected_count: number;
}

export interface WechatStatsParams {
  p_user_id: string;
}

export interface WechatStatsReturn {
  total_articles: number;
  total_images: number;
  success_images: number;
  failed_images: number;
  storage_used: number;
}

// ============================================
// Health Check System RPC Types
// ============================================

export interface GetHealthOverviewParams {
  p_user_id: string;
}

export interface GetHealthOverviewReturn {
  broken_links_count: number;
  duplicates_count: number;
  stale_count: number;
  total_issues: number;
  last_checked_at: string | null;
}

export interface GetStaleBookmarksParams {
  p_user_id: string;
  p_days_threshold?: number;
  p_limit?: number;
}

export interface GetStaleBookmarksReturn {
  bookmark_id: string;
  title: string;
  url: string;
  folder_id: string | null;
  last_accessed_at: string | null;
  created_at: string;
  days_since_access: number;
  access_count: number;
}

export interface BatchUpsertHealthCacheParams {
  p_user_id: string;
  p_items: unknown; // JSONB
}

export interface RecordBookmarkAccessParams {
  p_bookmark_id: string;
}

export interface CleanupResolvedHealthIssuesParams {
  p_user_id: string;
}
