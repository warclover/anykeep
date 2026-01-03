/**
 * Supabase 数据库类型定义
 * 手动维护版本 - 用于无法连接 Docker 时
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

// ============================================
// 自定义标签相关类型和常量
// ============================================

/** 自定义标签颜色类型 */
export type CustomTagColor =
  | "blue"
  | "purple"
  | "pink"
  | "sky"
  | "lime"
  | "yellow"
  | "slate"
  | "zinc";

/** 自定义用途标签接口 */
export interface CustomUsageTag {
  id?: string;
  value: string;
  label?: string;
  name?: string;
  color: CustomTagColor;
  lastUsedAt?: string;
}

/** 用户配置设置接口 */
export interface ProfileSettings {
  customUsageTags?: CustomUsageTag[];
  [key: string]: unknown;
}

/** 自定义标签颜色映射（颜色名 -> 显示名） */
export const CUSTOM_TAG_COLORS: Record<CustomTagColor, string> = {
  blue: "蓝色",
  purple: "紫色",
  pink: "粉色",
  sky: "天蓝",
  lime: "青柠",
  yellow: "黄色",
  slate: "石板灰",
  zinc: "锌灰",
};

/** 自定义标签颜色列表 */
export const CUSTOM_TAG_COLOR_LIST: CustomTagColor[] = [
  "blue",
  "purple",
  "pink",
  "sky",
  "lime",
  "yellow",
  "slate",
  "zinc",
];

/** 自定义用途标签数量上限 */
export const CUSTOM_USAGE_TAG_LIMIT = 20;

/** 平台类型 */
export type Platform =
  | "WECHAT_OFFICIAL_ACCOUNT"
  | "BILIBILI"
  | "XIAOHONGSHU"
  | "ZHIHU"
  | "DOUYIN"
  | "WEIBO"
  | "JUEJIN"
  | "JIANSHU"
  | "CSDN"
  | "GITHUB"
  | "YOUTUBE"
  | "TWITTER"
  | "MEDIUM"
  | "NOTION"
  | "BROWSER_CHROME"
  | "BROWSER_EDGE"
  | "BROWSER_FIREFOX"
  | "BROWSER_SAFARI"
  | "OTHER"
  | "UNKNOWN";

/** 导入来源类型 */
export type ImportSource =
  | "browser_chrome"
  | "browser_edge"
  | "browser_firefox"
  | "browser_safari"
  | "api"
  | "share_sheet"
  | "manual";

/**
 * 书签更新数据类型
 * 用于 Supabase .update() 操作
 */
export interface BookmarkUpdate {
  title?: string;
  description?: string | null;
  folder_id?: number | null;
  user_tags?: string[];
  notes?: string | null;
  rating?: number | null;
  is_locked?: boolean;
  is_marked_for_deletion?: boolean;
  is_read?: boolean;
  read_at?: string | null;
  is_starred?: boolean;
  starred_at?: string | null;
  is_in_trash?: boolean;
  trashed_at?: string | null;
  updated_at?: string;
}

/**
 * 书签插入数据类型
 * 用于 Supabase .insert() 操作
 */
export interface BookmarkInsert {
  user_id: string;
  url: string;
  title: string;
  description?: string | null;
  platform: Platform;
  folder_id?: number | null;
  user_tags?: string[] | null;
  notes?: string | null;
  status?: string;
  ai_summary?: string | null;
  ai_tags?: string[] | null;
  cover_url?: string | null;
  author?: string | null;
  source_name?: string | null;
  publish_time?: string | null;
  word_count?: number | null;
  image_count?: number | null;
  created_at?: string;
  import_source?: string;
  import_batch_id?: string;
}

// ============================================
// JSON 和数据库类型
// ============================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // ============================================
      // 核心业务表
      // ============================================

      bookmarks: {
        Row: {
          id: number;
          user_id: string;
          title: string | null;
          url: string;
          platform: string | null;
          description: string | null;
          ai_summary: string | null;
          full_content: string | null;
          embedding: number[] | null;
          folder_id: number | null;
          ai_tags: string[] | null;
          user_tags: string[] | null;
          is_in_trash: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          // V4.2+ 扩展字段
          cover_url: string | null;
          is_read: boolean;
          is_starred: boolean;
          is_locked: boolean;
          starred_at: string | null;
          rating: number | null;
          status: string | null;
          ai_content_type: string | null;
          source_name: string | null;
          author: string | null;
          publish_time: string | null;
          // 附加字段
          notes: string | null;
          is_marked_for_deletion: boolean;
          trashed_at: string | null;
          ai_vision_data: unknown | null;
          has_snapshot: boolean;
        };
        Insert: {
          id?: number;
          user_id: string;
          title?: string | null;
          url: string;
          platform?: string | null;
          description?: string | null;
          ai_summary?: string | null;
          full_content?: string | null;
          embedding?: number[] | null;
          folder_id?: number | null;
          ai_tags?: string[] | null;
          user_tags?: string[] | null;
          is_in_trash?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          // V4.2+ 扩展字段
          cover_url?: string | null;
          is_read?: boolean;
          is_starred?: boolean;
          is_locked?: boolean;
          starred_at?: string | null;
          rating?: number | null;
          status?: string | null;
          ai_content_type?: string | null;
          source_name?: string | null;
          author?: string | null;
          publish_time?: string | null;
          // 附加字段
          notes?: string | null;
          is_marked_for_deletion?: boolean;
          trashed_at?: string | null;
          ai_vision_data?: unknown | null;
          has_snapshot?: boolean;
        };
        Update: {
          id?: number;
          user_id?: string;
          title?: string | null;
          url?: string;
          platform?: string | null;
          description?: string | null;
          ai_summary?: string | null;
          full_content?: string | null;
          embedding?: number[] | null;
          folder_id?: number | null;
          ai_tags?: string[] | null;
          user_tags?: string[] | null;
          is_in_trash?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          // V4.2+ 扩展字段
          cover_url?: string | null;
          is_read?: boolean;
          is_starred?: boolean;
          is_locked?: boolean;
          starred_at?: string | null;
          rating?: number | null;
          status?: string | null;
          ai_content_type?: string | null;
          source_name?: string | null;
          author?: string | null;
          publish_time?: string | null;
          // 附加字段
          notes?: string | null;
          is_marked_for_deletion?: boolean;
          trashed_at?: string | null;
          ai_vision_data?: unknown | null;
          has_snapshot?: boolean;
        };
      };

      folders: {
        Row: {
          id: number;
          user_id: string;
          name: string;
          parent_id: number | null;
          is_system: boolean;
          is_archived: boolean | null;
          folder_group: string | null;
          sort_order: number | null;
          system_type: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          name: string;
          parent_id?: number | null;
          is_system?: boolean;
          is_archived?: boolean | null;
          folder_group?: string | null;
          sort_order?: number | null;
          system_type?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          name?: string;
          parent_id?: number | null;
          is_system?: boolean;
          is_archived?: boolean | null;
          folder_group?: string | null;
          sort_order?: number | null;
          system_type?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // Parent-Child 切片表 (20251228000006)
      // ============================================

      bookmark_chunks: {
        Row: {
          id: string;
          bookmark_id: number;
          parent_chunk_id: string | null;
          chunk_index: number;
          content: string;
          content_hash: string;
          chunk_type: "parent" | "child";
          token_count: number;
          start_offset: number | null;
          end_offset: number | null;
          embedding: number[] | null;
          embedding_version: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          bookmark_id: number;
          parent_chunk_id?: string | null;
          chunk_index: number;
          content: string;
          content_hash: string;
          chunk_type?: "parent" | "child";
          token_count: number;
          start_offset?: number | null;
          end_offset?: number | null;
          embedding?: number[] | null;
          embedding_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          bookmark_id?: number;
          parent_chunk_id?: string | null;
          chunk_index?: number;
          content?: string;
          content_hash?: string;
          chunk_type?: "parent" | "child";
          token_count?: number;
          start_offset?: number | null;
          end_offset?: number | null;
          embedding?: number[] | null;
          embedding_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ============================================
      // AI 相关表
      // ============================================

      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: string;
          content?: string;
          created_at?: string;
        };
      };

      user_corrections: {
        Row: {
          id: string;
          user_id: string;
          original_action: Json;
          corrected_action: Json;
          context: Json;
          rule_extracted: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          original_action: Json;
          corrected_action: Json;
          context?: Json;
          rule_extracted?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          original_action?: Json;
          corrected_action?: Json;
          context?: Json;
          rule_extracted?: boolean;
          created_at?: string;
        };
      };

      // ============================================
      // 其他表 - 使用宽松类型以兼容现有代码
      // ============================================

      profiles: {
        Row: {
          id: string;
          settings: Json | null;
          phone: string | null;
          nickname: string | null;
          avatar_url: string | null;
          membership_type: string | null;
          ai_preferences: Json | null;
          created_at: string;
          updated_at: string;
          storage_used: number | null;
          storage_quota: number | null;
        };
        Insert: {
          id: string;
          settings?: Json | null;
          phone?: string | null;
          nickname?: string | null;
          avatar_url?: string | null;
          membership_type?: string | null;
          ai_preferences?: Json | null;
          created_at?: string;
          updated_at?: string;
          storage_used?: number | null;
          storage_quota?: number | null;
        };
        Update: {
          id?: string;
          settings?: Json | null;
          phone?: string | null;
          nickname?: string | null;
          avatar_url?: string | null;
          membership_type?: string | null;
          ai_preferences?: Json | null;
          created_at?: string;
          updated_at?: string;
          storage_used?: number | null;
          storage_quota?: number | null;
        };
      };

      browser_bookmarks: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };

      browser_bookmark_folders: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };

      import_history: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };

      job_queue: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };

      organization_suggestions: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };

      classification_suggestions: {
        Row: {
          id: string;
          batch_id: string | null;
          bookmark_id: number;
          user_id: string;
          suggested_folder_id: number | null;
          suggested_folder_name: string | null;
          confidence: number;
          reason: string | null;
          status: string;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          batch_id?: string | null;
          bookmark_id: number;
          user_id: string;
          suggested_folder_id?: number | null;
          suggested_folder_name?: string | null;
          confidence: number;
          reason?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          batch_id?: string | null;
          bookmark_id?: number;
          user_id?: string;
          suggested_folder_id?: number | null;
          suggested_folder_name?: string | null;
          confidence?: number;
          reason?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string | null;
        };
      };

      distribution_targets: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };

      md_collections: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          raw_content: string | null;
          processing_status: string | null;
          processing_error: string | null;
          word_count: number | null;
          code_block_count: number | null;
          reading_time_minutes: number | null;
          ai_summary: string | null;
          ai_tags: string[] | null;
          embedding: number[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          raw_content?: string | null;
          processing_status?: string | null;
          processing_error?: string | null;
          word_count?: number | null;
          code_block_count?: number | null;
          reading_time_minutes?: number | null;
          ai_summary?: string | null;
          ai_tags?: string[] | null;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          raw_content?: string | null;
          processing_status?: string | null;
          processing_error?: string | null;
          word_count?: number | null;
          code_block_count?: number | null;
          reading_time_minutes?: number | null;
          ai_summary?: string | null;
          ai_tags?: string[] | null;
          embedding?: number[] | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      bookmark_tags: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };

      tags: {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
    };

    Views: {
      folder_stats: {
        Row: Record<string, unknown>;
      };
      classification_metrics_daily: {
        Row: Record<string, unknown>;
      };
      classification_metrics_summary: {
        Row: Record<string, unknown>;
      };
      classification_stats: {
        Row: Record<string, unknown>;
      };
      embedding_ab_test_summary: {
        Row: Record<string, unknown>;
      };
      embedding_stats: {
        Row: Record<string, unknown>;
      };
      llm_usage_daily: {
        Row: Record<string, unknown>;
      };
      llm_usage_monthly: {
        Row: Record<string, unknown>;
      };
      v_user_classification_stats: {
        Row: Record<string, unknown>;
      };
    };

    Functions: {
      search_bookmark_chunks: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
          p_user_id?: string;
        };
        Returns: {
          chunk_id: string;
          bookmark_id: number;
          chunk_content: string;
          chunk_type: string;
          chunk_index: number;
          parent_content: string;
          similarity: number;
        }[];
      };
      get_chunk_stats: {
        Args: {
          p_user_id?: string;
        };
        Returns: {
          total_chunks: number;
          parent_chunks: number;
          child_chunks: number;
          bookmarks_with_chunks: number;
          avg_chunks_per_bookmark: number;
        }[];
      };
      get_folder_bookmark_stats: {
        Args: {
          p_user_id: string;
          p_folder_ids: number[];
          p_today_start: string;
        };
        Returns: {
          folder_id: number;
          bookmark_count: number;
          today_count: number;
        }[];
      };
      get_folder_path: {
        Args: {
          p_folder_id: number;
        };
        Returns: {
          id: number;
          name: string;
        }[];
      };
      get_user_hot_tags: {
        Args: {
          p_user_id: string;
          p_limit: number;
        };
        Returns: {
          tag: string;
          count: number;
        }[];
      };
      claim_pending_jobs: {
        Args: {
          p_worker_id: string;
          p_job_types: string[];
          p_limit: number;
          p_lock_duration: string;
        };
        Returns: {
          id: string;
          job_type: string;
          payload: Json;
          priority: number;
          attempts: number;
          created_at: string;
        }[];
      };
      complete_job: {
        Args: {
          p_job_id: string;
          p_success: boolean;
          p_error: string | null;
          p_result: Json;
        };
        Returns: boolean;
      };
    };

    Enums: {
      [_ in never]: never;
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// 便捷类型导出
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Insertable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updatable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// 常用表类型别名
export type Folder = Tables<"folders">;
export type Bookmark = Tables<"bookmarks">;
export type BookmarkChunk = Tables<"bookmark_chunks">;
export type Profile = Tables<"profiles">;

// ============================================
// 扩展类型定义
// ============================================

/** 文件夹分组类型 */
export type FolderGroup =
  | "default"
  | "custom"
  | "work"
  | "study"
  | "life"
  | "entertainment"
  | "personal"
  | "archive"
  | "system"
  | "other";

/** 操作快照动作类型 */
export type OperationSnapshotAction =
  | "move"
  | "batch_move"
  | "batch_tag"
  | "batch_delete"
  | "merge_folder"
  | "create_folder"
  | "rename_folder"
  | "delete_folder"
  | "undo"
  // 简写别名（用于 UI 显示）
  | "create"
  | "split"
  | "merge"
  | "rename"
  | "delete";

/** 文件夹更新类型 */
export interface FolderUpdate {
  id?: number;
  user_id?: string;
  name?: string;
  parent_id?: number | null;
  is_system?: boolean;
  is_archived?: boolean;
  folder_group?: FolderGroup;
  sort_order?: number;
  system_type?: string;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// 补充缺失的类型定义
// ============================================

/** 重分类设置 */
export interface ReclassifySettings {
  enabled?: boolean;
  threshold?: number;
  [key: string]: unknown;
}

/** 分类建议插入类型 */
export interface ClassificationSuggestionInsert {
  user_id: string;
  bookmark_id: number;
  suggested_folder_id?: number | null;
  suggested_tags?: string[] | null;
  confidence?: number;
  status?: SuggestionStatus;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

/** 建议状态类型 */
export type SuggestionStatus = "pending" | "accepted" | "rejected" | "expired";

/** 带快照的书签类型 */
export interface BookmarkWithSnapshot extends Bookmark {
  bookmark_snapshots?: {
    id: string;
    status: string;
    snapshot_type: string;
    created_at: string;
  }[];
}

/** 导入历史类型 */
export interface ImportHistory {
  id: string;
  user_id: string;
  import_source: ImportSource;
  import_batch_id?: string;
  total_count: number;
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  status: "pending" | "processing" | "completed" | "failed";
  error_details?: ImportErrorDetail[];
  metadata?: Record<string, unknown>;
  created_at: string;
  completed_at?: string;
  duration_ms?: number;
  success_count?: number;
  folders_created?: number;
}

/** 导入错误详情 */
export interface ImportErrorDetail {
  url?: string;
  title?: string;
  error: string;
  code?: string;
}

/** 操作详情类型 */
export interface OperationDetail {
  id: string;
  user_id: string;
  operation_type: OperationSnapshotAction;
  target_type: "bookmark" | "folder";
  target_ids: (number | string)[];
  snapshot_data: Record<string, unknown>;
  description?: string;
  is_undone: boolean;
  created_at: string;
  undone_at?: string;
  // UI 组件使用的扩展属性
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  action?: OperationSnapshotAction;
  expires_at?: string;
  can_undo?: boolean;
  reason?: string;
}

/** 文件夹显示分组 */
export interface FolderDisplayGroup {
  id: string;
  name: string;
  order: number;
  folders: Folder[];
}

/** 报告建议类型 */
export interface ReportSuggestion {
  id: string;
  user_id: string;
  report_type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  status: "pending" | "generating" | "completed" | "failed";
  created_at: string;
  // UI 组件需要的扩展字段
  type?: "merge" | "split" | "rename" | "cleanup";
  targetFolders?: Array<{ id: number; name: string }>;
  priority?: "high" | "medium" | "low";
}

/** 集群处理状态 */
export type ClusterProcessingStatus = "pending" | "processing" | "completed" | "failed";

/** 分类建议类型 */
export interface ClassificationSuggestion {
  id: string;
  user_id: string;
  bookmark_id: number;
  suggested_folder_id?: number | null;
  suggested_folder_name?: string | null;
  suggest_new_folder?: boolean;
  suggested_tags?: string[] | null;
  confidence: number;
  status: SuggestionStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

/** 分类结果数据（支持 camelCase 和 snake_case 双格式） */
export interface ClassificationResultData {
  // 主要字段 (camelCase)
  folderId?: number | null;
  folderName?: string | null;
  confidence?: number;
  reason?: string;
  tier?: number;
  action?: string;
  matcherScores?: Record<string, number>;
  aiCalled?: boolean;
  timestamp?: string;
  suggestionId?: number;
  // 兼容字段 (snake_case)
  bookmark_id?: number;
  folder_id?: number | null;
  folder_name?: string | null;
  matcher_scores?: Record<string, number>;
  ai_called?: boolean;
  suggestion_id?: number;
  tags?: string[];
  reasoning?: string;
}

/** 分类候选 */
export interface ClassificationCandidate {
  bookmark_id: number;
  title: string;
  url: string;
  current_folder_id?: number | null;
  current_tags?: string[];
  suggested_folder_id?: number | null;
  suggested_tags?: string[];
  confidence: number;
}
