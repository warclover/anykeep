/**
 * 搜索历史服务
 *
 * 功能：
 * - 记录用户搜索历史
 * - 获取最近搜索
 * - 获取热门关键词
 * - 记录搜索点击
 *
 * @version 1.0.0
 * @since 2026-01-07
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { logger } from "@/lib/logger";

// ============================================
// 类型定义
// ============================================

/**
 * 搜索历史记录
 */
export interface SearchHistoryRecord {
  id: string;
  query: string;
  keywords: string[];
  resultCount: number;
  clickedBookmarkIds: number[];
  platformFilter?: string;
  timeFilter?: string;
  createdAt: Date;
}

/**
 * 创建搜索历史参数
 */
export interface CreateSearchHistoryParams {
  query: string;
  keywords: string[];
  resultCount: number;
  platformFilter?: string;
  timeFilter?: string;
}

/**
 * 热门关键词
 */
export interface HotKeyword {
  keyword: string;
  count: number;
}

/**
 * 最近搜索
 */
export interface RecentSearch {
  id: string;
  query: string;
  resultCount: number;
  createdAt: Date;
}

// ============================================
// 搜索历史服务类
// ============================================

export class SearchHistoryService {
  constructor(
    private supabase: SupabaseClient<Database>,
    private userId: string,
  ) {}

  /**
   * 记录搜索历史
   */
  async recordSearch(
    params: CreateSearchHistoryParams,
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from("search_history")
        .insert({
          user_id: this.userId,
          query: params.query,
          keywords: params.keywords,
          result_count: params.resultCount,
          platform_filter: params.platformFilter,
          time_filter: params.timeFilter,
        })
        .select("id")
        .single();

      if (error) {
        logger.error({ error, params }, "[SearchHistory] 记录搜索失败");
        return null;
      }

      return data?.id || null;
    } catch (error) {
      logger.error({ error }, "[SearchHistory] 记录搜索异常");
      return null;
    }
  }

  /**
   * 获取最近搜索（去重）
   */
  async getRecentSearches(limit: number = 10): Promise<RecentSearch[]> {
    try {
      const { data, error } = await this.supabase.rpc("get_recent_searches", {
        p_user_id: this.userId,
        p_limit: limit,
      });

      if (error) {
        logger.error({ error }, "[SearchHistory] 获取最近搜索失败");
        return [];
      }

      return (data || []).map((item) => ({
        id: item.id,
        query: item.query,
        resultCount: item.result_count,
        createdAt: new Date(item.created_at),
      }));
    } catch (error) {
      logger.error({ error }, "[SearchHistory] 获取最近搜索异常");
      return [];
    }
  }

  /**
   * 获取用户热门关键词
   */
  async getHotKeywords(
    limit: number = 10,
    days: number = 30,
  ): Promise<HotKeyword[]> {
    try {
      const { data, error } = await this.supabase.rpc("get_user_hot_keywords", {
        p_user_id: this.userId,
        p_limit: limit,
        p_days: days,
      });

      if (error) {
        logger.error({ error }, "[SearchHistory] 获取热门关键词失败");
        return [];
      }

      return (data || []).map((item) => ({
        keyword: item.keyword,
        count: Number(item.count),
      }));
    } catch (error) {
      logger.error({ error }, "[SearchHistory] 获取热门关键词异常");
      return [];
    }
  }

  /**
   * 记录搜索结果点击
   */
  async recordClick(searchId: string, bookmarkId: number): Promise<boolean> {
    try {
      const { error } = await this.supabase.rpc("record_search_click", {
        p_search_id: searchId,
        p_bookmark_id: bookmarkId,
      });

      if (error) {
        logger.error(
          { error, searchId, bookmarkId },
          "[SearchHistory] 记录点击失败",
        );
        return false;
      }

      return true;
    } catch (error) {
      logger.error({ error }, "[SearchHistory] 记录点击异常");
      return false;
    }
  }

  /**
   * 删除搜索历史（单条）
   */
  async deleteSearch(searchId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("search_history")
        .delete()
        .eq("id", searchId)
        .eq("user_id", this.userId);

      if (error) {
        logger.error({ error, searchId }, "[SearchHistory] 删除搜索失败");
        return false;
      }

      return true;
    } catch (error) {
      logger.error({ error }, "[SearchHistory] 删除搜索异常");
      return false;
    }
  }

  /**
   * 清空搜索历史
   */
  async clearHistory(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from("search_history")
        .delete()
        .eq("user_id", this.userId);

      if (error) {
        logger.error({ error }, "[SearchHistory] 清空历史失败");
        return false;
      }

      return true;
    } catch (error) {
      logger.error({ error }, "[SearchHistory] 清空历史异常");
      return false;
    }
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建搜索历史服务实例
 */
export function createSearchHistoryService(
  supabase: SupabaseClient<Database>,
  userId: string,
): SearchHistoryService {
  return new SearchHistoryService(supabase, userId);
}
