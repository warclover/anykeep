export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      ab_test_assignments: {
        Row: {
          assigned_at: string | null;
          expires_at: string | null;
          id: number;
          test_name: string;
          user_id: string;
          variant: string;
        };
        Insert: {
          assigned_at?: string | null;
          expires_at?: string | null;
          id?: number;
          test_name: string;
          user_id: string;
          variant: string;
        };
        Update: {
          assigned_at?: string | null;
          expires_at?: string | null;
          id?: number;
          test_name?: string;
          user_id?: string;
          variant?: string;
        };
        Relationships: [];
      };
      /** AI 会话表 - 存储用户与 AI 助手的对话会话 */
      ai_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          /** Agent 类型：knowledge, organize, learn */
          agent_type: string;
          /** 关联的书签 ID 列表 */
          context_bookmark_ids: number[] | null;
          /** 关联的文件夹 ID */
          context_folder_id: number | null;
          metadata: Json | null;
          /** 会话状态：active, archived, deleted */
          status: string;
          message_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          agent_type?: string;
          context_bookmark_ids?: number[] | null;
          context_folder_id?: number | null;
          metadata?: Json | null;
          status?: string;
          message_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          agent_type?: string;
          context_bookmark_ids?: number[] | null;
          context_folder_id?: number | null;
          metadata?: Json | null;
          status?: string;
          message_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_context_folder_id_fkey";
            columns: ["context_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      /** AI 反馈表 - 存储用户对 AI 回答的反馈 */
      ai_feedback: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string;
          message_id: string;
          /** 反馈类型：positive, negative */
          type: string;
          /** 负面反馈原因 */
          negative_reason: string | null;
          /** 负面反馈评论 */
          negative_comment: string | null;
          /** 原始用户消息 */
          original_message: string | null;
          /** 分类的意图 */
          classified_intent: string | null;
          /** 使用的工具 */
          tool_used: string | null;
          /** 执行模式：atomic, orchestration */
          execution_mode: string | null;
          /** 关联的 Skill ID */
          skill_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          conversation_id: string;
          message_id: string;
          type: string;
          negative_reason?: string | null;
          negative_comment?: string | null;
          original_message?: string | null;
          classified_intent?: string | null;
          tool_used?: string | null;
          execution_mode?: string | null;
          skill_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          conversation_id?: string;
          message_id?: string;
          type?: string;
          negative_reason?: string | null;
          negative_comment?: string | null;
          original_message?: string | null;
          classified_intent?: string | null;
          tool_used?: string | null;
          execution_mode?: string | null;
          skill_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_feedback_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /** AI 消息表 - 存储会话中的消息记录 */
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          /** 角色：user, assistant, system, tool */
          role: string;
          content: string | null;
          /** AI 发起的工具调用请求 */
          tool_calls: Json | null;
          /** 工具执行的结果 */
          tool_results: Json | null;
          /** 关联的 tool call ID */
          tool_call_id: string | null;
          metadata: Json | null;
          tokens_prompt: number | null;
          tokens_completion: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: string;
          content?: string | null;
          tool_calls?: Json | null;
          tool_results?: Json | null;
          tool_call_id?: string | null;
          metadata?: Json | null;
          tokens_prompt?: number | null;
          tokens_completion?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: string;
          content?: string | null;
          tool_calls?: Json | null;
          tool_results?: Json | null;
          tool_call_id?: string | null;
          metadata?: Json | null;
          tokens_prompt?: number | null;
          tokens_completion?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      /** AI 笔记表 - 存储 AI 生成的内容（总结、萃取、复习笔记等） */
      ai_notes: {
        Row: {
          id: string;
          user_id: string;
          /** 来源类型：ai_summary, ai_extraction, ai_review, ai_report, ai_response */
          source_type: string;
          title: string;
          content: string;
          /** 内容格式：markdown, html, plain, json */
          content_format: string;
          /** 关联的书签 ID 列表 */
          related_bookmark_ids: number[];
          source_conversation_id: string | null;
          source_message_id: string | null;
          source_skill_id: string | null;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_type: string;
          title: string;
          content: string;
          content_format?: string;
          related_bookmark_ids?: number[];
          source_conversation_id?: string | null;
          source_message_id?: string | null;
          source_skill_id?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_type?: string;
          title?: string;
          content?: string;
          content_format?: string;
          related_bookmark_ids?: number[];
          source_conversation_id?: string | null;
          source_message_id?: string | null;
          source_skill_id?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_notes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /** AI 操作快照表 - 支持 24 小时内撤销 AI 操作 */
      ai_operation_snapshots: {
        Row: {
          id: string;
          user_id: string;
          /** 操作类型：organize, batch_tag, dedupe, move, archive, delete */
          operation_type: string;
          conversation_id: string | null;
          skill_id: string | null;
          /** 受影响的书签 ID 列表 */
          bookmark_ids: number[];
          /** 操作前状态快照 */
          before_state: Json;
          /** 操作后状态快照 */
          after_state: Json;
          /** 执行的操作列表 */
          operations: Json;
          summary: string | null;
          is_reverted: boolean;
          reverted_at: string | null;
          created_at: string;
          /** 过期时间（默认 24 小时后） */
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          operation_type: string;
          conversation_id?: string | null;
          skill_id?: string | null;
          bookmark_ids?: number[];
          before_state?: Json;
          after_state?: Json;
          operations?: Json;
          summary?: string | null;
          is_reverted?: boolean;
          reverted_at?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          operation_type?: string;
          conversation_id?: string | null;
          skill_id?: string | null;
          bookmark_ids?: number[];
          before_state?: Json;
          after_state?: Json;
          operations?: Json;
          summary?: string | null;
          is_reverted?: boolean;
          reverted_at?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_operation_snapshots_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /** AI 会话记忆表 - 持久化存储会话状态，支持服务重启后恢复上下文 */
      ai_session_memory: {
        Row: {
          id: string;
          user_id: string;
          /** 会话 ID，用于标识不同的对话 */
          conversation_id: string;
          /** 完整的会话状态（ConversationState），包含消息历史、提及实体等 */
          state: Json;
          /** 消息数量，用于快速统计 */
          message_count: number;
          /** 最近的意图类型，用于快速筛选 */
          last_intent: string | null;
          created_at: string;
          updated_at: string;
          /** 过期时间，默认 7 天后过期 */
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          conversation_id: string;
          state?: Json;
          message_count?: number;
          last_intent?: string | null;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          conversation_id?: string;
          state?: Json;
          message_count?: number;
          last_intent?: string | null;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_session_memory_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /** Skill 执行日志表 - 记录所有 Skill 的执行历史 */
      ai_skill_executions: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string | null;
          message_id: string | null;
          /** Skill 唯一标识符，如 search, classify, summarize */
          skill_id: string;
          skill_version: string;
          input: Json;
          output: Json | null;
          /** 执行状态：pending, running, success, error, timeout, cancelled */
          status: string;
          latency_ms: number | null;
          tokens_used: number | null;
          error_message: string | null;
          error_code: string | null;
          retry_count: number | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          conversation_id?: string | null;
          message_id?: string | null;
          skill_id: string;
          skill_version?: string;
          input: Json;
          output?: Json | null;
          status?: string;
          latency_ms?: number | null;
          tokens_used?: number | null;
          error_message?: string | null;
          error_code?: string | null;
          retry_count?: number | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          conversation_id?: string | null;
          message_id?: string | null;
          skill_id?: string;
          skill_version?: string;
          input?: Json;
          output?: Json | null;
          status?: string;
          latency_ms?: number | null;
          tokens_used?: number | null;
          error_message?: string | null;
          error_code?: string | null;
          retry_count?: number | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_skill_executions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_skill_executions_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_skill_executions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "ai_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      /** Skill 版本配置表 - 管理 Skill 的版本和配置 */
      ai_skill_versions: {
        Row: {
          id: string;
          skill_id: string;
          version: string;
          name: string;
          description: string | null;
          /** 分类：understanding, organizing, learning, utility */
          category: string | null;
          config: Json;
          is_active: boolean;
          is_deprecated: boolean;
          execution_count: number | null;
          success_count: number | null;
          error_count: number | null;
          avg_latency_ms: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          skill_id: string;
          version: string;
          name: string;
          description?: string | null;
          category?: string | null;
          config?: Json;
          is_active?: boolean;
          is_deprecated?: boolean;
          execution_count?: number | null;
          success_count?: number | null;
          error_count?: number | null;
          avg_latency_ms?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          skill_id?: string;
          version?: string;
          name?: string;
          description?: string | null;
          category?: string | null;
          config?: Json;
          is_active?: boolean;
          is_deprecated?: boolean;
          execution_count?: number | null;
          success_count?: number | null;
          error_count?: number | null;
          avg_latency_ms?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookmark_snapshots: {
        Row: {
          article_images: Json | null;
          bookmark_id: number;
          captured_at: string | null;
          content_hash: string | null;
          content_markdown: string | null;
          content_version: number | null;
          created_at: string | null;
          error_message: string | null;
          expires_at: string | null;
          file_size: number | null;
          final_url: string | null;
          html_storage_path: string | null;
          id: number;
          images_stats: Json | null;
          images_status: string | null;
          job_id: string | null;
          max_retries: number | null;
          mhtml_storage_path: string | null;
          original_url: string;
          readable_byline: string | null;
          readable_content: string | null;
          readable_excerpt: string | null;
          readable_text_content: string | null;
          readable_title: string | null;
          readable_word_count: number | null;
          retry_count: number | null;
          screenshot_height: number | null;
          screenshot_storage_path: string | null;
          screenshot_width: number | null;
          snapshot_type: string;
          status: string;
          storage_bucket: string | null;
          storage_path: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          article_images?: Json | null;
          bookmark_id: number;
          captured_at?: string | null;
          content_hash?: string | null;
          content_markdown?: string | null;
          content_version?: number | null;
          created_at?: string | null;
          error_message?: string | null;
          expires_at?: string | null;
          file_size?: number | null;
          final_url?: string | null;
          html_storage_path?: string | null;
          id?: number;
          images_stats?: Json | null;
          images_status?: string | null;
          job_id?: string | null;
          max_retries?: number | null;
          mhtml_storage_path?: string | null;
          original_url: string;
          readable_byline?: string | null;
          readable_content?: string | null;
          readable_excerpt?: string | null;
          readable_text_content?: string | null;
          readable_title?: string | null;
          readable_word_count?: number | null;
          retry_count?: number | null;
          screenshot_height?: number | null;
          screenshot_storage_path?: string | null;
          screenshot_width?: number | null;
          snapshot_type?: string;
          status?: string;
          storage_bucket?: string | null;
          storage_path?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          article_images?: Json | null;
          bookmark_id?: number;
          captured_at?: string | null;
          content_hash?: string | null;
          content_markdown?: string | null;
          content_version?: number | null;
          created_at?: string | null;
          error_message?: string | null;
          expires_at?: string | null;
          file_size?: number | null;
          final_url?: string | null;
          html_storage_path?: string | null;
          id?: number;
          images_stats?: Json | null;
          images_status?: string | null;
          job_id?: string | null;
          max_retries?: number | null;
          mhtml_storage_path?: string | null;
          original_url?: string;
          readable_byline?: string | null;
          readable_content?: string | null;
          readable_excerpt?: string | null;
          readable_text_content?: string | null;
          readable_title?: string | null;
          readable_word_count?: number | null;
          retry_count?: number | null;
          screenshot_height?: number | null;
          screenshot_storage_path?: string | null;
          screenshot_width?: number | null;
          snapshot_type?: string;
          status?: string;
          storage_bucket?: string | null;
          storage_path?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookmark_snapshots_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmark_snapshots_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_queue";
            referencedColumns: ["id"];
          },
        ];
      };
      bookmarks: {
        Row: {
          ai_content_type: string | null;
          ai_content_type_confidence: number | null;
          ai_summary: string | null;
          ai_tags: string[] | null;
          ai_vision_data: Json | null;
          author: string | null;
          classification_result: Json | null;
          classification_status: string | null;
          cluster_confidence: number | null;
          cluster_id: string | null;
          content_type: string | null;
          cover_url: string | null;
          created_at: string | null;
          deleted_at: string | null;
          description: string | null;
          embedding: string | null;
          /** V4.2.7: embedding 版本追踪 (e.g., "v3") */
          embedding_version: string | null;
          folder_id: number | null;
          has_snapshot: boolean | null;
          id: number;
          image_count: number | null;
          import_batch_id: string | null;
          import_source: string | null;
          invalidated_at: string | null;
          is_in_trash: boolean | null;
          is_invalid: boolean | null;
          is_locked: boolean | null;
          is_marked_for_deletion: boolean | null;
          is_read: boolean | null;
          is_starred: boolean;
          last_snapshot_at: string | null;
          last_validation_at: string | null;
          notes: string | null;
          pending_cluster: boolean | null;
          pending_since: string | null;
          platform: string;
          platform_content_id: string | null;
          publish_time: string | null;
          rating: number | null;
          read_at: string | null;
          search_vector: unknown;
          snapshot_status: string | null;
          source_name: string | null;
          starred_at: string | null;
          status: string | null;
          tag_embedding: string | null;
          tag_embedding_at: string | null;
          title: string;
          title_embedding: string | null;
          title_embedding_at: string | null;
          trashed_at: string | null;
          updated_at: string | null;
          url: string;
          user_id: string;
          user_tags: string[] | null;
          word_count: number | null;
        };
        Insert: {
          ai_content_type?: string | null;
          ai_content_type_confidence?: number | null;
          ai_summary?: string | null;
          ai_tags?: string[] | null;
          ai_vision_data?: Json | null;
          author?: string | null;
          classification_result?: Json | null;
          classification_status?: string | null;
          cluster_confidence?: number | null;
          cluster_id?: string | null;
          content_type?: string | null;
          cover_url?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          embedding?: string | null;
          /** V4.2.7: embedding 版本追踪 (e.g., "v3") */
          embedding_version?: string | null;
          folder_id?: number | null;
          has_snapshot?: boolean | null;
          id?: number;
          image_count?: number | null;
          import_batch_id?: string | null;
          import_source?: string | null;
          invalidated_at?: string | null;
          is_in_trash?: boolean | null;
          is_invalid?: boolean | null;
          is_locked?: boolean | null;
          is_marked_for_deletion?: boolean | null;
          is_read?: boolean | null;
          is_starred?: boolean;
          last_snapshot_at?: string | null;
          last_validation_at?: string | null;
          notes?: string | null;
          pending_cluster?: boolean | null;
          pending_since?: string | null;
          platform: string;
          platform_content_id?: string | null;
          publish_time?: string | null;
          rating?: number | null;
          read_at?: string | null;
          search_vector?: unknown;
          snapshot_status?: string | null;
          source_name?: string | null;
          starred_at?: string | null;
          status?: string | null;
          tag_embedding?: string | null;
          tag_embedding_at?: string | null;
          title: string;
          title_embedding?: string | null;
          title_embedding_at?: string | null;
          trashed_at?: string | null;
          updated_at?: string | null;
          url: string;
          user_id: string;
          user_tags?: string[] | null;
          word_count?: number | null;
        };
        Update: {
          ai_content_type?: string | null;
          ai_content_type_confidence?: number | null;
          ai_summary?: string | null;
          ai_tags?: string[] | null;
          ai_vision_data?: Json | null;
          author?: string | null;
          classification_result?: Json | null;
          classification_status?: string | null;
          cluster_confidence?: number | null;
          cluster_id?: string | null;
          content_type?: string | null;
          cover_url?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          embedding?: string | null;
          /** V4.2.7: embedding 版本追踪 (e.g., "v3") */
          embedding_version?: string | null;
          folder_id?: number | null;
          has_snapshot?: boolean | null;
          id?: number;
          image_count?: number | null;
          import_batch_id?: string | null;
          import_source?: string | null;
          invalidated_at?: string | null;
          is_in_trash?: boolean | null;
          is_invalid?: boolean | null;
          is_locked?: boolean | null;
          is_marked_for_deletion?: boolean | null;
          is_read?: boolean | null;
          is_starred?: boolean;
          last_snapshot_at?: string | null;
          last_validation_at?: string | null;
          notes?: string | null;
          pending_cluster?: boolean | null;
          pending_since?: string | null;
          platform?: string;
          platform_content_id?: string | null;
          publish_time?: string | null;
          rating?: number | null;
          read_at?: string | null;
          search_vector?: unknown;
          snapshot_status?: string | null;
          source_name?: string | null;
          starred_at?: string | null;
          status?: string | null;
          tag_embedding?: string | null;
          tag_embedding_at?: string | null;
          title?: string;
          title_embedding?: string | null;
          title_embedding_at?: string | null;
          trashed_at?: string | null;
          updated_at?: string | null;
          url?: string;
          user_id?: string;
          user_tags?: string[] | null;
          word_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookmarks_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
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
      chat_cache: {
        Row: {
          created_at: string;
          id: number;
          query_hash: string;
          response: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          query_hash: string;
          response: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          query_hash?: string;
          response?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      chat_usage: {
        Row: {
          conversation_count: number;
          created_at: string;
          date: string;
          id: number;
          tokens_used: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          conversation_count?: number;
          created_at?: string;
          date?: string;
          id?: never;
          tokens_used?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          conversation_count?: number;
          created_at?: string;
          date?: string;
          id?: never;
          tokens_used?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      classification_config_audit: {
        Row: {
          action: string;
          changed_at: string;
          changed_by: string | null;
          changed_fields: string[] | null;
          config_key: string;
          id: number;
          new_value: Json | null;
          old_value: Json | null;
          reason: string | null;
        };
        Insert: {
          action: string;
          changed_at?: string;
          changed_by?: string | null;
          changed_fields?: string[] | null;
          config_key: string;
          id?: number;
          new_value?: Json | null;
          old_value?: Json | null;
          reason?: string | null;
        };
        Update: {
          action?: string;
          changed_at?: string;
          changed_by?: string | null;
          changed_fields?: string[] | null;
          config_key?: string;
          id?: number;
          new_value?: Json | null;
          old_value?: Json | null;
          reason?: string | null;
        };
        Relationships: [];
      };
      classification_decisions: {
        Row: {
          ai_model: string | null;
          ai_prompt_version: string | null;
          ai_response_time_ms: number | null;
          ai_skipped: boolean | null;
          bookmark_id: number;
          candidates: Json | null;
          client_version: string | null;
          confidence: number | null;
          created_at: string | null;
          decision_type: string;
          final_folder_id: number | null;
          final_folder_name: string | null;
          id: number;
          matcher_scores: Json | null;
          user_action: string | null;
          user_action_at: string | null;
          user_chosen_folder_id: number | null;
          user_id: string;
        };
        Insert: {
          ai_model?: string | null;
          ai_prompt_version?: string | null;
          ai_response_time_ms?: number | null;
          ai_skipped?: boolean | null;
          bookmark_id: number;
          candidates?: Json | null;
          client_version?: string | null;
          confidence?: number | null;
          created_at?: string | null;
          decision_type: string;
          final_folder_id?: number | null;
          final_folder_name?: string | null;
          id?: number;
          matcher_scores?: Json | null;
          user_action?: string | null;
          user_action_at?: string | null;
          user_chosen_folder_id?: number | null;
          user_id: string;
        };
        Update: {
          ai_model?: string | null;
          ai_prompt_version?: string | null;
          ai_response_time_ms?: number | null;
          ai_skipped?: boolean | null;
          bookmark_id?: number;
          candidates?: Json | null;
          client_version?: string | null;
          confidence?: number | null;
          created_at?: string | null;
          decision_type?: string;
          final_folder_id?: number | null;
          final_folder_name?: string | null;
          id?: number;
          matcher_scores?: Json | null;
          user_action?: string | null;
          user_action_at?: string | null;
          user_chosen_folder_id?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classification_decisions_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: true;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_decisions_final_folder_id_fkey";
            columns: ["final_folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "classification_decisions_final_folder_id_fkey";
            columns: ["final_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_decisions_user_chosen_folder_id_fkey";
            columns: ["user_chosen_folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "classification_decisions_user_chosen_folder_id_fkey";
            columns: ["user_chosen_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      classification_feedback: {
        Row: {
          bookmark_url: string | null;
          comment: string | null;
          context: Json | null;
          created_at: string | null;
          feedback_type: string;
          folder_id: number | null;
          id: number;
          organization_suggestion_id: number | null;
          original_confidence: number | null;
          reject_reason: string | null;
          suggested_correct_folder_id: number | null;
          suggested_correct_folder_name: string | null;
          suggestion_id: number | null;
          trace_id: string | null;
          user_id: string;
        };
        Insert: {
          bookmark_url?: string | null;
          comment?: string | null;
          context?: Json | null;
          created_at?: string | null;
          feedback_type: string;
          folder_id?: number | null;
          id?: number;
          organization_suggestion_id?: number | null;
          original_confidence?: number | null;
          reject_reason?: string | null;
          suggested_correct_folder_id?: number | null;
          suggested_correct_folder_name?: string | null;
          suggestion_id?: number | null;
          trace_id?: string | null;
          user_id: string;
        };
        Update: {
          bookmark_url?: string | null;
          comment?: string | null;
          context?: Json | null;
          created_at?: string | null;
          feedback_type?: string;
          folder_id?: number | null;
          id?: number;
          organization_suggestion_id?: number | null;
          original_confidence?: number | null;
          reject_reason?: string | null;
          suggested_correct_folder_id?: number | null;
          suggested_correct_folder_name?: string | null;
          suggestion_id?: number | null;
          trace_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classification_feedback_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "classification_feedback_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
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
            foreignKeyName: "classification_feedback_suggested_correct_folder_id_fkey";
            columns: ["suggested_correct_folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "classification_feedback_suggested_correct_folder_id_fkey";
            columns: ["suggested_correct_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_feedback_suggestion_id_fkey";
            columns: ["suggestion_id"];
            isOneToOne: false;
            referencedRelation: "classification_suggestions";
            referencedColumns: ["id"];
          },
        ];
      };
      classification_metrics: {
        Row: {
          action: string;
          ai_called: boolean;
          ai_score: number | null;
          bookmark_id: number | null;
          bookmark_url: string | null;
          cache_hit: boolean;
          confidence: number;
          created_at: string;
          decision_reason: string | null;
          execution_time_ms: number;
          feedback_at: string | null;
          feedback_folder_id: number | null;
          folder_id: number | null;
          folder_name: string | null;
          history_score: number | null;
          id: number;
          match_type: string | null;
          tier: number;
          tier0_time_ms: number | null;
          tier1_time_ms: number | null;
          tier2_time_ms: number | null;
          tier3_time_ms: number | null;
          trace_id: string | null;
          user_feedback: string | null;
          user_id: string;
          vector_score: number | null;
        };
        Insert: {
          action: string;
          ai_called?: boolean;
          ai_score?: number | null;
          bookmark_id?: number | null;
          bookmark_url?: string | null;
          cache_hit?: boolean;
          confidence: number;
          created_at?: string;
          decision_reason?: string | null;
          execution_time_ms: number;
          feedback_at?: string | null;
          feedback_folder_id?: number | null;
          folder_id?: number | null;
          folder_name?: string | null;
          history_score?: number | null;
          id?: number;
          match_type?: string | null;
          tier: number;
          tier0_time_ms?: number | null;
          tier1_time_ms?: number | null;
          tier2_time_ms?: number | null;
          tier3_time_ms?: number | null;
          trace_id?: string | null;
          user_feedback?: string | null;
          user_id: string;
          vector_score?: number | null;
        };
        Update: {
          action?: string;
          ai_called?: boolean;
          ai_score?: number | null;
          bookmark_id?: number | null;
          bookmark_url?: string | null;
          cache_hit?: boolean;
          confidence?: number;
          created_at?: string;
          decision_reason?: string | null;
          execution_time_ms?: number;
          feedback_at?: string | null;
          feedback_folder_id?: number | null;
          folder_id?: number | null;
          folder_name?: string | null;
          history_score?: number | null;
          id?: number;
          match_type?: string | null;
          tier?: number;
          tier0_time_ms?: number | null;
          tier1_time_ms?: number | null;
          tier2_time_ms?: number | null;
          tier3_time_ms?: number | null;
          trace_id?: string | null;
          user_feedback?: string | null;
          user_id?: string;
          vector_score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "classification_metrics_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_metrics_feedback_folder_id_fkey";
            columns: ["feedback_folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "classification_metrics_feedback_folder_id_fkey";
            columns: ["feedback_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_metrics_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "classification_metrics_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      classification_strategy_config: {
        Row: {
          ai_config: Json;
          config_key: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          feature_flags: Json;
          id: number;
          is_active: boolean;
          matcher_config: Json;
          scenario_weights: Json;
          thresholds: Json;
          updated_at: string;
          version: string;
        };
        Insert: {
          ai_config?: Json;
          config_key: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          feature_flags?: Json;
          id?: number;
          is_active?: boolean;
          matcher_config?: Json;
          scenario_weights?: Json;
          thresholds?: Json;
          updated_at?: string;
          version?: string;
        };
        Update: {
          ai_config?: Json;
          config_key?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          feature_flags?: Json;
          id?: number;
          is_active?: boolean;
          matcher_config?: Json;
          scenario_weights?: Json;
          thresholds?: Json;
          updated_at?: string;
          version?: string;
        };
        Relationships: [];
      };
      classification_suggestions: {
        Row: {
          batch_id: string;
          bookmark_id: number;
          bookmark_ids: number[] | null;
          confidence: number;
          created_at: string | null;
          id: number;
          metadata: Json | null;
          processed_at: string | null;
          reason: string | null;
          status: string | null;
          suggest_new_folder: boolean | null;
          suggested_action: string | null;
          suggested_folder_id: number | null;
          suggested_folder_name: string;
          user_id: string;
        };
        Insert: {
          batch_id: string;
          bookmark_id: number;
          bookmark_ids?: number[] | null;
          confidence: number;
          created_at?: string | null;
          id?: number;
          metadata?: Json | null;
          processed_at?: string | null;
          reason?: string | null;
          status?: string | null;
          suggest_new_folder?: boolean | null;
          suggested_action?: string | null;
          suggested_folder_id?: number | null;
          suggested_folder_name: string;
          user_id: string;
        };
        Update: {
          batch_id?: string;
          bookmark_id?: number;
          bookmark_ids?: number[] | null;
          confidence?: number;
          created_at?: string | null;
          id?: number;
          metadata?: Json | null;
          processed_at?: string | null;
          reason?: string | null;
          status?: string | null;
          suggest_new_folder?: boolean | null;
          suggested_action?: string | null;
          suggested_folder_id?: number | null;
          suggested_folder_name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classification_suggestions_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_suggestions_suggested_folder_id_fkey";
            columns: ["suggested_folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "classification_suggestions_suggested_folder_id_fkey";
            columns: ["suggested_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      embedding_ab_test_metrics: {
        Row: {
          ab_test_bucket: number | null;
          ab_test_group: string | null;
          bookmark_id: number | null;
          classification_result: Json | null;
          created_at: string;
          dimensions: number;
          execution_time_ms: number;
          feedback_at: string | null;
          feedback_folder_id: number | null;
          folder_id: number | null;
          id: number;
          model_id: string;
          model_name: string;
          operation_type: string;
          token_count: number | null;
          user_feedback: string | null;
          user_id: string;
        };
        Insert: {
          ab_test_bucket?: number | null;
          ab_test_group?: string | null;
          bookmark_id?: number | null;
          classification_result?: Json | null;
          created_at?: string;
          dimensions?: number;
          execution_time_ms: number;
          feedback_at?: string | null;
          feedback_folder_id?: number | null;
          folder_id?: number | null;
          id?: number;
          model_id: string;
          model_name: string;
          operation_type: string;
          token_count?: number | null;
          user_feedback?: string | null;
          user_id: string;
        };
        Update: {
          ab_test_bucket?: number | null;
          ab_test_group?: string | null;
          bookmark_id?: number | null;
          classification_result?: Json | null;
          created_at?: string;
          dimensions?: number;
          execution_time_ms?: number;
          feedback_at?: string | null;
          feedback_folder_id?: number | null;
          folder_id?: number | null;
          id?: number;
          model_id?: string;
          model_name?: string;
          operation_type?: string;
          token_count?: number | null;
          user_feedback?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "embedding_ab_test_metrics_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "embedding_ab_test_metrics_feedback_folder_id_fkey";
            columns: ["feedback_folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "embedding_ab_test_metrics_feedback_folder_id_fkey";
            columns: ["feedback_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "embedding_ab_test_metrics_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "embedding_ab_test_metrics_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      evolution_reports: {
        Row: {
          acceptance_rate: number | null;
          auto_classified: number;
          avg_confidence: number | null;
          folders_created: number;
          folders_merged: number;
          folders_renamed: number;
          folders_split: number;
          generated_at: string;
          health_score: number | null;
          id: number;
          manual_adjusted: number;
          pending_suggestions: number;
          report_month: string;
          suggestions_data: Json | null;
          total_classified: number;
          user_id: string;
          viewed_at: string | null;
        };
        Insert: {
          acceptance_rate?: number | null;
          auto_classified?: number;
          avg_confidence?: number | null;
          folders_created?: number;
          folders_merged?: number;
          folders_renamed?: number;
          folders_split?: number;
          generated_at?: string;
          health_score?: number | null;
          id?: number;
          manual_adjusted?: number;
          pending_suggestions?: number;
          report_month: string;
          suggestions_data?: Json | null;
          total_classified?: number;
          user_id: string;
          viewed_at?: string | null;
        };
        Update: {
          acceptance_rate?: number | null;
          auto_classified?: number;
          avg_confidence?: number | null;
          folders_created?: number;
          folders_merged?: number;
          folders_renamed?: number;
          folders_split?: number;
          generated_at?: string;
          health_score?: number | null;
          id?: number;
          manual_adjusted?: number;
          pending_suggestions?: number;
          report_month?: string;
          suggestions_data?: Json | null;
          total_classified?: number;
          user_id?: string;
          viewed_at?: string | null;
        };
        Relationships: [];
      };
      folder_profiles: {
        Row: {
          bookmark_count: number | null;
          boundary_clarity: number | null;
          computed_at: string | null;
          core_count: number | null;
          core_embedding: string | null;
          /** V4.2.7: core_embedding 版本 */
          core_embedding_version: string | null;
          core_radius: number | null;
          core_sample_ids: number[] | null;
          core_tightness: number | null;
          edge_count: number | null;
          edge_embedding: string | null;
          /** V4.2.7: edge_embedding 版本 */
          edge_embedding_version: string | null;
          edge_radius: number | null;
          edge_sample_ids: number[] | null;
          folder_id: number;
          heat_computed_at: string | null;
          heat_score: number | null;
          id: number;
          internal_similarity: number | null;
          is_ai_renamable: boolean | null;
          is_merge_candidate: boolean | null;
          is_split_candidate: boolean | null;
          is_system_locked: boolean | null;
          last_bookmark_at: string | null;
          name_embedding: string | null;
          /** V4.2.7: name_embedding 版本 */
          name_embedding_version: string | null;
          profile_embedding: string | null;
          /** V4.2.7: profile_embedding 版本 */
          profile_embedding_version: string | null;
          recent_additions: number | null;
          sample_titles: string[] | null;
          similar_folder_ids: number[] | null;
          source: string | null;
          suggested_name: string | null;
          suggested_name_reason: string | null;
          top_tags: string[] | null;
          updated_at: string | null;
          user_id: string;
          zone_computed_at: string | null;
        };
        Insert: {
          bookmark_count?: number | null;
          boundary_clarity?: number | null;
          computed_at?: string | null;
          core_count?: number | null;
          core_embedding?: string | null;
          /** V4.2.7: core_embedding 版本 */
          core_embedding_version?: string | null;
          core_radius?: number | null;
          core_sample_ids?: number[] | null;
          core_tightness?: number | null;
          edge_count?: number | null;
          edge_embedding?: string | null;
          /** V4.2.7: edge_embedding 版本 */
          edge_embedding_version?: string | null;
          edge_radius?: number | null;
          edge_sample_ids?: number[] | null;
          folder_id: number;
          heat_computed_at?: string | null;
          heat_score?: number | null;
          id?: number;
          internal_similarity?: number | null;
          is_ai_renamable?: boolean | null;
          is_merge_candidate?: boolean | null;
          is_split_candidate?: boolean | null;
          is_system_locked?: boolean | null;
          last_bookmark_at?: string | null;
          name_embedding?: string | null;
          /** V4.2.7: name_embedding 版本 */
          name_embedding_version?: string | null;
          profile_embedding?: string | null;
          /** V4.2.7: profile_embedding 版本 */
          profile_embedding_version?: string | null;
          recent_additions?: number | null;
          sample_titles?: string[] | null;
          similar_folder_ids?: number[] | null;
          source?: string | null;
          suggested_name?: string | null;
          suggested_name_reason?: string | null;
          top_tags?: string[] | null;
          updated_at?: string | null;
          user_id: string;
          zone_computed_at?: string | null;
        };
        Update: {
          bookmark_count?: number | null;
          boundary_clarity?: number | null;
          computed_at?: string | null;
          core_count?: number | null;
          core_embedding?: string | null;
          /** V4.2.7: core_embedding 版本 */
          core_embedding_version?: string | null;
          core_radius?: number | null;
          core_sample_ids?: number[] | null;
          core_tightness?: number | null;
          edge_count?: number | null;
          edge_embedding?: string | null;
          /** V4.2.7: edge_embedding 版本 */
          edge_embedding_version?: string | null;
          edge_radius?: number | null;
          edge_sample_ids?: number[] | null;
          folder_id?: number;
          heat_computed_at?: string | null;
          heat_score?: number | null;
          id?: number;
          internal_similarity?: number | null;
          is_ai_renamable?: boolean | null;
          is_merge_candidate?: boolean | null;
          is_split_candidate?: boolean | null;
          is_system_locked?: boolean | null;
          last_bookmark_at?: string | null;
          name_embedding?: string | null;
          /** V4.2.7: name_embedding 版本 */
          name_embedding_version?: string | null;
          profile_embedding?: string | null;
          /** V4.2.7: profile_embedding 版本 */
          profile_embedding_version?: string | null;
          recent_additions?: number | null;
          sample_titles?: string[] | null;
          similar_folder_ids?: number[] | null;
          source?: string | null;
          suggested_name?: string | null;
          suggested_name_reason?: string | null;
          top_tags?: string[] | null;
          updated_at?: string | null;
          user_id?: string;
          zone_computed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "folder_profiles_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: true;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "folder_profiles_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: true;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      folders: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          folder_group: string | null;
          id: number;
          is_archived: boolean;
          is_system: boolean | null;
          name: string;
          parent_id: number | null;
          sort_order: number | null;
          source: string | null;
          system_type: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          folder_group?: string | null;
          id?: number;
          is_archived?: boolean;
          is_system?: boolean | null;
          name: string;
          parent_id?: number | null;
          sort_order?: number | null;
          source?: string | null;
          system_type?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          folder_group?: string | null;
          id?: number;
          is_archived?: boolean;
          is_system?: boolean | null;
          name?: string;
          parent_id?: number | null;
          sort_order?: number | null;
          source?: string | null;
          system_type?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
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
      import_history: {
        Row: {
          created_at: string;
          duration_ms: number | null;
          error_details: Json | null;
          failed_count: number;
          folders_created: number;
          id: number;
          import_batch_id: string;
          import_source: string;
          options: Json | null;
          skipped_count: number;
          success_count: number;
          total_count: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          duration_ms?: number | null;
          error_details?: Json | null;
          failed_count?: number;
          folders_created?: number;
          id?: number;
          import_batch_id: string;
          import_source: string;
          options?: Json | null;
          skipped_count?: number;
          success_count?: number;
          total_count?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          duration_ms?: number | null;
          error_details?: Json | null;
          failed_count?: number;
          folders_created?: number;
          id?: number;
          import_batch_id?: string;
          import_source?: string;
          options?: Json | null;
          skipped_count?: number;
          success_count?: number;
          total_count?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      job_queue: {
        Row: {
          attempts: number | null;
          claimed_by: string | null;
          completed_at: string | null;
          created_at: string | null;
          error: string | null;
          id: string;
          lock_until: string | null;
          max_attempts: number | null;
          payload: Json;
          priority: number | null;
          result: Json | null;
          scheduled_at: string | null;
          started_at: string | null;
          status: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          attempts?: number | null;
          claimed_by?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          lock_until?: string | null;
          max_attempts?: number | null;
          payload?: Json;
          priority?: number | null;
          result?: Json | null;
          scheduled_at?: string | null;
          started_at?: string | null;
          status?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          attempts?: number | null;
          claimed_by?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          error?: string | null;
          id?: string;
          lock_until?: string | null;
          max_attempts?: number | null;
          payload?: Json;
          priority?: number | null;
          result?: Json | null;
          scheduled_at?: string | null;
          started_at?: string | null;
          status?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      knowledge_links: {
        Row: {
          algorithm: string | null;
          created_at: string | null;
          evidence: Json;
          id: string;
          link_type: string;
          source_bookmark_id: number;
          strength: number;
          target_bookmark_id: number;
          user_id: string;
        };
        Insert: {
          algorithm?: string | null;
          created_at?: string | null;
          evidence?: Json;
          id?: string;
          link_type: string;
          source_bookmark_id: number;
          strength: number;
          target_bookmark_id: number;
          user_id: string;
        };
        Update: {
          algorithm?: string | null;
          created_at?: string | null;
          evidence?: Json;
          id?: string;
          link_type?: string;
          source_bookmark_id?: number;
          strength?: number;
          target_bookmark_id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_links_source_bookmark_id_fkey";
            columns: ["source_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_links_target_bookmark_id_fkey";
            columns: ["target_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
        ];
      };
      librarian_analysis_history: {
        Row: {
          analysis_data: Json;
          created_at: string;
          duplicate_count: number;
          empty_count: number;
          health_score: number;
          id: number;
          missing_count: number;
          oversized_count: number;
          poorly_named_count: number;
          user_id: string;
        };
        Insert: {
          analysis_data?: Json;
          created_at?: string;
          duplicate_count?: number;
          empty_count?: number;
          health_score: number;
          id?: number;
          missing_count?: number;
          oversized_count?: number;
          poorly_named_count?: number;
          user_id: string;
        };
        Update: {
          analysis_data?: Json;
          created_at?: string;
          duplicate_count?: number;
          empty_count?: number;
          health_score?: number;
          id?: number;
          missing_count?: number;
          oversized_count?: number;
          poorly_named_count?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      llm_usage_log: {
        Row: {
          cost_cents: number;
          created_at: string;
          execution_time_ms: number | null;
          id: number;
          input_tokens: number;
          metadata: Json | null;
          model: string;
          operation: string;
          output_tokens: number;
          request_id: string | null;
          total_tokens: number | null;
          user_id: string;
        };
        Insert: {
          cost_cents?: number;
          created_at?: string;
          execution_time_ms?: number | null;
          id?: number;
          input_tokens?: number;
          metadata?: Json | null;
          model: string;
          operation: string;
          output_tokens?: number;
          request_id?: string | null;
          total_tokens?: number | null;
          user_id: string;
        };
        Update: {
          cost_cents?: number;
          created_at?: string;
          execution_time_ms?: number | null;
          id?: number;
          input_tokens?: number;
          metadata?: Json | null;
          model?: string;
          operation?: string;
          output_tokens?: number;
          request_id?: string | null;
          total_tokens?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      /**
       * P2-007: Markdown 内容收藏表
       * @since 2025-12-20
       */
      md_collections: {
        Row: {
          id: number;
          user_id: string;
          title: string;
          raw_content: string;
          content_hash: string;
          word_count: number;
          code_block_count: number;
          reading_time_minutes: number;
          ai_summary: string | null;
          ai_tags: string[] | null;
          content_type: string | null;
          content_type_confidence: number | null;
          embedding: string | null;
          embedding_version: string | null;
          folder_id: number | null;
          user_tags: string[] | null;
          notes: string | null;
          processing_status: string;
          source_type: string | null;
          source_filename: string | null;
          is_read: boolean;
          is_starred: boolean;
          read_at: string | null;
          starred_at: string | null;
          processed_at: string | null;
          processing_error: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          title: string;
          raw_content: string;
          content_hash: string;
          word_count?: number;
          code_block_count?: number;
          reading_time_minutes?: number;
          ai_summary?: string | null;
          ai_tags?: string[] | null;
          content_type?: string | null;
          content_type_confidence?: number | null;
          embedding?: string | null;
          embedding_version?: string | null;
          folder_id?: number | null;
          user_tags?: string[] | null;
          notes?: string | null;
          processing_status?: string;
          source_type?: string | null;
          source_filename?: string | null;
          is_read?: boolean;
          is_starred?: boolean;
          read_at?: string | null;
          starred_at?: string | null;
          processed_at?: string | null;
          processing_error?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          title?: string;
          raw_content?: string;
          content_hash?: string;
          word_count?: number;
          code_block_count?: number;
          reading_time_minutes?: number;
          ai_summary?: string | null;
          ai_tags?: string[] | null;
          content_type?: string | null;
          content_type_confidence?: number | null;
          embedding?: string | null;
          embedding_version?: string | null;
          folder_id?: number | null;
          user_tags?: string[] | null;
          notes?: string | null;
          processing_status?: string;
          source_type?: string | null;
          source_filename?: string | null;
          is_read?: boolean;
          is_starred?: boolean;
          read_at?: string | null;
          starred_at?: string | null;
          processed_at?: string | null;
          processing_error?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "md_collections_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      /** MD 收藏高亮标记表 */
      md_collection_highlights: {
        Row: {
          id: string;
          collection_id: number;
          user_id: string;
          start_offset: number;
          end_offset: number;
          anchor_text: string;
          color: "yellow" | "green" | "blue" | "pink" | "purple";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          collection_id: number;
          user_id: string;
          start_offset: number;
          end_offset: number;
          anchor_text: string;
          color: "yellow" | "green" | "blue" | "pink" | "purple";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: number;
          user_id?: string;
          start_offset?: number;
          end_offset?: number;
          anchor_text?: string;
          color?: "yellow" | "green" | "blue" | "pink" | "purple";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "md_collection_highlights_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "md_collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "md_collection_highlights_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          action_label: string | null;
          action_url: string | null;
          content: string | null;
          created_at: string | null;
          expires_at: string | null;
          id: number;
          level: string;
          metadata: Json | null;
          priority: number | null;
          read_at: string | null;
          related_bookmark_id: number | null;
          related_folder_id: number | null;
          related_import_id: number | null;
          status: string;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          action_label?: string | null;
          action_url?: string | null;
          content?: string | null;
          created_at?: string | null;
          expires_at?: string | null;
          id?: number;
          level?: string;
          metadata?: Json | null;
          priority?: number | null;
          read_at?: string | null;
          related_bookmark_id?: number | null;
          related_folder_id?: number | null;
          related_import_id?: number | null;
          status?: string;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          action_label?: string | null;
          action_url?: string | null;
          content?: string | null;
          created_at?: string | null;
          expires_at?: string | null;
          id?: number;
          level?: string;
          metadata?: Json | null;
          priority?: number | null;
          read_at?: string | null;
          related_bookmark_id?: number | null;
          related_folder_id?: number | null;
          related_import_id?: number | null;
          status?: string;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
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
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
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
      notification_preferences: {
        Row: {
          created_at: string | null;
          dnd_end_time: string | null;
          dnd_start_time: string | null;
          do_not_disturb: boolean | null;
          id: number;
          important_toast: boolean | null;
          normal_toast: boolean | null;
          silent_toast: boolean | null;
          updated_at: string | null;
          user_id: string;
          web_push_enabled: boolean | null;
          web_push_subscription: Json | null;
        };
        Insert: {
          created_at?: string | null;
          dnd_end_time?: string | null;
          dnd_start_time?: string | null;
          do_not_disturb?: boolean | null;
          id?: number;
          important_toast?: boolean | null;
          normal_toast?: boolean | null;
          silent_toast?: boolean | null;
          updated_at?: string | null;
          user_id: string;
          web_push_enabled?: boolean | null;
          web_push_subscription?: Json | null;
        };
        Update: {
          created_at?: string | null;
          dnd_end_time?: string | null;
          dnd_start_time?: string | null;
          do_not_disturb?: boolean | null;
          id?: number;
          important_toast?: boolean | null;
          normal_toast?: boolean | null;
          silent_toast?: boolean | null;
          updated_at?: string | null;
          user_id?: string;
          web_push_enabled?: boolean | null;
          web_push_subscription?: Json | null;
        };
        Relationships: [];
      };
      operation_snapshots: {
        Row: {
          action: string;
          after_state: Json;
          before_state: Json;
          bookmark_ids: number[] | null;
          created_at: string | null;
          expires_at: string | null;
          folder_id: number | null;
          folder_ids: number[] | null;
          id: string;
          is_undone: boolean | null;
          reason: string | null;
          undone_at: string | null;
          user_id: string;
        };
        Insert: {
          action: string;
          after_state?: Json;
          before_state?: Json;
          bookmark_ids?: number[] | null;
          created_at?: string | null;
          expires_at?: string | null;
          folder_id?: number | null;
          folder_ids?: number[] | null;
          id?: string;
          is_undone?: boolean | null;
          reason?: string | null;
          undone_at?: string | null;
          user_id: string;
        };
        Update: {
          action?: string;
          after_state?: Json;
          before_state?: Json;
          bookmark_ids?: number[] | null;
          created_at?: string | null;
          expires_at?: string | null;
          folder_id?: number | null;
          folder_ids?: number[] | null;
          id?: string;
          is_undone?: boolean | null;
          reason?: string | null;
          undone_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operation_snapshots_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "operation_snapshots_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_suggestions: {
        Row: {
          bookmark_ids: number[];
          confidence: number;
          created_at: string | null;
          id: number;
          reason: string | null;
          responded_at: string | null;
          sample_titles: string[] | null;
          status: string | null;
          suggested_folder_name: string | null;
          suggestion_type: string;
          target_folder_id: number | null;
          user_id: string;
        };
        Insert: {
          bookmark_ids: number[];
          confidence: number;
          created_at?: string | null;
          id?: number;
          reason?: string | null;
          responded_at?: string | null;
          sample_titles?: string[] | null;
          status?: string | null;
          suggested_folder_name?: string | null;
          suggestion_type: string;
          target_folder_id?: number | null;
          user_id: string;
        };
        Update: {
          bookmark_ids?: number[];
          confidence?: number;
          created_at?: string | null;
          id?: number;
          reason?: string | null;
          responded_at?: string | null;
          sample_titles?: string[] | null;
          status?: string | null;
          suggested_folder_name?: string | null;
          suggestion_type?: string;
          target_folder_id?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_suggestions_target_folder_id_fkey";
            columns: ["target_folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "organization_suggestions_target_folder_id_fkey";
            columns: ["target_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      patrol_reports: {
        Row: {
          broken_links_count: number;
          created_at: string;
          generated_at: string;
          id: string;
          overall_score: number;
          report_data: Json;
          report_period: string;
          stale_bookmarks_count: number;
          total_issues: number;
          user_id: string;
        };
        Insert: {
          broken_links_count?: number;
          created_at?: string;
          generated_at?: string;
          id: string;
          overall_score?: number;
          report_data?: Json;
          report_period?: string;
          stale_bookmarks_count?: number;
          total_issues?: number;
          user_id: string;
        };
        Update: {
          broken_links_count?: number;
          created_at?: string;
          generated_at?: string;
          id?: string;
          overall_score?: number;
          report_data?: Json;
          report_period?: string;
          stale_bookmarks_count?: number;
          total_issues?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      pending_confirmations: {
        Row: {
          bookmark_id: number | null;
          confirmation_type: string;
          created_at: string;
          expires_at: string;
          folder_id: number | null;
          id: number;
          resolved_at: string | null;
          status: string;
          suggestion: Json;
          user_choice: Json | null;
          user_id: string;
        };
        Insert: {
          bookmark_id?: number | null;
          confirmation_type: string;
          created_at?: string;
          expires_at?: string;
          folder_id?: number | null;
          id?: number;
          resolved_at?: string | null;
          status?: string;
          suggestion: Json;
          user_choice?: Json | null;
          user_id: string;
        };
        Update: {
          bookmark_id?: number | null;
          confirmation_type?: string;
          created_at?: string;
          expires_at?: string;
          folder_id?: number | null;
          id?: number;
          resolved_at?: string | null;
          status?: string;
          suggestion?: Json;
          user_choice?: Json | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pending_confirmations_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pending_confirmations_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "pending_confirmations_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_authorizations: {
        Row: {
          access_token: string | null;
          created_at: string | null;
          expires_at: string | null;
          id: number;
          platform: string;
          refresh_token: string | null;
          status: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          access_token?: string | null;
          created_at?: string | null;
          expires_at?: string | null;
          id?: number;
          platform: string;
          refresh_token?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          access_token?: string | null;
          created_at?: string | null;
          expires_at?: string | null;
          id?: number;
          platform?: string;
          refresh_token?: string | null;
          status?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          ai_preferences: Json | null;
          avatar_url: string | null;
          created_at: string | null;
          id: string;
          last_trash_cleanup_at: string | null;
          last_validation_at: string | null;
          membership_type: string | null;
          nickname: string | null;
          patrol_frequency: string | null;
          patrol_notification_enabled: boolean | null;
          phone: string | null;
          settings: Json | null;
          storage_quota: number | null;
          storage_used: number | null;
          updated_at: string | null;
        };
        Insert: {
          ai_preferences?: Json | null;
          avatar_url?: string | null;
          created_at?: string | null;
          id: string;
          last_trash_cleanup_at?: string | null;
          last_validation_at?: string | null;
          membership_type?: string | null;
          nickname?: string | null;
          patrol_frequency?: string | null;
          patrol_notification_enabled?: boolean | null;
          phone?: string | null;
          settings?: Json | null;
          storage_quota?: number | null;
          storage_used?: number | null;
          updated_at?: string | null;
        };
        Update: {
          ai_preferences?: Json | null;
          avatar_url?: string | null;
          created_at?: string | null;
          id?: string;
          last_trash_cleanup_at?: string | null;
          last_validation_at?: string | null;
          membership_type?: string | null;
          nickname?: string | null;
          patrol_frequency?: string | null;
          patrol_notification_enabled?: boolean | null;
          phone?: string | null;
          settings?: Json | null;
          storage_quota?: number | null;
          storage_used?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      scenario_weight_configs: {
        Row: {
          ab_test_enabled: boolean | null;
          ab_test_variant: string | null;
          created_at: string | null;
          description: string | null;
          id: number;
          is_active: boolean | null;
          priority: number | null;
          scenario: string;
          thresholds: Json;
          updated_at: string | null;
          weights: Json;
        };
        Insert: {
          ab_test_enabled?: boolean | null;
          ab_test_variant?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: number;
          is_active?: boolean | null;
          priority?: number | null;
          scenario: string;
          thresholds?: Json;
          updated_at?: string | null;
          weights?: Json;
        };
        Update: {
          ab_test_enabled?: boolean | null;
          ab_test_variant?: string | null;
          created_at?: string | null;
          description?: string | null;
          id?: number;
          is_active?: boolean | null;
          priority?: number | null;
          scenario?: string;
          thresholds?: Json;
          updated_at?: string | null;
          weights?: Json;
        };
        Relationships: [];
      };
      smart_lists: {
        Row: {
          bookmark_count: number | null;
          color: string | null;
          created_at: string | null;
          deleted_at: string | null;
          description: string | null;
          filters: Json;
          icon: string | null;
          id: number;
          is_pinned: boolean | null;
          is_preset: boolean | null;
          last_accessed_at: string | null;
          name: string;
          sort_by: string | null;
          sort_order: number | null;
          updated_at: string | null;
          user_id: string;
          view_mode: string | null;
        };
        Insert: {
          bookmark_count?: number | null;
          color?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          filters?: Json;
          icon?: string | null;
          id?: number;
          is_pinned?: boolean | null;
          is_preset?: boolean | null;
          last_accessed_at?: string | null;
          name: string;
          sort_by?: string | null;
          sort_order?: number | null;
          updated_at?: string | null;
          user_id: string;
          view_mode?: string | null;
        };
        Update: {
          bookmark_count?: number | null;
          color?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          filters?: Json;
          icon?: string | null;
          id?: number;
          is_pinned?: boolean | null;
          is_preset?: boolean | null;
          last_accessed_at?: string | null;
          name?: string;
          sort_by?: string | null;
          sort_order?: number | null;
          updated_at?: string | null;
          user_id?: string;
          view_mode?: string | null;
        };
        Relationships: [];
      };
      source_profiles: {
        Row: {
          avg_confidence: number | null;
          content_type: string | null;
          created_at: string;
          domains: string[];
          frequent_folders: number[];
          id: number;
          last_seen_at: string | null;
          sample_count: number;
          source_id: string;
          source_name: string | null;
          source_type: string;
          trust_score: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avg_confidence?: number | null;
          content_type?: string | null;
          created_at?: string;
          domains?: string[];
          frequent_folders?: number[];
          id?: number;
          last_seen_at?: string | null;
          sample_count?: number;
          source_id: string;
          source_name?: string | null;
          source_type?: string;
          trust_score?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avg_confidence?: number | null;
          content_type?: string | null;
          created_at?: string;
          domains?: string[];
          frequent_folders?: number[];
          id?: number;
          last_seen_at?: string | null;
          sample_count?: number;
          source_id?: string;
          source_name?: string | null;
          source_type?: string;
          trust_score?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      system_folder_i18n: {
        Row: {
          created_at: string | null;
          display_name: string;
          id: number;
          locale: string;
          system_type: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          display_name: string;
          id?: number;
          locale: string;
          system_type: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          display_name?: string;
          id?: number;
          locale?: string;
          system_type?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      tag_relationships: {
        Row: {
          co_occurrence_count: number;
          created_at: string;
          id: number;
          relationship_type: string;
          source: string;
          source_tag: string;
          target_tag: string;
          updated_at: string;
          user_id: string;
          weight: number;
        };
        Insert: {
          co_occurrence_count?: number;
          created_at?: string;
          id?: number;
          relationship_type: string;
          source?: string;
          source_tag: string;
          target_tag: string;
          updated_at?: string;
          user_id: string;
          weight?: number;
        };
        Update: {
          co_occurrence_count?: number;
          created_at?: string;
          id?: number;
          relationship_type?: string;
          source?: string;
          source_tag?: string;
          target_tag?: string;
          updated_at?: string;
          user_id?: string;
          weight?: number;
        };
        Relationships: [];
      };
      /** AI Token 使用记录表 */
      token_usage_logs: {
        Row: {
          id: string;
          user_id: string;
          request_id: string;
          model: string;
          tier_id: string;
          input_tokens: number;
          output_tokens: number;
          total_tokens: number;
          cost: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          request_id: string;
          model: string;
          tier_id: string;
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          cost?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          request_id?: string;
          model?: string;
          tier_id?: string;
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          cost?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      /** AI 偏好变更审计日志 */
      ai_preferences_audit_log: {
        Row: {
          id: string;
          user_id: string;
          change_type: string;
          old_value: Json | null;
          new_value: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          change_type: string;
          old_value?: Json | null;
          new_value?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          change_type?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      universal_categories: {
        Row: {
          category_group: Database["public"]["Enums"]["classification_category_group"];
          created_at: string;
          icon: string;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          suggested_folder_name: string;
          synonyms: string[];
          updated_at: string;
        };
        Insert: {
          category_group: Database["public"]["Enums"]["classification_category_group"];
          created_at?: string;
          icon?: string;
          id: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          suggested_folder_name: string;
          synonyms?: string[];
          updated_at?: string;
        };
        Update: {
          category_group?: Database["public"]["Enums"]["classification_category_group"];
          created_at?: string;
          icon?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          suggested_folder_name?: string;
          synonyms?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      user_custom_interests: {
        Row: {
          created_at: string | null;
          icon: string;
          id: string;
          keywords: string[] | null;
          name: string;
          suggested_folders: string[] | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          icon?: string;
          id?: string;
          keywords?: string[] | null;
          name: string;
          suggested_folders?: string[] | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          icon?: string;
          id?: string;
          keywords?: string[] | null;
          name?: string;
          suggested_folders?: string[] | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_trust_mode: {
        Row: {
          auto_decisions_count: number;
          created_at: string;
          id: number;
          mode_history: Json;
          overrides: Json;
          pending_confirmations_count: number;
          trust_mode: string;
          updated_at: string;
          user_corrections_count: number;
          user_id: string;
        };
        Insert: {
          auto_decisions_count?: number;
          created_at?: string;
          id?: number;
          mode_history?: Json;
          overrides?: Json;
          pending_confirmations_count?: number;
          trust_mode?: string;
          updated_at?: string;
          user_corrections_count?: number;
          user_id: string;
        };
        Update: {
          auto_decisions_count?: number;
          created_at?: string;
          id?: number;
          mode_history?: Json;
          overrides?: Json;
          pending_confirmations_count?: number;
          trust_mode?: string;
          updated_at?: string;
          user_corrections_count?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      validation_history: {
        Row: {
          average_response_time_ms: number | null;
          completed_at: string | null;
          created_at: string | null;
          duration_ms: number | null;
          error_count: number;
          id: number;
          invalid_bookmarks: Json | null;
          invalid_count: number;
          skipped_count: number;
          skipped_reasons: Json | null;
          started_at: string;
          total_bookmarks: number;
          total_checked: number;
          user_id: string;
          valid_count: number;
        };
        Insert: {
          average_response_time_ms?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          duration_ms?: number | null;
          error_count: number;
          id?: number;
          invalid_bookmarks?: Json | null;
          invalid_count: number;
          skipped_count: number;
          skipped_reasons?: Json | null;
          started_at: string;
          total_bookmarks: number;
          total_checked: number;
          user_id: string;
          valid_count: number;
        };
        Update: {
          average_response_time_ms?: number | null;
          completed_at?: string | null;
          created_at?: string | null;
          duration_ms?: number | null;
          error_count?: number;
          id?: number;
          invalid_bookmarks?: Json | null;
          invalid_count?: number;
          skipped_count?: number;
          skipped_reasons?: Json | null;
          started_at?: string;
          total_bookmarks?: number;
          total_checked?: number;
          user_id?: string;
          valid_count?: number;
        };
        Relationships: [];
      };
      /**
       * 用户标签表 - 存储用户创建的标签
       * 注意：此表定义为手动增补，用于支持 SmartTaggingSkill 等功能
       */
      tags: {
        Row: {
          id: number;
          user_id: string;
          name: string;
          color: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          name: string;
          color?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          name?: string;
          color?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * 书签-标签关联表 - 存储书签与标签的多对多关系
       * 注意：此表定义为手动增补，用于支持 SmartTaggingSkill 等功能
       */
      bookmark_tags: {
        Row: {
          id: number;
          bookmark_id: number;
          tag_id: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          bookmark_id: number;
          tag_id: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          bookmark_id?: number;
          tag_id?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookmark_tags_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmark_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      classification_metrics_daily: {
        Row: {
          acceptance_rate: number | null;
          ai_call_rate: number | null;
          avg_confidence: number | null;
          avg_execution_time_ms: number | null;
          cache_hit_rate: number | null;
          date: string | null;
          feedback_count: number | null;
          inbox_count: number | null;
          median_confidence: number | null;
          p95_execution_time_ms: number | null;
          tier1_count: number | null;
          tier2_count: number | null;
          tier3_count: number | null;
          total_count: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      classification_metrics_summary: {
        Row: {
          acceptance_rate: number | null;
          ai_call_rate: number | null;
          ai_skip_rate: number | null;
          avg_confidence: number | null;
          avg_execution_time_ms: number | null;
          cache_hit_rate: number | null;
          date: string | null;
          feedback_count: number | null;
          inbox_count: number | null;
          p95_execution_time_ms: number | null;
          tier1_count: number | null;
          tier2_count: number | null;
          tier3_count: number | null;
          total_count: number | null;
          unique_users: number | null;
        };
        Relationships: [];
      };
      classification_stats: {
        Row: {
          custom_interests: number | null;
          pending_suggestions: number | null;
          profiled_folders: number | null;
          stage: string | null;
          total_bookmarks: number | null;
          total_folders: number | null;
          user_id: string | null;
        };
        Insert: {
          custom_interests?: never;
          pending_suggestions?: never;
          profiled_folders?: never;
          stage?: never;
          total_bookmarks?: never;
          total_folders?: never;
          user_id?: string | null;
        };
        Update: {
          custom_interests?: never;
          pending_suggestions?: never;
          profiled_folders?: never;
          stage?: never;
          total_bookmarks?: never;
          total_folders?: never;
          user_id?: string | null;
        };
        Relationships: [];
      };
      embedding_ab_test_summary: {
        Row: {
          ab_test_group: string | null;
          acceptance_rate: number | null;
          avg_execution_time_ms: number | null;
          avg_token_count: number | null;
          date: string | null;
          feedback_count: number | null;
          median_execution_time_ms: number | null;
          model_id: string | null;
          operation_type: string | null;
          p95_execution_time_ms: number | null;
          total_count: number | null;
        };
        Relationships: [];
      };
      embedding_stats: {
        Row: {
          bookmarks_with_embedding: number | null;
          bookmarks_without_embedding: number | null;
          embedding_coverage_percent: number | null;
          total_bookmarks: number | null;
        };
        Relationships: [];
      };
      folder_stats: {
        Row: {
          bookmark_count: number | null;
          folder_id: number | null;
          today_count: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      llm_usage_daily: {
        Row: {
          avg_execution_time_ms: number | null;
          call_count: number | null;
          date: string | null;
          model: string | null;
          operation: string | null;
          total_cost_cents: number | null;
          total_input_tokens: number | null;
          total_output_tokens: number | null;
          total_tokens: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      llm_usage_monthly: {
        Row: {
          analysis_calls: number | null;
          call_count: number | null;
          chat_calls: number | null;
          classification_calls: number | null;
          month: string | null;
          naming_calls: number | null;
          total_cost_cents: number | null;
          total_input_tokens: number | null;
          total_output_tokens: number | null;
          total_tokens: number | null;
          user_id: string | null;
        };
        Relationships: [];
      };
      v_user_classification_stats: {
        Row: {
          accepted_count: number | null;
          avg_confidence: number | null;
          count: number | null;
          decision_type: string | null;
          rejected_count: number | null;
          user_action: string | null;
          user_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_classification_suggestions: {
        Args: { p_suggestion_ids: number[]; p_user_id: string };
        Returns: number;
      };
      add_custom_interest_atomic: {
        Args: {
          p_icon: string;
          p_keywords?: string[];
          p_max_count?: number;
          p_name: string;
          p_suggested_folders?: string[];
          p_user_id: string;
        };
        Returns: {
          created_at: string;
          error_code: string;
          icon: string;
          id: string;
          keywords: string[];
          name: string;
          suggested_folders: string[];
          updated_at: string;
          user_id: string;
        }[];
      };
      batch_add_tags: {
        Args: {
          p_bookmark_ids: number[];
          p_tags: string[];
        };
        Returns: {
          affected_ids: number[];
          affected_count: number;
        };
      };
      batch_remove_tags: {
        Args: {
          p_bookmark_ids: number[];
          p_tags: string[];
        };
        Returns: {
          affected_ids: number[];
          affected_count: number;
        };
      };
      assign_cluster_id: {
        Args: {
          p_bookmark_ids: number[];
          p_cluster_id: string;
          p_confidence: number;
        };
        Returns: number;
      };
      batch_reorder_folders: {
        Args: {
          p_updates: Array<{ id: number; sort_order: number }>;
          p_user_id: string;
        };
        Returns: {
          success: boolean;
          updatedCount?: number;
          requestedCount?: number;
          message?: string;
          error?: string;
        };
      };
      batch_upsert_knowledge_links: {
        Args: { p_links: Json; p_user_id: string };
        Returns: number;
      };
      calculate_matcher_weight_adjustments: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      can_create_snapshot: {
        Args: { p_estimated_size?: number; p_user_id: string };
        Returns: boolean;
      };
      check_bookmark_zone: {
        Args: { p_bookmark_embedding: string; p_folder_id: number };
        Returns: {
          confidence: number;
          core_distance: number;
          edge_distance: number;
          is_in_core: boolean;
          is_in_edge: boolean;
          zone: string;
        }[];
      };
      claim_next_job: {
        Args: {
          p_job_types?: string[];
          p_lock_duration?: unknown;
          p_worker_id: string;
        };
        Returns: {
          job_attempts: number;
          job_id: string;
          job_payload: Json;
          job_type: string;
          job_user_id: string;
        }[];
      };
      cleanup_expired_messages: { Args: never; Returns: number };
      /** 清理过期的会话记忆 - 仅授权 service_role */
      cleanup_expired_session_memory: {
        Args: Record<string, never>;
        Returns: number;
      };
      cleanup_old_chat_cache: { Args: { p_days?: number }; Returns: number };
      cleanup_old_patrol_reports: { Args: never; Returns: undefined };
      clear_bookmark_pending_cluster: {
        Args: { p_bookmark_id: number; p_user_id: string };
        Returns: boolean;
      };
      complete_job: {
        Args: { p_job_id: string; p_result?: Json };
        Returns: boolean;
      };
      compute_folder_heat: { Args: { p_folder_id: number }; Returns: number };
      compute_folder_profile: {
        Args: { p_folder_id: number };
        Returns: undefined;
      };
      compute_user_folder_profiles: {
        Args: { p_user_id: string };
        Returns: number;
      };
      decrement_storage_used:
        | { Args: { target_user_id: string }; Returns: undefined }
        | {
            Args: { decrement_by?: number; target_user_id: string };
            Returns: undefined;
          };
      delete_bookmark_links: {
        Args: { p_bookmark_id: number };
        Returns: number;
      };
      delete_folder_cascade: {
        Args: {
          p_delete_bookmarks?: boolean;
          p_folder_id: number;
          p_user_id: string;
        };
        Returns: {
          success: boolean;
          folderName?: string;
          folderId?: number;
          deletedBookmarks?: number;
          error?: string;
        };
      };
      discover_bookmark_links: {
        Args: { p_bookmark_id: number; p_options?: Json; p_user_id: string };
        Returns: {
          evidence: Json;
          link_type: string;
          related_bookmark_id: number;
          strength: number;
        }[];
      };
      enqueue_job: {
        Args: {
          p_payload?: Json;
          p_priority?: number;
          p_scheduled_at?: string;
          p_type: string;
          p_user_id: string;
        };
        Returns: string;
      };
      expire_old_suggestions: { Args: never; Returns: number };
      expire_pending_confirmations: { Args: never; Returns: number };
      fail_job: {
        Args: { p_error: string; p_job_id: string; p_retry?: boolean };
        Returns: boolean;
      };
      find_bookmarks_by_tags: {
        Args: {
          p_exclude_id?: number;
          p_limit?: number;
          p_min_shared?: number;
          p_tags: string[];
          p_user_id: string;
        };
        Returns: {
          bookmark_id: number;
          shared_count: number;
          shared_tags: string[];
          title: string;
        }[];
      };
      find_cross_folder_connections: {
        Args: {
          p_folder_id?: number;
          p_limit?: number;
          p_min_similarity?: number;
          p_user_id: string;
        };
        Returns: {
          similarity: number;
          source_bookmark_id: number;
          source_folder_id: number;
          source_folder_name: string;
          source_title: string;
          target_bookmark_id: number;
          target_folder_id: number;
          target_folder_name: string;
          target_title: string;
        }[];
      };
      find_related_bookmarks: {
        Args: {
          p_bookmark_id: number;
          p_exclude_same_folder?: boolean;
          p_limit?: number;
          p_min_similarity?: number;
          p_user_id: string;
        };
        Returns: {
          created_at: string;
          description: string;
          folder_id: number;
          folder_name: string;
          id: number;
          platform: string;
          similarity: number;
          title: string;
          url: string;
        }[];
      };
      find_similar_bookmarks_for_linking: {
        Args: {
          p_bookmark_id: number;
          p_limit?: number;
          p_min_similarity?: number;
          p_user_id: string;
        };
        Returns: {
          bookmark_id: number;
          similarity: number;
          title: string;
        }[];
      };
      find_similar_bookmarks_with_folders: {
        Args: {
          match_count?: number;
          p_user_id: string;
          query_embedding: string;
        };
        Returns: {
          bookmark_id: number;
          bookmark_title: string;
          folder_id: number;
          folder_name: string;
          similarity: number;
        }[];
      };
      get_active_operations: {
        Args: { p_limit?: number; p_user_id: string };
        Returns: {
          action: string;
          after_state: Json;
          before_state: Json;
          bookmark_ids: number[];
          can_undo: boolean;
          created_at: string;
          expires_at: string;
          folder_id: number;
          folder_ids: number[];
          id: string;
          reason: string;
        }[];
      };
      get_ai_folder_settings: { Args: { p_user_id: string }; Returns: Json };
      get_bookmark_links: {
        Args: {
          p_bookmark_id: number;
          p_limit?: number;
          p_link_types?: string[];
          p_min_strength?: number;
          p_user_id?: string;
        };
        Returns: {
          created_at: string;
          evidence: Json;
          link_id: string;
          link_type: string;
          related_bookmark_id: number;
          strength: number;
        }[];
      };
      get_bookmarks_pending_multi_vector: {
        Args: { p_limit?: number; p_user_id: string };
        Returns: {
          ai_summary: string;
          ai_tags: string[];
          bookmark_id: number;
          has_tag_embedding: boolean;
          has_title_embedding: boolean;
          title: string;
          user_tags: string[];
        }[];
      };
      get_folder_similarity_matrix: {
        Args: { p_min_bookmarks?: number; p_user_id: string };
        Returns: {
          avg_similarity: number;
          connection_count: number;
          folder1_count: number;
          folder1_id: number;
          folder1_name: string;
          folder2_count: number;
          folder2_id: number;
          folder2_name: string;
          max_similarity: number;
        }[];
      };
      get_knowledge_graph_stats: {
        Args: { p_user_id: string };
        Returns: {
          avg_links_per_bookmark: number;
          entity_links: number;
          medium_links: number;
          semantic_links: number;
          strong_links: number;
          tag_links: number;
          topic_links: number;
          total_bookmarks: number;
          total_links: number;
          weak_links: number;
        }[];
      };
      get_messages_count: {
        Args: { p_level?: string; p_status?: string; p_user_id: string };
        Returns: number;
      };
      get_messages_grouped: {
        Args: {
          p_level?: string;
          p_limit?: number;
          p_offset?: number;
          p_status?: string;
          p_user_id: string;
        };
        Returns: {
          action_label: string;
          action_url: string;
          content: string;
          created_at: string;
          date_group: string;
          id: number;
          level: string;
          metadata: Json;
          priority: number;
          read_at: string;
          related_bookmark_id: number;
          related_folder_id: number;
          status: string;
          title: string;
          type: string;
        }[];
      };
      get_messages_with_count: {
        Args: {
          p_level?: string;
          p_limit?: number;
          p_offset?: number;
          p_status?: string;
          p_user_id: string;
        };
        Returns: {
          action_label: string;
          action_url: string;
          content: string;
          created_at: string;
          date_group: string;
          id: number;
          level: string;
          metadata: Json;
          priority: number;
          read_at: string;
          related_bookmark_id: number;
          related_folder_id: number;
          status: string;
          title: string;
          total_count: number;
          type: string;
        }[];
      };
      get_or_create_inbox_folder: {
        Args: { p_user_id?: string };
        Returns: number;
      };
      /** 获取或创建会话记忆记录 - 已授权 authenticated */
      get_or_create_session_memory: {
        Args: { p_user_id: string; p_conversation_id: string };
        Returns: {
          id: string;
          user_id: string;
          conversation_id: string;
          state: Json;
          message_count: number;
          last_intent: string | null;
          created_at: string;
          updated_at: string;
          expires_at: string;
        };
      };
      get_pending_cluster_bookmarks: {
        Args: { p_limit?: number; p_min_age_hours?: number; p_user_id: string };
        Returns: {
          ai_summary: string;
          ai_tags: string[];
          cluster_id: string;
          embedding: string;
          id: number;
          pending_since: string;
          title: string;
          url: string;
        }[];
      };
      get_pending_confirmation_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_pending_suggestions_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_related_bookmarks_with_details: {
        Args: {
          p_bookmark_id: number;
          p_limit?: number;
          p_link_types?: string[];
          p_min_strength?: number;
          p_user_id: string;
        };
        Returns: {
          bookmark_id: number;
          created_at: string;
          favicon: string;
          link_type: string;
          platform: string;
          shared_items: string[];
          strength: number;
          title: string;
          url: string;
        }[];
      };
      get_related_tags: {
        Args: { p_limit?: number; p_tag: string; p_user_id: string };
        Returns: {
          co_occurrence_count: number;
          related_tag: string;
          relationship_type: string;
          weight: number;
        }[];
      };
      get_system_folder_name: {
        Args: { p_locale?: string; p_system_type: string };
        Returns: string;
      };
      get_tag_synonyms: {
        Args: { p_tag: string; p_user_id: string };
        Returns: {
          synonym: string;
          weight: number;
        }[];
      };
      get_unread_message_counts: {
        Args: { p_user_id: string };
        Returns: {
          important: number;
          normal: number;
          silent: number;
          total: number;
        }[];
      };
      get_folder_bookmark_stats: {
        Args: {
          p_folder_ids: number[];
          p_today_start: string;
          p_user_id: string;
        };
        Returns: {
          bookmark_count: number;
          folder_id: number;
          today_count: number;
        }[];
      };
      get_user_chat_stats: {
        Args: { p_end_date?: string; p_start_date?: string; p_user_id: string };
        Returns: {
          active_days: number;
          avg_tokens_per_chat: number;
          total_conversations: number;
          total_tokens: number;
        }[];
      };
      /** 获取用户的活跃会话列表 - 已授权 authenticated */
      get_user_active_sessions: {
        Args: { p_user_id: string };
        Returns: {
          conversation_id: string;
          message_count: number;
          last_intent: string | null;
          created_at: string;
          updated_at: string;
          expires_in: unknown;
        }[];
      };
      /** 获取用户的 AI 使用统计 */
      get_user_ai_stats: {
        Args: { p_user_id: string; p_days?: number };
        Returns: {
          total_conversations: number;
          total_messages: number;
          total_skill_executions: number;
          total_tokens_used: number;
          avg_latency_ms: number;
          success_rate: number;
        }[];
      };
      /** 清理过期的 AI 会话消息 */
      cleanup_old_ai_messages: {
        Args: { p_days?: number };
        Returns: number;
      };
      /** 清理过期的 AI 操作快照 */
      cleanup_expired_ai_snapshots: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      /** 获取用户的 AI 反馈统计 */
      get_ai_feedback_stats: {
        Args: { p_user_id: string };
        Returns: {
          total_count: number;
          positive_count: number;
          negative_count: number;
          satisfaction_rate: number;
        }[];
      };
      /** 获取负反馈原因分布（用于改进 AI） */
      get_negative_feedback_reasons: {
        Args: { p_limit?: number };
        Returns: {
          reason: string;
          count: number;
          percentage: number;
        }[];
      };
      /** 获取用户可撤销的 AI 操作列表 */
      get_undoable_ai_operations: {
        Args: { p_user_id: string; p_limit?: number };
        Returns: {
          id: string;
          operation_type: string;
          bookmark_count: number;
          summary: string | null;
          created_at: string;
          expires_at: string;
          time_remaining: unknown;
        }[];
      };
      /** 撤销指定的 AI 操作，恢复书签到操作前状态 */
      undo_ai_operation: {
        Args: { p_snapshot_id: string; p_user_id: string };
        Returns: {
          success: boolean;
          restored_count: number;
          message: string;
        }[];
      };
      get_user_classification_stage: {
        Args: { p_user_id: string };
        Returns: string;
      };
      get_user_cluster_stats: {
        Args: { p_user_id: string };
        Returns: {
          cluster_count: number;
          clustered_count: number;
          oldest_pending: string;
          total_pending: number;
          unclustered_count: number;
        }[];
      };
      get_user_daily_llm_cost: {
        Args: { p_date?: string; p_user_id: string };
        Returns: {
          total_calls: number;
          total_cost_cents: number;
          total_tokens: number;
        }[];
      };
      get_user_folder_stats: {
        Args: { p_user_id: string };
        Returns: {
          can_create_more: boolean;
          daily_remaining: number;
          folders_today: number;
          total_folders: number;
        }[];
      };
      get_user_hot_tags: {
        Args: { p_limit?: number; p_user_id: string };
        Returns: {
          count: number;
          tag: string;
        }[];
      };
      get_user_knowledge_links: {
        Args: {
          p_include_isolated?: boolean;
          p_link_types?: string[];
          p_max_nodes?: number;
          p_min_strength?: number;
          p_user_id: string;
        };
        Returns: {
          bookmark_id: number;
          favicon: string;
          link_count: number;
          links: Json;
          platform: string;
          title: string;
          url: string;
        }[];
      };
      get_user_snapshot_quota: {
        Args: { p_user_id: string };
        Returns: {
          max_count: number;
          membership: string;
          quota_bytes: number;
          used_bytes: number;
          used_count: number;
        }[];
      };
      get_user_snapshot_storage: {
        Args: { p_user_id: string };
        Returns: number;
      };
      /** 获取用户 Token 使用统计 */
      get_user_token_stats: {
        Args: {
          p_user_id: string;
          p_today_start?: string;
          p_month_start?: string;
        };
        Returns: Json;
      };
      get_user_trust_mode: { Args: { p_user_id: string }; Returns: Json };
      get_vision_tags: { Args: { vision_data: Json }; Returns: string[] };
      get_wechat_article_stats: {
        Args: { p_user_id: string };
        Returns: {
          failed_images: number;
          storage_used: number;
          success_images: number;
          total_articles: number;
          total_images: number;
        }[];
      };
      has_pending_job: {
        Args: {
          p_payload_key?: string;
          p_payload_value?: string;
          p_type: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      has_vision_analysis: { Args: { vision_data: Json }; Returns: boolean };
      increment_chat_usage: {
        Args: { p_date: string; p_tokens?: number; p_user_id: string };
        Returns: undefined;
      };
      increment_storage_used: {
        Args: { target_user_id: string };
        Returns: undefined;
      };
      increment_snapshot_version: {
        Args: { p_snapshot_id: number };
        Returns: number;
      };
      increment_tag_cooccurrence: {
        Args: {
          p_relationship_type?: string;
          p_source_tag: string;
          p_target_tag: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      init_smart_list_presets: { Args: { p_user_id: string }; Returns: number };
      mark_bookmark_pending_cluster: {
        Args: { p_bookmark_id: number; p_user_id: string };
        Returns: boolean;
      };
      mark_messages_read: {
        Args: { p_message_ids?: number[]; p_user_id: string };
        Returns: number;
      };
      mark_operation_undone: {
        Args: { p_operation_id: string; p_user_id: string };
        Returns: boolean;
      };
      merge_folders_atomic: {
        Args: {
          p_source_folder_id: number;
          p_target_folder_id: number;
          p_user_id: string;
        };
        Returns: {
          success: boolean;
          bookmarksMoved?: number;
          sourceFolderName?: string;
          targetFolderName?: string;
          sourceFolderId?: number;
          targetFolderId?: number;
          error?: string;
        };
      };
      record_classification_metrics: {
        Args: {
          p_action?: string;
          p_ai_called?: boolean;
          p_ai_score?: number;
          p_bookmark_id?: number;
          p_bookmark_url?: string;
          p_cache_hit?: boolean;
          p_confidence?: number;
          p_decision_reason?: string;
          p_execution_time_ms?: number;
          p_folder_id?: number;
          p_folder_name?: string;
          p_history_score?: number;
          p_match_type?: string;
          p_tier?: number;
          p_tier0_time_ms?: number;
          p_tier1_time_ms?: number;
          p_tier2_time_ms?: number;
          p_tier3_time_ms?: number;
          p_trace_id?: string;
          p_user_id: string;
          p_vector_score?: number;
        };
        Returns: number;
      };
      record_llm_usage: {
        Args: {
          p_cost_cents?: number;
          p_execution_time_ms?: number;
          p_input_tokens: number;
          p_metadata?: Json;
          p_model: string;
          p_operation: string;
          p_output_tokens: number;
          p_request_id?: string;
          p_user_id: string;
        };
        Returns: number;
      };
      reject_classification_suggestions: {
        Args: { p_suggestion_ids: number[]; p_user_id: string };
        Returns: number;
      };
      /** 保存会话状态到数据库 - 已授权 authenticated */
      save_session_state: {
        Args: {
          p_user_id: string;
          p_conversation_id: string;
          p_state: Json;
          p_message_count?: number;
          p_last_intent?: string | null;
        };
        Returns: boolean;
      };
      search_bookmarks_by_embedding: {
        Args: {
          match_count?: number;
          match_threshold?: number;
          p_folder_id?: number;
          p_user_id?: string;
          query_embedding: string;
        };
        Returns: {
          ai_summary: string;
          ai_tags: string[];
          created_at: string;
          description: string;
          folder_id: number;
          folder_name: string;
          id: number;
          platform: string;
          similarity: number;
          title: string;
          url: string;
        }[];
      };
      search_bookmarks_by_tag_vector: {
        Args: {
          p_limit?: number;
          p_min_similarity?: number;
          p_query_embedding: string;
          p_user_id: string;
        };
        Returns: {
          ai_tags: string[];
          bookmark_id: number;
          folder_id: number;
          similarity: number;
          title: string;
          user_tags: string[];
        }[];
      };
      search_bookmarks_by_title_vector: {
        Args: {
          p_limit?: number;
          p_min_similarity?: number;
          p_query_embedding: string;
          p_user_id: string;
        };
        Returns: {
          bookmark_id: number;
          folder_id: number;
          folder_name: string;
          similarity: number;
          title: string;
        }[];
      };
      search_bookmarks_hybrid: {
        Args: {
          keyword_weight?: number;
          match_count?: number;
          p_user_id: string;
          query_embedding: string;
          query_text: string;
          vector_weight?: number;
        };
        Returns: {
          ai_summary: string;
          combined_score: number;
          folder_name: string;
          id: number;
          keyword_score: number;
          title: string;
          url: string;
          vector_score: number;
        }[];
      };
      search_bookmarks_multi_vector: {
        Args: {
          p_content_weight?: number;
          p_limit?: number;
          p_min_similarity?: number;
          p_query_embedding: string;
          p_tag_weight?: number;
          p_title_weight?: number;
          p_user_id: string;
        };
        Returns: {
          bookmark_id: number;
          content_similarity: number;
          folder_id: number;
          folder_name: string;
          tag_similarity: number;
          title: string;
          title_similarity: number;
          weighted_similarity: number;
        }[];
      };
      search_bookmarks_semantic: {
        Args: {
          match_count?: number;
          match_threshold?: number;
          p_user_id: string;
          query_embedding: string;
        };
        Returns: {
          ai_summary: string;
          ai_tags: string[];
          author: string;
          content_type: string;
          cover_url: string;
          created_at: string;
          description: string;
          folder_id: number;
          id: number;
          notes: string;
          platform: string;
          publish_time: string;
          similarity: number;
          title: string;
          updated_at: string;
          url: string;
          user_tags: string[];
        }[];
      };
      search_folders_by_core_similarity: {
        Args: {
          p_limit?: number;
          p_min_similarity?: number;
          p_query_embedding: string;
          p_user_id: string;
        };
        Returns: {
          confidence_level: string;
          core_similarity: number;
          edge_similarity: number;
          folder_id: number;
          folder_name: string;
          zone_match: string;
        }[];
      };
      search_folders_unified: {
        Args: { p_embedding: string; p_limit?: number; p_user_id: string };
        Returns: {
          bookmark_count: number;
          folder_id: number;
          folder_name: string;
          match_type: string;
          similarity: number;
          top_tags: string[];
        }[];
      };
      search_similar_folders: {
        Args: {
          match_count?: number;
          match_threshold?: number;
          p_user_id: string;
          query_embedding: string;
        };
        Returns: {
          bookmark_count: number;
          folder_id: number;
          folder_name: string;
          sample_titles: string[];
          similarity: number;
          top_tags: string[];
        }[];
      };
      update_ai_folder_settings: {
        Args: { p_settings: Json; p_user_id: string };
        Returns: Json;
      };
      /** 更新用户 AI 学习偏好（仅更新 learned 部分） */
      update_ai_learned_preferences: {
        Args: { p_user_id: string; p_learned: Json };
        Returns: undefined;
      };
      update_folder_heat: { Args: { p_folder_id: number }; Returns: undefined };
      update_folder_name_embedding: {
        Args: { p_folder_id: number; p_name_embedding: string };
        Returns: undefined;
      };
      update_user_folder_heats: {
        Args: { p_user_id: string };
        Returns: number;
      };
      update_user_trust_mode: {
        Args: { p_reason?: string; p_trust_mode: string; p_user_id: string };
        Returns: Json;
      };
      upsert_knowledge_link: {
        Args: {
          p_algorithm?: string;
          p_bookmark_id_1: number;
          p_bookmark_id_2: number;
          p_evidence: Json;
          p_link_type: string;
          p_strength: number;
          p_user_id: string;
        };
        Returns: string;
      };
      upsert_source_profile: {
        Args: {
          p_confidence?: number;
          p_folder_id?: number;
          p_source_id: string;
          p_source_name?: string;
          p_source_type?: string;
          p_user_id: string;
        };
        Returns: number;
      };
    };
    Enums: {
      classification_category_group:
        | "tech"
        | "design"
        | "business"
        | "content"
        | "lifestyle"
        | "learning"
        | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      classification_category_group: [
        "tech",
        "design",
        "business",
        "content",
        "lifestyle",
        "learning",
        "other",
      ],
    },
  },
} as const;

// ============================================================================
// Custom Type Definitions (Project-specific)
// ============================================================================

/**
 * Platform type definition
 * Includes both content platforms and browser platforms
 */
export type Platform =
  | "WECHAT_OFFICIAL_ACCOUNT"
  | "BILIBILI"
  | "XIAOHONGSHU"
  | "BROWSER_CHROME"
  | "BROWSER_EDGE"
  | "BROWSER_FIREFOX"
  | "BROWSER_SAFARI"
  | "UNKNOWN";

/**
 * Browser platforms list
 */
export const BROWSER_PLATFORMS: Platform[] = [
  "BROWSER_CHROME",
  "BROWSER_EDGE",
  "BROWSER_FIREFOX",
  "BROWSER_SAFARI",
];

/**
 * Content platforms list
 */
export const CONTENT_PLATFORMS: Platform[] = [
  "WECHAT_OFFICIAL_ACCOUNT",
  "BILIBILI",
  "XIAOHONGSHU",
];

/**
 * All supported platforms
 */
export const ALL_PLATFORMS: Platform[] = [
  ...CONTENT_PLATFORMS,
  ...BROWSER_PLATFORMS,
];

// ============================================================================
// Folder Type Definitions
// ============================================================================

/**
 * Folder type alias
 */
export type Folder = Tables<"folders">;
export type FolderInsert = TablesInsert<"folders">;
export type FolderUpdate = TablesUpdate<"folders">;

/**
 * Bookmark type alias
 */
export type Bookmark = Tables<"bookmarks">;
export type BookmarkInsert = TablesInsert<"bookmarks">;
export type BookmarkUpdate = TablesUpdate<"bookmarks">;

/**
 * FolderGroup: 数据库中有效的文件夹分组值（与 CHECK 约束一致）
 */
export type FolderGroup = "work" | "study" | "life" | "entertainment" | "other";

/**
 * FolderDisplayGroup: UI 显示用的分组（包含虚拟分组）
 */
export type FolderDisplayGroup =
  | FolderGroup
  | "default"
  | "pinned"
  | "archived";

// ============================================================================
// RPC Function Types (for transaction functions)
// ============================================================================

/**
 * merge_folders_atomic 返回类型
 */
export interface MergeFoldersAtomicResult {
  success: boolean;
  error?: string;
  bookmarksMoved?: number;
  sourceFolderName?: string;
  targetFolderName?: string;
  sourceFolderId?: number;
  targetFolderId?: number;
}

/**
 * batch_reorder_folders 返回类型
 */
export interface BatchReorderFoldersResult {
  success: boolean;
  updatedCount: number;
  requestedCount?: number;
  error?: string;
  message?: string;
}

/**
 * delete_folder_cascade 返回类型
 */
export interface DeleteFolderCascadeResult {
  success: boolean;
  folderName?: string;
  folderId?: number;
  deletedBookmarks?: number;
  bookmarkCount?: number;
  error?: string;
}

// ============================================================================
// Additional Table Types
// ============================================================================

export type Profile = Tables<"profiles">;
export type ProfileInsert = TablesInsert<"profiles">;
export type ProfileUpdate = TablesUpdate<"profiles">;

export type ImportHistory = Tables<"import_history">;
export type ImportHistoryInsert = TablesInsert<"import_history">;

export type ClassificationSuggestion = Tables<"classification_suggestions">;
export type ClassificationSuggestionInsert =
  TablesInsert<"classification_suggestions">;

export type ClassificationFeedback = Tables<"classification_feedback">;
export type ClassificationFeedbackInsert =
  TablesInsert<"classification_feedback">;

export type ClassificationDecision = Tables<"classification_decisions">;
export type OperationSnapshot = Tables<"operation_snapshots">;
export type FolderProfile = Tables<"folder_profiles">;

// ============================================================================
// Enum Types (String Union Types)
// ============================================================================

/** 导入来源 */
export type ImportSource =
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "file"
  | "manual"
  | "browser_chrome"
  | "browser_edge"
  | "browser_firefox"
  | "browser_safari"
  | "api"
  | "share_sheet";

/** 建议状态 */
export type SuggestionStatus = "pending" | "accepted" | "rejected" | "expired";

/** 分类状态 */
export type ClassificationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "classified"
  | "suggested"
  | "inbox";

/** 会员类型 */
export type MembershipType =
  | "free"
  | "pro"
  | "premium"
  | "FREE"
  | "PRO"
  | "PREMIUM";

/** 操作快照动作类型 */
export type OperationSnapshotAction =
  | "create"
  | "split"
  | "merge"
  | "rename"
  | "move"
  | "delete";

/** 聚类处理状态 */
export interface ClusterProcessingStatus {
  pendingClusterCount: number;
  clusterCount: number;
  lastProcessedAt: Date | null;
  nextScheduledAt: Date;
  hasPendingSuggestions: boolean;
}

/** 聚类处理状态字符串 */
export type ClusterProcessingStatusString =
  | "pending"
  | "processing"
  | "completed"
  | "skipped";

// ============================================================================
// Business Interface Types
// ============================================================================

/** 自定义标签颜色 */
export type CustomTagColor =
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple"
  | "pink"
  | "orange"
  | "cyan"
  | "indigo"
  | "sky"
  | "lime"
  | "amber"
  | "rose"
  | "violet"
  | "teal"
  | "emerald"
  | "fuchsia"
  | "slate"
  | "zinc";

/** 自定义用途标签 */
export interface CustomUsageTag {
  id: string;
  name?: string;
  label?: string;
  value: string;
  color: CustomTagColor;
  createdAt: string;
  lastUsedAt?: string;
}

/** 自定义标签颜色配置 */
export const CUSTOM_TAG_COLORS: Record<
  CustomTagColor,
  { light: string; dark: string; border: string }
> = {
  blue: {
    light: "bg-blue-100",
    dark: "bg-blue-900/30",
    border: "border-blue-300",
  },
  green: {
    light: "bg-green-100",
    dark: "bg-green-900/30",
    border: "border-green-300",
  },
  yellow: {
    light: "bg-yellow-100",
    dark: "bg-yellow-900/30",
    border: "border-yellow-300",
  },
  red: { light: "bg-red-100", dark: "bg-red-900/30", border: "border-red-300" },
  purple: {
    light: "bg-purple-100",
    dark: "bg-purple-900/30",
    border: "border-purple-300",
  },
  pink: {
    light: "bg-pink-100",
    dark: "bg-pink-900/30",
    border: "border-pink-300",
  },
  orange: {
    light: "bg-orange-100",
    dark: "bg-orange-900/30",
    border: "border-orange-300",
  },
  cyan: {
    light: "bg-cyan-100",
    dark: "bg-cyan-900/30",
    border: "border-cyan-300",
  },
  indigo: {
    light: "bg-indigo-100",
    dark: "bg-indigo-900/30",
    border: "border-indigo-300",
  },
  sky: { light: "bg-sky-100", dark: "bg-sky-900/30", border: "border-sky-300" },
  lime: {
    light: "bg-lime-100",
    dark: "bg-lime-900/30",
    border: "border-lime-300",
  },
  amber: {
    light: "bg-amber-100",
    dark: "bg-amber-900/30",
    border: "border-amber-300",
  },
  rose: {
    light: "bg-rose-100",
    dark: "bg-rose-900/30",
    border: "border-rose-300",
  },
  violet: {
    light: "bg-violet-100",
    dark: "bg-violet-900/30",
    border: "border-violet-300",
  },
  teal: {
    light: "bg-teal-100",
    dark: "bg-teal-900/30",
    border: "border-teal-300",
  },
  emerald: {
    light: "bg-emerald-100",
    dark: "bg-emerald-900/30",
    border: "border-emerald-300",
  },
  fuchsia: {
    light: "bg-fuchsia-100",
    dark: "bg-fuchsia-900/30",
    border: "border-fuchsia-300",
  },
  slate: {
    light: "bg-slate-100",
    dark: "bg-slate-900/30",
    border: "border-slate-300",
  },
  zinc: {
    light: "bg-zinc-100",
    dark: "bg-zinc-900/30",
    border: "border-zinc-300",
  },
};

/** 自定义标签颜色列表（用于遍历和 includes 检查） */
export const CUSTOM_TAG_COLOR_LIST: CustomTagColor[] = [
  "blue",
  "green",
  "yellow",
  "red",
  "purple",
  "pink",
  "orange",
  "cyan",
  "indigo",
  "sky",
  "lime",
  "amber",
  "rose",
  "violet",
  "teal",
  "emerald",
  "fuchsia",
  "slate",
  "zinc",
];

/** 自定义标签数量限制 */
export const CUSTOM_USAGE_TAG_LIMIT = 10;

/** 用户配置设置 */
export interface ProfileSettings {
  customUsageTags?: CustomUsageTag[];
  theme?: "light" | "dark" | "system";
  language?: string;
  aiEvolutionLevel?: "manual" | "semi" | "auto";
  [key: string]: unknown;
}

/** 重分类设置 */
export interface ReclassifySettings {
  enabled: boolean;
  autoAcceptThreshold: number;
  notifyOnSuggestion: boolean;
  inbox_threshold?: number;
  last_run_at?: string | null;
  auto_run_weekly?: boolean;
}

/** 导入错误详情 */
export interface ImportErrorDetail {
  url: string;
  title?: string;
  error?: string;
  reason?: string;
  timestamp?: string;
}

/** 操作历史详情（用于 UI 展示） */
export interface OperationDetail {
  id: string;
  action: OperationSnapshotAction;
  folder_id: number | null;
  folder_ids: number[] | null;
  bookmark_ids: number[] | null;
  before_state: Json;
  after_state: Json;
  reason: string | null;
  is_undone: boolean;
  created_at: string;
  expires_at: string;
  can_undo?: boolean;
}

/** 文件夹树节点 */
export interface FolderTreeNode {
  id: number;
  name: string;
  parent_id: number | null;
  children: FolderTreeNode[];
  bookmark_count?: number;
  is_system?: boolean;
  system_type?: string | null;
}

/** AI 文件夹设置 */
export interface AIFolderSettings {
  autoClassify?: boolean;
  autoCreateFolder?: boolean;
  confidenceThreshold?: number;
  maxFoldersPerDay?: number;
  aiEvolutionLevel?: "manual" | "semi" | "auto";
  autonomy_level?: number;
  enable_auto_create?: boolean;
  enable_auto_split?: boolean;
  enable_auto_merge?: boolean;
  enable_auto_rename?: boolean;
  create_notification?: boolean;
  report_interval?: string;
  daily_create_limit?: number;
}

/** 分类结果数据 */
export interface ClassificationResultData {
  folder_id?: number | null;
  folder_name?: string | null;
  folderId?: number | null;
  folderName?: string | null;
  confidence?: number;
  reason?: string;
  tier?: number;
  action?: string;
  matcher_scores?: Record<string, number>;
  ai_called?: boolean;
  timestamp?: string;
  suggestionId?: number;
  [key: string]: unknown;
}

/** 导入历史选项 */
export interface ImportHistoryOptions {
  preserveFolders?: boolean;
  skipDuplicates?: boolean;
  validateUrls?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// Classification JSON Field Types (V4.2.1)
// ============================================================================

/**
 * 分类候选文件夹
 * 用于: classification_decisions.candidates JSON 字段
 */
export interface ClassificationCandidate {
  /** 文件夹 ID */
  folderId: number;
  /** 文件夹名称 */
  folderName: string;
  /** 匹配得分 (0-100) */
  score: number;
  /** 匹配原因（可选） */
  reason?: string;
}

/**
 * 分类候选列表类型
 * 用于: classification_decisions.candidates JSON 字段
 */
export type ClassificationCandidates = ClassificationCandidate[];

/**
 * 匹配器评分记录
 * 用于: classification_decisions.matcher_scores, classification_result.matcher_scores
 *
 * Key: 匹配器名称 (如 'embedding', 'keyword', 'source')
 * Value: 匹配得分 (0-100)
 */
export type MatcherScores = Record<string, number>;

/**
 * 进化报告建议
 * 用于: folder_evolution_reports.suggestions_data JSON 字段
 */
export interface ReportSuggestion {
  /** 建议类型 */
  type: "merge" | "split" | "rename" | "cleanup";
  /** 建议描述 */
  description: string;
  /** 目标文件夹列表 */
  targetFolders: Array<{ id: number; name: string }>;
  /** 优先级 */
  priority: "high" | "medium" | "low";
}

/**
 * 建议数据列表类型
 * 用于: folder_evolution_reports.suggestions_data JSON 字段
 */
export type SuggestionsData = ReportSuggestion[];

/** 带快照的书签类型 */
export type BookmarkWithSnapshot = Bookmark & {
  latest_snapshot?: {
    id: string;
    html_content: string | null;
    created_at: string;
  } | null;
};

// ============================================================================
// WeChat Article Extended Types (V4.2)
// ============================================================================

/**
 * 微信文章图片处理状态
 */
export type WechatImageStatus = "pending" | "success" | "failed" | "fallback";

/**
 * 微信文章图片统计状态
 */
export type WechatImagesOverallStatus =
  | "pending"
  | "processing"
  | "completed"
  | "partial"
  | "failed";

/**
 * 样式保留级别
 */
export type StylePreserveLevel = "text-only" | "full-snapshot";

/**
 * 微信文章图片元数据
 */
export interface WechatArticleImageMeta {
  /** 原始图片 URL */
  originalUrl: string;
  /** 持久化后的 URL（上传到 Supabase Storage 后） */
  persistedUrl?: string | null;
  /** 图片 alt 文本 */
  alt?: string;
  /** 图片宽度 */
  width?: number;
  /** 图片高度 */
  height?: number;
  /** 处理状态 */
  status: WechatImageStatus;
  /** 错误信息（失败时） */
  error?: string;
}

/**
 * 微信文章图片统计信息
 */
export interface WechatImagesStats {
  /** 总图片数 */
  total: number;
  /** 已持久化数量 */
  persisted: number;
  /** 失败数量 */
  failed: number;
  /** 降级处理数量（使用 referrerPolicy） */
  fallback: number;
}

/**
 * 微信文章快照扩展类型
 * 包含 bookmark_snapshots 表的额外字段（用于微信文章功能）
 *
 * 注意：此类型用于服务层内部，解决 Supabase 自动生成类型不完整的问题
 * 当 Supabase 类型重新生成后，可考虑移除此类型
 */
export interface WechatArticleSnapshot {
  /** 快照 ID */
  id: number;
  /** 关联的书签 ID */
  bookmark_id: number;
  /** Readability 处理后的内容 */
  readable_content: string | null;
  /** 纯文本内容 */
  readable_text_content: string | null;
  /** 文章标题 */
  readable_title: string | null;
  /** 字数统计 */
  readable_word_count: number | null;
  /** 原始 URL */
  original_url: string | null;
  /** V4.2: 原始 HTML（用于样式重新处理） */
  original_html?: string | null;
  /** V4.2: 处理后的 HTML（内联样式版本） */
  processed_html?: string | null;
  /** V4.2: 内容版本号 */
  content_version?: number;
  /** V4.2: Markdown 内容 */
  content_markdown?: string | null;
  /** V4.2: 图片元数据数组 */
  article_images?: WechatArticleImageMeta[];
  /** V4.2: 图片处理状态 */
  images_status?: WechatImagesOverallStatus;
  /** V4.2: 图片统计信息 */
  images_stats?: WechatImagesStats;
  /** V4.2: 样式保留级别 */
  style_preserve_level?: StylePreserveLevel;
  /** 关联的书签信息（join 查询时） */
  bookmarks?: {
    url: string;
    platform: string;
  };
}

/**
 * get_wechat_article_stats RPC 函数返回类型
 */
export interface WechatArticleStatsResult {
  /** 微信文章总数 */
  total_articles: number;
  /** 图片总数 */
  total_images: number;
  /** 已持久化图片数 */
  persisted_images: number;
  /** 失败图片数 */
  failed_images: number;
  /** 总字数 */
  total_words: number;
  /** 存储使用量（MB） */
  storage_used_mb: number;
}
