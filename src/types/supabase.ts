/**
 * Supabase 数据库类型定义
 *
 * 注意：此文件应该由 Supabase CLI 自动生成
 * 运行: npx supabase gen types typescript --local > src/types/supabase.ts
 *
 * 当前为手动定义的类型，与数据库迁移文件保持同步
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// V5.0新增：导入来源类型（定义在 Database 之前以便引用）
export type ImportSource =
  | "browser_chrome"
  | "browser_edge"
  | "browser_firefox"
  | "browser_safari"
  | "api"
  | "share_sheet"
  | "manual";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          phone: string | null;
          nickname: string | null;
          avatar_url: string | null;
          membership_type: "FREE" | "PRO";
          storage_quota: number;
          storage_used: number;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          phone?: string | null;
          nickname?: string | null;
          avatar_url?: string | null;
          membership_type?: "FREE" | "PRO";
          storage_quota?: number;
          storage_used?: number;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone?: string | null;
          nickname?: string | null;
          avatar_url?: string | null;
          membership_type?: "FREE" | "PRO";
          storage_quota?: number;
          storage_used?: number;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      folders: {
        Row: {
          id: number;
          user_id: string;
          name: string;
          parent_id: number | null;
          sort_order: number;
          is_system: boolean; // V4.2新增：系统文件夹标识
          system_type: SystemFolderType | null; // V4.2新增：系统文件夹类型
          is_archived: boolean; // V4.3新增：是否已停用
          folder_group: FolderGroup | null; // V4.4新增：文件夹分组
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          name: string;
          parent_id?: number | null;
          sort_order?: number;
          is_system?: boolean;
          system_type?: SystemFolderType | null;
          is_archived?: boolean;
          folder_group?: FolderGroup | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          name?: string;
          parent_id?: number | null;
          sort_order?: number;
          is_system?: boolean;
          system_type?: SystemFolderType | null;
          is_archived?: boolean;
          folder_group?: FolderGroup | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "folders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "folders_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      // V4.2新增：分类建议表
      classification_suggestions: {
        Row: {
          id: number;
          user_id: string;
          bookmark_id: number;
          suggested_folder_id: number | null;
          suggested_folder_name: string;
          suggest_new_folder: boolean;
          confidence: number;
          reason: string | null;
          status: SuggestionStatus;
          batch_id: string;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          bookmark_id: number;
          suggested_folder_id?: number | null;
          suggested_folder_name: string;
          suggest_new_folder?: boolean;
          confidence: number;
          reason?: string | null;
          status?: SuggestionStatus;
          batch_id: string;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          bookmark_id?: number;
          suggested_folder_id?: number | null;
          suggested_folder_name?: string;
          suggest_new_folder?: boolean;
          confidence?: number;
          reason?: string | null;
          status?: SuggestionStatus;
          batch_id?: string;
          created_at?: string;
          processed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "classification_suggestions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_suggestions_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_suggestions_folder_id_fkey";
            columns: ["suggested_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      bookmarks: {
        Row: {
          id: number;
          user_id: string;
          title: string;
          url: string;
          description: string | null;
          cover_url: string | null;
          platform: Platform;
          platform_content_id: string | null;
          ai_summary: string | null;
          ai_tags: string[] | null;
          folder_id: number | null;
          user_tags: string[] | null;
          notes: string | null;
          source_name: string | null;
          author: string | null;
          publish_time: string | null;
          content_type: "ARTICLE" | "VIDEO" | "IMAGE" | "UNKNOWN" | null;
          embedding: number[] | null;
          status: "PROCESSING" | "COMPLETED" | "FAILED";
          word_count: number | null;
          image_count: number | null;
          is_read: boolean;
          read_at: string | null;
          import_source: string | null; // V1.2新增：导入来源
          import_batch_id: string | null; // V1.2新增：导入批次ID
          rating: number; // V6.0新增：评级（0-5星，0表示未评级）
          is_locked: boolean; // V6.0新增：锁定状态（防止误删）
          is_marked_for_deletion: boolean; // V6.0新增：标记为待删除（仅UI标识）
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          title: string;
          url: string;
          description?: string | null;
          cover_url?: string | null;
          platform: Platform;
          platform_content_id?: string | null;
          ai_summary?: string | null;
          ai_tags?: string[] | null;
          folder_id?: number | null;
          user_tags?: string[] | null;
          notes?: string | null;
          source_name?: string | null;
          author?: string | null;
          publish_time?: string | null;
          content_type?: "ARTICLE" | "VIDEO" | "IMAGE" | "UNKNOWN" | null;
          embedding?: number[] | null;
          status?: "PROCESSING" | "COMPLETED" | "FAILED";
          word_count?: number | null;
          image_count?: number | null;
          is_read?: boolean;
          read_at?: string | null;
          import_source?: string | null;
          import_batch_id?: string | null;
          rating?: number; // V6.0新增
          is_locked?: boolean; // V6.0新增
          is_marked_for_deletion?: boolean; // V6.0新增
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          title?: string;
          url?: string;
          description?: string | null;
          cover_url?: string | null;
          platform?: Platform;
          platform_content_id?: string | null;
          ai_summary?: string | null;
          ai_tags?: string[] | null;
          folder_id?: number | null;
          user_tags?: string[] | null;
          notes?: string | null;
          source_name?: string | null;
          author?: string | null;
          publish_time?: string | null;
          content_type?: "ARTICLE" | "VIDEO" | "IMAGE" | "UNKNOWN" | null;
          embedding?: number[] | null;
          status?: "PROCESSING" | "COMPLETED" | "FAILED";
          word_count?: number | null;
          image_count?: number | null;
          is_read?: boolean;
          read_at?: string | null;
          import_source?: string | null;
          import_batch_id?: string | null;
          rating?: number; // V6.0新增
          is_locked?: boolean; // V6.0新增
          is_marked_for_deletion?: boolean; // V6.0新增
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookmarks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmarks_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_authorizations: {
        Row: {
          id: number;
          user_id: string;
          platform: "WECHAT" | "BILIBILI" | "XIAOHONGSHU";
          access_token: string | null;
          refresh_token: string | null;
          expires_at: string | null;
          status: "ACTIVE" | "EXPIRED" | "REVOKED";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          platform: "WECHAT" | "BILIBILI" | "XIAOHONGSHU";
          access_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          status?: "ACTIVE" | "EXPIRED" | "REVOKED";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          platform?: "WECHAT" | "BILIBILI" | "XIAOHONGSHU";
          access_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          status?: "ACTIVE" | "EXPIRED" | "REVOKED";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_authorizations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      // V5.0新增：导入历史记录表
      import_history: {
        Row: {
          id: number;
          user_id: string;
          import_source: ImportSource;
          import_batch_id: string;
          total_count: number;
          success_count: number;
          failed_count: number;
          skipped_count: number;
          folders_created: number;
          duration_ms: number | null;
          error_details: Json | null;
          options: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          import_source: ImportSource;
          import_batch_id: string;
          total_count: number;
          success_count: number;
          failed_count: number;
          skipped_count: number;
          folders_created?: number;
          duration_ms?: number | null;
          error_details?: Json | null;
          options?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          import_source?: ImportSource;
          import_batch_id?: string;
          total_count?: number;
          success_count?: number;
          failed_count?: number;
          skipped_count?: number;
          folders_created?: number;
          duration_ms?: number | null;
          error_details?: Json | null;
          options?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      search_bookmarks_semantic: {
        Args: {
          query_embedding: number[];
          p_user_id: string;
          match_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: number;
          title: string;
          url: string;
          description: string | null;
          cover_url: string | null;
          platform: string;
          ai_summary: string | null;
          ai_tags: string[] | null;
          folder_id: number | null;
          author: string | null;
          publish_time: string | null;
          content_type: string | null;
          user_tags: string[] | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          similarity: number;
        }[];
      };
      increment_storage_used: {
        Args: {
          target_user_id: string;
        };
        Returns: void;
      };
      decrement_storage_used: {
        Args: {
          target_user_id: string;
        };
        Returns: void;
      };
      // V4.2新增：获取或创建待整理文件夹
      get_or_create_inbox_folder: {
        Args: {
          p_user_id: string;
        };
        Returns: number;
      };
      // V4.2新增：获取待处理建议数量
      get_pending_suggestions_count: {
        Args: {
          p_user_id: string;
        };
        Returns: number;
      };
      // V4.2新增：批量接受分类建议
      accept_classification_suggestions: {
        Args: {
          p_user_id: string;
          p_suggestion_ids: number[];
        };
        Returns: number;
      };
      // V4.2新增：批量拒绝分类建议
      reject_classification_suggestions: {
        Args: {
          p_user_id: string;
          p_suggestion_ids: number[];
        };
        Returns: number;
      };
      // V4.2新增：过期旧建议
      expire_old_suggestions: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// 便捷类型别名
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type Folder = Database["public"]["Tables"]["folders"]["Row"];
export type FolderInsert = Database["public"]["Tables"]["folders"]["Insert"];
export type FolderUpdate = Database["public"]["Tables"]["folders"]["Update"];

export type Bookmark = Database["public"]["Tables"]["bookmarks"]["Row"];
export type BookmarkInsert =
  Database["public"]["Tables"]["bookmarks"]["Insert"];
export type BookmarkUpdate =
  Database["public"]["Tables"]["bookmarks"]["Update"];

export type PlatformAuthorization =
  Database["public"]["Tables"]["platform_authorizations"]["Row"];
export type PlatformAuthorizationInsert =
  Database["public"]["Tables"]["platform_authorizations"]["Insert"];
export type PlatformAuthorizationUpdate =
  Database["public"]["Tables"]["platform_authorizations"]["Update"];

// 平台类型
export type Platform =
  | "WECHAT_OFFICIAL_ACCOUNT"
  | "BILIBILI"
  | "XIAOHONGSHU"
  | "BROWSER_CHROME" // V1.2 新增：Chrome 书签
  | "BROWSER_EDGE" // V1.2 新增：Edge 书签
  | "BROWSER_FIREFOX" // 预留：Firefox 书签
  | "BROWSER_SAFARI" // 预留：Safari 书签
  | "UNKNOWN";
export type AuthPlatform = "WECHAT" | "BILIBILI" | "XIAOHONGSHU";
export type ContentType = "ARTICLE" | "VIDEO" | "IMAGE" | "UNKNOWN";
export type BookmarkStatus = "PROCESSING" | "COMPLETED" | "FAILED";
export type MembershipType = "FREE" | "PRO";
export type AuthorizationStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

// V4.2新增：系统文件夹类型
export type SystemFolderType = "INBOX"; // INBOX: 待整理文件夹

// V4.2新增：分类建议状态
export type SuggestionStatus = "pending" | "accepted" | "rejected" | "expired";

// V4.4新增：文件夹分组类型
export type FolderGroup = "work" | "study" | "life" | "entertainment" | "other";

// V4.2新增：分类建议类型别名
export type ClassificationSuggestion =
  Database["public"]["Tables"]["classification_suggestions"]["Row"];
export type ClassificationSuggestionInsert =
  Database["public"]["Tables"]["classification_suggestions"]["Insert"];
export type ClassificationSuggestionUpdate =
  Database["public"]["Tables"]["classification_suggestions"]["Update"];

// V4.2新增：重分类配置类型
export interface ReclassifySettings {
  last_run_at: string | null;
  inbox_threshold: number;
  auto_run_weekly: boolean;
}

// V5.0新增：导入历史记录表类型
export interface ImportHistory {
  id: number;
  user_id: string;
  import_source: ImportSource;
  import_batch_id: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  folders_created: number;
  duration_ms: number | null;
  error_details: ImportErrorDetail[] | null;
  options: ImportHistoryOptions | null;
  created_at: string;
}

export interface ImportHistoryInsert {
  user_id: string;
  import_source: ImportSource;
  import_batch_id: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  folders_created?: number;
  duration_ms?: number | null;
  error_details?: ImportErrorDetail[] | null;
  options?: ImportHistoryOptions | null;
}

export interface ImportErrorDetail {
  url: string;
  title?: string;
  reason: string;
}

export interface ImportHistoryOptions {
  skipDuplicates?: boolean;
  preserveFolderStructure?: boolean;
  targetFolderId?: number | null;
  [key: string]: unknown;
}
