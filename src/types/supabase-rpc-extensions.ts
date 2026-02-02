/**
 * Supabase RPC 类型扩展
 *
 * 补充 supabase.generated.ts 中缺失的 RPC 函数类型定义
 * 这些函数在数据库迁移中存在，但未被自动类型生成工具捕获
 *
 * @module types/supabase-rpc-extensions
 * @version 1.0.0
 * @since 2026-02-02
 */

import type { Json } from "./supabase.generated";

/**
 * 缺失的 RPC 函数类型定义
 *
 * 使用方法：在调用这些 RPC 时，使用类型安全的包装函数
 */
export interface MissingRpcFunctions {
  // ============================================
  // 消息系统相关 (20251208000001_create_messages_table.sql)
  // ============================================

  /**
   * 获取未读消息数量（分等级统计）
   */
  get_unread_message_counts: {
    Args: {
      p_user_id: string;
    };
    Returns: {
      total: number;
      silent: number;
      normal: number;
      important: number;
    }[];
  };

  /**
   * 批量标记消息已读
   */
  mark_messages_read: {
    Args: {
      p_user_id: string;
      p_message_ids?: number[] | null;
    };
    Returns: number;
  };

  // ============================================
  // AI 规则学习相关 (20251230000003_add_rule_learning.sql)
  // ============================================

  /**
   * 添加 AI 自定义规则
   */
  add_ai_custom_rule: {
    Args: {
      p_user_id: string;
      p_rule: Json;
    };
    Returns: undefined;
  };

  /**
   * 删除 AI 自定义规则
   */
  remove_ai_custom_rule: {
    Args: {
      p_user_id: string;
      p_rule_id: string;
    };
    Returns: undefined;
  };

  /**
   * 记录用户纠正
   */
  record_user_correction: {
    Args: {
      p_user_id: string;
      p_original_action: Json;
      p_corrected_action: Json;
      p_context?: Json;
    };
    Returns: string; // UUID
  };

  // ============================================
  // AI 文件夹设置相关 (20251209300001_add_ai_folder_settings.sql)
  // ============================================

  /**
   * 获取 AI 文件夹设置（带默认值）
   */
  get_ai_folder_settings: {
    Args: {
      p_user_id: string;
    };
    Returns: Json;
  };

  /**
   * 更新 AI 文件夹设置
   */
  update_ai_folder_settings: {
    Args: {
      p_user_id: string;
      p_settings: Json;
    };
    Returns: Json;
  };

  // ============================================
  // 相关书签推荐 (20251209200002_add_find_related_bookmarks_rpc.sql)
  // ============================================

  /**
   * 查询与指定书签相似的其他书签
   */
  find_related_bookmarks: {
    Args: {
      p_bookmark_id: number;
      p_user_id: string;
      p_limit?: number;
      p_min_similarity?: number;
      p_exclude_same_folder?: boolean;
    };
    Returns: {
      id: number;
      title: string;
      url: string;
      description: string | null;
      similarity: number;
      folder_id: number | null;
      folder_name: string | null;
      platform: string | null;
      created_at: string;
    }[];
  };

  /**
   * 查询文件夹之间的内容连接
   */
  find_cross_folder_connections: {
    Args: {
      p_user_id: string;
      p_folder_id?: number;
      p_limit?: number;
      p_min_similarity?: number;
    };
    Returns: {
      source_folder_id: number;
      source_folder_name: string;
      target_folder_id: number;
      target_folder_name: string;
      connection_count: number;
      avg_similarity: number;
    }[];
  };

  // ============================================
  // 分类建议相关 (20251125000003_add_classification_suggestions.sql)
  // ============================================

  /**
   * 获取待处理分类建议数量
   */
  get_pending_suggestions_count: {
    Args: {
      p_user_id: string;
    };
    Returns: number;
  };

  /**
   * 获取用户聚类统计
   */
  get_user_cluster_stats: {
    Args: {
      p_user_id: string;
    };
    Returns: {
      total_clusters: number;
      pending_clusters: number;
      confirmed_clusters: number;
      avg_cluster_size: number;
    }[];
  };

  // ============================================
  // 快照系统相关 (20251212000002_add_bookmark_snapshots.sql)
  // ============================================

  /**
   * 检查是否可以创建快照
   */
  can_create_snapshot: {
    Args: {
      p_user_id: string;
      p_bookmark_id: number;
    };
    Returns: boolean;
  };
}

/**
 * 扩展后的完整 RPC 函数类型
 *
 * 合并自动生成的类型和手动补充的类型
 */
export type ExtendedRpcFunctions = MissingRpcFunctions;

// ============================================
// 类型安全的 RPC 调用辅助函数
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase.generated";

/**
 * 类型安全的 RPC 调用包装器
 *
 * @example
 * ```typescript
 * const result = await typedRpc(supabase, "get_unread_message_counts", {
 *   p_user_id: userId,
 * });
 * // result.data 自动推断为 { total: number; silent: number; ... }[]
 * ```
 */
export async function typedRpc<
  K extends keyof MissingRpcFunctions,
  Args extends MissingRpcFunctions[K]["Args"],
  Returns extends MissingRpcFunctions[K]["Returns"],
>(
  supabase: SupabaseClient<Database>,
  functionName: K,
  args: Args,
): Promise<{ data: Returns | null; error: { message: string } | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(functionName, args);
  return { data: data as Returns | null, error };
}

/**
 * 消息系统 RPC 调用
 */
export const messageRpc = {
  /**
   * 获取未读消息数量
   */
  getUnreadCounts: async (
    supabase: SupabaseClient<Database>,
    userId: string,
  ) => {
    return typedRpc(supabase, "get_unread_message_counts", { p_user_id: userId });
  },

  /**
   * 批量标记已读
   */
  markRead: async (
    supabase: SupabaseClient<Database>,
    userId: string,
    messageIds?: number[] | null,
  ) => {
    return typedRpc(supabase, "mark_messages_read", {
      p_user_id: userId,
      p_message_ids: messageIds,
    });
  },
};

/**
 * AI 规则 RPC 调用
 */
export const aiRulesRpc = {
  /**
   * 添加自定义规则
   */
  addRule: async (
    supabase: SupabaseClient<Database>,
    userId: string,
    rule: Json,
  ) => {
    return typedRpc(supabase, "add_ai_custom_rule", {
      p_user_id: userId,
      p_rule: rule,
    });
  },

  /**
   * ���除自定义规则
   */
  removeRule: async (
    supabase: SupabaseClient<Database>,
    userId: string,
    ruleId: string,
  ) => {
    return typedRpc(supabase, "remove_ai_custom_rule", {
      p_user_id: userId,
      p_rule_id: ruleId,
    });
  },
};

/**
 * AI 文件夹设置 RPC 调用
 */
export const aiFolderSettingsRpc = {
  /**
   * 获取设置
   */
  get: async (supabase: SupabaseClient<Database>, userId: string) => {
    return typedRpc(supabase, "get_ai_folder_settings", { p_user_id: userId });
  },

  /**
   * 更新设置
   */
  update: async (
    supabase: SupabaseClient<Database>,
    userId: string,
    settings: Json,
  ) => {
    return typedRpc(supabase, "update_ai_folder_settings", {
      p_user_id: userId,
      p_settings: settings,
    });
  },
};

/**
 * 相关书签 RPC 调用
 */
export const relatedBookmarksRpc = {
  /**
   * 查找相关书签
   */
  findRelated: async (
    supabase: SupabaseClient<Database>,
    bookmarkId: number,
    userId: string,
    options?: {
      limit?: number;
      minSimilarity?: number;
      excludeSameFolder?: boolean;
    },
  ) => {
    return typedRpc(supabase, "find_related_bookmarks", {
      p_bookmark_id: bookmarkId,
      p_user_id: userId,
      p_limit: options?.limit,
      p_min_similarity: options?.minSimilarity,
      p_exclude_same_folder: options?.excludeSameFolder,
    });
  },

  /**
   * 查找跨文件夹连接
   */
  findCrossConnections: async (
    supabase: SupabaseClient<Database>,
    userId: string,
    options?: {
      folderId?: number;
      limit?: number;
      minSimilarity?: number;
    },
  ) => {
    return typedRpc(supabase, "find_cross_folder_connections", {
      p_user_id: userId,
      p_folder_id: options?.folderId,
      p_limit: options?.limit,
      p_min_similarity: options?.minSimilarity,
    });
  },
};

/**
 * 分类系统 RPC 调用
 */
export const classificationRpc = {
  /**
   * 获取待处理建议数量
   */
  getPendingCount: async (
    supabase: SupabaseClient<Database>,
    userId: string,
  ) => {
    return typedRpc(supabase, "get_pending_suggestions_count", {
      p_user_id: userId,
    });
  },

  /**
   * 获取聚类统计
   */
  getClusterStats: async (
    supabase: SupabaseClient<Database>,
    userId: string,
  ) => {
    return typedRpc(supabase, "get_user_cluster_stats", { p_user_id: userId });
  },
};

/**
 * 快照系统 RPC 调用
 */
export const snapshotRpc = {
  /**
   * 检查是否可以创建快照
   */
  canCreate: async (
    supabase: SupabaseClient<Database>,
    userId: string,
    bookmarkId: number,
  ) => {
    return typedRpc(supabase, "can_create_snapshot", {
      p_user_id: userId,
      p_bookmark_id: bookmarkId,
    });
  },
};
