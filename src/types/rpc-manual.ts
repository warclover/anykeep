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
