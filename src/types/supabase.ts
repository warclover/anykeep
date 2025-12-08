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
          last_trash_cleanup_at: string | null; // V7.0新增
          last_validation_at: string | null; // V7.0新增
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
          last_trash_cleanup_at?: string | null; // V7.0新增
          last_validation_at?: string | null; // V7.0新增
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
          last_trash_cleanup_at?: string | null; // V7.0新增
          last_validation_at?: string | null; // V7.0新增
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
      // V9.1新增：分类反馈表
      classification_feedback: {
        Row: {
          id: number;
          user_id: string;
          suggestion_id: number | null;
          organization_suggestion_id: number | null;
          feedback_type: FeedbackType;
          comment: string | null;
          suggested_correct_folder_id: number | null;
          suggested_correct_folder_name: string | null;
          context: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          suggestion_id?: number | null;
          organization_suggestion_id?: number | null;
          feedback_type: FeedbackType;
          comment?: string | null;
          suggested_correct_folder_id?: number | null;
          suggested_correct_folder_name?: string | null;
          context?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          suggestion_id?: number | null;
          organization_suggestion_id?: number | null;
          feedback_type?: FeedbackType;
          comment?: string | null;
          suggested_correct_folder_id?: number | null;
          suggested_correct_folder_name?: string | null;
          context?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classification_feedback_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_feedback_suggestion_id_fkey";
            columns: ["suggestion_id"];
            isOneToOne: false;
            referencedRelation: "classification_suggestions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_feedback_organization_suggestion_id_fkey";
            columns: ["organization_suggestion_id"];
            isOneToOne: false;
            referencedRelation: "organization_suggestions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_feedback_folder_id_fkey";
            columns: ["suggested_correct_folder_id"];
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
          is_in_trash: boolean; // V7.0新增：垃圾箱状态
          trashed_at: string | null; // V7.0新增：进入垃圾箱时间
          is_invalid: boolean; // V7.0新增：链接失效状态
          invalidated_at: string | null; // V7.0新增：首次检测到失效时间
          last_validation_at: string | null; // V7.0新增：最后验证时间
          is_starred: boolean; // V8.0新增：星标/置顶状态
          starred_at: string | null; // V8.0新增：星标时间
          ai_content_type: "article" | "tutorial" | "video" | "tool" | null; // V9.0新增：AI检测的内容类型
          ai_content_type_confidence: number | null; // V9.0新增：内容类型检测置信度(0-100)
          ai_vision_data: Json | null; // V10.0新增：视觉分析数据 (Qwen-VL)
          classification_status: ClassificationStatus; // V11.0新增：V3分类状态
          classification_result: ClassificationResultData | null; // V11.0新增：V3分类结果详情
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
          is_in_trash?: boolean; // V7.0新增
          trashed_at?: string | null; // V7.0新增
          is_invalid?: boolean; // V7.0新增
          invalidated_at?: string | null; // V7.0新增
          last_validation_at?: string | null; // V7.0新增
          is_starred?: boolean; // V8.0新增
          starred_at?: string | null; // V8.0新增
          ai_content_type?: "article" | "tutorial" | "video" | "tool" | null; // V9.0新增
          ai_content_type_confidence?: number | null; // V9.0新增
          ai_vision_data?: Json | null; // V10.0新增
          classification_status?: ClassificationStatus; // V11.0新增
          classification_result?: ClassificationResultData | null; // V11.0新增
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
          is_in_trash?: boolean; // V7.0新增
          trashed_at?: string | null; // V7.0新增
          is_invalid?: boolean; // V7.0新增
          invalidated_at?: string | null; // V7.0新增
          last_validation_at?: string | null; // V7.0新增
          is_starred?: boolean; // V8.0新增
          starred_at?: string | null; // V8.0新增
          ai_content_type?: "article" | "tutorial" | "video" | "tool" | null; // V9.0新增
          ai_content_type_confidence?: number | null; // V9.0新增
          ai_vision_data?: Json | null; // V10.0新增
          classification_status?: ClassificationStatus; // V11.0新增
          classification_result?: ClassificationResultData | null; // V11.0新增
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
      // V7.0新增：失效检测历史记录表
      validation_history: {
        Row: {
          id: number;
          user_id: string;
          total_bookmarks: number;
          total_checked: number;
          skipped_count: number;
          valid_count: number;
          invalid_count: number;
          error_count: number;
          duration_ms: number | null;
          average_response_time_ms: number | null;
          invalid_bookmarks: Json | null;
          skipped_reasons: Json | null;
          started_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          total_bookmarks: number;
          total_checked: number;
          skipped_count: number;
          valid_count: number;
          invalid_count: number;
          error_count: number;
          duration_ms?: number | null;
          average_response_time_ms?: number | null;
          invalid_bookmarks?: Json | null;
          skipped_reasons?: Json | null;
          started_at: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          total_bookmarks?: number;
          total_checked?: number;
          skipped_count?: number;
          valid_count?: number;
          invalid_count?: number;
          error_count?: number;
          duration_ms?: number | null;
          average_response_time_ms?: number | null;
          invalid_bookmarks?: Json | null;
          skipped_reasons?: Json | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "validation_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      // V12.0新增：消息通知表
      messages: {
        Row: {
          id: number;
          user_id: string;
          type: MessageType;
          level: MessageLevel;
          title: string;
          content: string | null;
          related_bookmark_id: number | null;
          related_folder_id: number | null;
          related_import_id: number | null;
          action_url: string | null;
          action_label: string | null;
          metadata: Json;
          status: MessageStatus;
          created_at: string;
          read_at: string | null;
          priority: number;
          expires_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          type: MessageType;
          level?: MessageLevel;
          title: string;
          content?: string | null;
          related_bookmark_id?: number | null;
          related_folder_id?: number | null;
          related_import_id?: number | null;
          action_url?: string | null;
          action_label?: string | null;
          metadata?: Json;
          status?: MessageStatus;
          created_at?: string;
          read_at?: string | null;
          priority?: number;
          expires_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          type?: MessageType;
          level?: MessageLevel;
          title?: string;
          content?: string | null;
          related_bookmark_id?: number | null;
          related_folder_id?: number | null;
          related_import_id?: number | null;
          action_url?: string | null;
          action_label?: string | null;
          metadata?: Json;
          status?: MessageStatus;
          created_at?: string;
          read_at?: string | null;
          priority?: number;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_related_bookmark_id_fkey";
            columns: ["related_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_related_folder_id_fkey";
            columns: ["related_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_related_import_id_fkey";
            columns: ["related_import_id"];
            isOneToOne: false;
            referencedRelation: "import_history";
            referencedColumns: ["id"];
          },
        ];
      };
      // V12.0新增：用户通知偏好表
      notification_preferences: {
        Row: {
          id: number;
          user_id: string;
          silent_toast: boolean;
          normal_toast: boolean;
          important_toast: boolean;
          web_push_enabled: boolean;
          web_push_subscription: Json | null;
          do_not_disturb: boolean;
          dnd_start_time: string | null;
          dnd_end_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          silent_toast?: boolean;
          normal_toast?: boolean;
          important_toast?: boolean;
          web_push_enabled?: boolean;
          web_push_subscription?: Json | null;
          do_not_disturb?: boolean;
          dnd_start_time?: string | null;
          dnd_end_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          silent_toast?: boolean;
          normal_toast?: boolean;
          important_toast?: boolean;
          web_push_enabled?: boolean;
          web_push_subscription?: Json | null;
          do_not_disturb?: boolean;
          dnd_start_time?: string | null;
          dnd_end_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
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
      // V8.0新增：获取用户热门标签（搜索页面性能优化）
      get_user_hot_tags: {
        Args: {
          p_user_id: string;
          p_limit?: number;
        };
        Returns: {
          tag: string;
          count: number;
        }[];
      };
      // V12.0新增：获取未读消息数量（分等级统计）
      get_unread_message_counts: {
        Args: {
          p_user_id: string;
        };
        Returns: {
          total: number;
          silent: number;
          normal: number;
          important: number;
        };
      };
      // V12.0新增：批量标记消息已读
      mark_messages_read: {
        Args: {
          p_user_id: string;
          p_message_ids?: number[] | null;
        };
        Returns: number;
      };
      // V12.0新增：清理过期消息
      cleanup_expired_messages: {
        Args: Record<string, never>;
        Returns: number;
      };
      // V12.0新增：获取消息列表（带日期分组）
      get_messages_grouped: {
        Args: {
          p_user_id: string;
          p_status?: string | null;
          p_level?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: number;
          type: string;
          level: string;
          title: string;
          content: string | null;
          action_url: string | null;
          action_label: string | null;
          status: string;
          priority: number;
          created_at: string;
          read_at: string | null;
          metadata: Json;
          related_bookmark_id: number | null;
          related_folder_id: number | null;
          date_group: string;
        }[];
      };
      // V12.0新增：获取消息总数
      get_messages_count: {
        Args: {
          p_user_id: string;
          p_status?: string | null;
          p_level?: string | null;
        };
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

// V9.1新增：分类反馈类型
export type FeedbackType =
  | "wrong_folder"
  | "better_folder"
  | "folder_not_exist"
  | "confidence_too_high"
  | "confidence_too_low"
  | "helpful"
  | "other";

// V4.4新增：文件夹分组类型
export type FolderGroup = "work" | "study" | "life" | "entertainment" | "other";

// V4.2新增：分类建议类型别名
export type ClassificationSuggestion =
  Database["public"]["Tables"]["classification_suggestions"]["Row"];
export type ClassificationSuggestionInsert =
  Database["public"]["Tables"]["classification_suggestions"]["Insert"];
export type ClassificationSuggestionUpdate =
  Database["public"]["Tables"]["classification_suggestions"]["Update"];

// V9.1新增：分类反馈类型别名
export type ClassificationFeedback =
  Database["public"]["Tables"]["classification_feedback"]["Row"];
export type ClassificationFeedbackInsert =
  Database["public"]["Tables"]["classification_feedback"]["Insert"];
export type ClassificationFeedbackUpdate =
  Database["public"]["Tables"]["classification_feedback"]["Update"];

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

// ============================================
// V9.0 新增：用途标签功能类型定义
// ============================================

/**
 * 自定义用途标签
 * 用户可创建最多 12 个自定义用途标签
 */
export interface CustomUsageTag {
  /** 唯一标识（UUID） */
  id: string;
  /** 标签值（存储到 user_tags，需唯一） */
  value: string;
  /** 显示标签 */
  label: string;
  /** 主题色（Tailwind 颜色名，如 'blue', 'purple'） */
  color: string;
  /** 创建时间（ISO 8601） */
  createdAt: string;
  /** 最后使用时间（用于"最近使用"排序，可选） */
  lastUsedAt?: string;
}

/**
 * 用户设置扩展类型
 * 存储在 profiles.settings JSON 字段
 */
export interface ProfileSettings {
  /** 自定义用途标签列表（最多 12 个） */
  customUsageTags?: CustomUsageTag[];
  /** 重分类设置 */
  reclassify?: ReclassifySettings;
  /** 其他设置... */
  [key: string]: unknown;
}

/**
 * 用途标签使用统计（用于首页筛选栏显示）
 */
export interface UsageTagStats {
  /** 标签值 */
  value: string;
  /** 使用次数 */
  count: number;
}

/**
 * 用途标签筛选条件
 */
export interface UsageTagFilter {
  /** 选中的用途标签列表 */
  selectedTags: string[];
  /** 筛选模式：AND（全部匹配）/ OR（任一匹配） */
  mode: "AND" | "OR";
}

// 用途标签相关常量
export const CUSTOM_USAGE_TAG_LIMIT = 12;

// 可用的自定义标签颜色（避免与预设标签颜色重复）
export const CUSTOM_TAG_COLORS = [
  "blue",
  "purple",
  "pink",
  "sky",
  "lime",
  "yellow",
  "slate",
  "zinc",
] as const;

export type CustomTagColor = (typeof CUSTOM_TAG_COLORS)[number];

// ============================================
// V11.0 新增：V3 统一分类系统类型定义
// ============================================

/**
 * V3 分类状态
 * - pending: 等待分类
 * - classified: 已成功分类到文件夹
 * - suggested: AI 建议创建新文件夹（用户可确认）
 * - inbox: 低置信度，放入待整理
 */
export type ClassificationStatus =
  | "pending"
  | "classified"
  | "suggested"
  | "inbox";

/**
 * V3 分类结果详情（存储在 classification_result JSONB 字段）
 */
export interface ClassificationResultData {
  /** 目标文件夹 ID（inbox 时为 null） */
  folderId: number | null;
  /** 目标文件夹名称 */
  folderName: string;
  /** 分类置信度（0-100） */
  confidence: number;
  /** 分类动作 */
  action: "classify" | "suggest_new" | "inbox";
  /** 如果是 suggest_new，关联的建议 ID */
  suggestionId?: number;
  /** 分类时间戳（ISO 8601） */
  timestamp: string;
  /** 分类来源（哪个匹配器） */
  source?: string;
  /** 分类原因说明 */
  reason?: string;
}

// ============================================
// V12.0 新增：消息系统类型定义
// ============================================

/**
 * 消息类型
 * 包含分类、导入、批量操作、书签状态、文件夹、系统、配额、反馈、AI 处理等
 */
export type MessageType =
  // 分类相关
  | "classification_auto"
  | "classification_batch"
  | "classification_suggest"
  | "classification_failed"
  // 导入相关
  | "import_complete"
  | "import_partial"
  | "import_failed"
  // 批量操作
  | "batch_move"
  | "batch_delete"
  | "batch_tag"
  | "batch_restore"
  // 书签状态
  | "bookmark_saved"
  | "bookmark_invalid"
  | "bookmark_expired"
  // 文件夹操作
  | "folder_created"
  | "folder_merged"
  // 系统消息
  | "system_announcement"
  | "system_maintenance"
  | "system_update"
  // 配额相关
  | "quota_warning"
  | "quota_critical"
  | "quota_exceeded"
  // 用户反馈
  | "feedback_received"
  | "feedback_response"
  // AI 处理
  | "ai_summary_complete"
  | "ai_tags_complete"
  | "ai_processing_failed";

/**
 * 消息等级
 * - silent: 静默，仅记录不打扰
 * - normal: 普通，Toast + 记录
 * - important: 重要，Modal + Toast + 记录
 */
export type MessageLevel = "silent" | "normal" | "important";

/**
 * 消息状态
 */
export type MessageStatus = "unread" | "read" | "archived";

/**
 * 消息表类型别名
 */
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];
export type MessageUpdate = Database["public"]["Tables"]["messages"]["Update"];

/**
 * 通知偏好类型别名
 */
export type NotificationPreferences =
  Database["public"]["Tables"]["notification_preferences"]["Row"];
export type NotificationPreferencesInsert =
  Database["public"]["Tables"]["notification_preferences"]["Insert"];
export type NotificationPreferencesUpdate =
  Database["public"]["Tables"]["notification_preferences"]["Update"];
