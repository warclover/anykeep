/**
 * Smart Sorting 类型定义和常量
 *
 * @module folder/organization/services/smart-sorting/types
 * @version 1.0.0
 * @since 2026-03-11 - Migrated from classification-v1
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// ============================================
// Supabase 客户端类型
// ============================================

export type SupabaseClientType = SupabaseClient<Database>;

// ============================================
// 待聚类书签
// ============================================

export interface PendingBookmark {
  id: number;
  title: string;
  url: string;
  ai_summary: string | null;
  ai_tags: string[] | null;
  embedding: number[];
  pending_since: string;
  cluster_id: string | null;
}

// ============================================
// 聚类结果
// ============================================

export interface Cluster {
  id: string;
  bookmarks: PendingBookmark[];
  centroid: number[];
  avgSimilarity: number;
  suggestedName: string | null;
  suggestedNameReason: string | null;
}

// ============================================
// 分拣结果
// ============================================

export interface SortingResult {
  processed: number;
  clustered: number;
  foldersCreated: number;
  suggestionsCreated: number;
  errors: string[];
}

// ============================================
// 文件夹创建建议
// ============================================

export interface FolderSuggestion {
  clusterId: string;
  suggestedName: string;
  reason: string;
  bookmarkIds: number[];
  bookmarkTitles: string[];
  confidence: number;
}

// ============================================
// 常量配置
// ============================================

/**
 * DBSCAN 聚类参数
 */
export const CLUSTERING_CONFIG = {
  /** 最小相似度阈值（余弦相似度） */
  MIN_SIMILARITY: 0.65,
  /** 最小聚类大小 */
  MIN_CLUSTER_SIZE: 3,
  /** 最大聚类大小 */
  MAX_CLUSTER_SIZE: 20,
  /** 缓存池最小等待时间（小时） */
  MIN_WAIT_HOURS: 1,
  /** 每次处理的最大书签数 */
  MAX_BATCH_SIZE: 100,
} as const;

/**
 * 每日创建限制
 */
export const DAILY_LIMIT = 6;
