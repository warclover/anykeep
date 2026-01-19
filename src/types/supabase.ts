// Supabase 类型定义
// 自动生成 + 手动维护的自定义类型
// 最后更新: 2026-01-04

// ============================================================================
// 自定义类型别名（供代码使用）
// ============================================================================

export type Platform =
  | "WECHAT_OFFICIAL_ACCOUNT"
  | "BILIBILI"
  | "XIAOHONGSHU"
  | "CHROME"
  | "EDGE"
  | "FIREFOX"
  | "SAFARI"
  | "BROWSER"
  | "BROWSER_CHROME"
  | "BROWSER_EDGE"
  | "BROWSER_FIREFOX"
  | "BROWSER_SAFARI"
  | "UNKNOWN";

export type ContentType = "ARTICLE" | "VIDEO" | "IMAGE" | "UNKNOWN";

export type BookmarkStatus = "PROCESSING" | "COMPLETED" | "FAILED";

export type MembershipType = "FREE" | "PRO" | "pro";

export type ImportSource =
  | "browser_chrome"
  | "browser_edge"
  | "browser_firefox"
  | "browser_safari"
  | "api"
  | "share_sheet"
  | "manual"
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "other";

export type FolderGroup = "work" | "study" | "life" | "entertainment" | "other";

// 导入历史选项
export interface ImportHistoryOptions {
  skipDuplicates?: boolean;
  preserveFolders?: boolean;
  preserveFolderStructure?: boolean;
  targetFolderId?: number | null;
  [key: string]: unknown;
}

export type OperationSnapshotAction =
  | "create"
  | "split"
  | "merge"
  | "rename"
  | "move"
  | "delete"
  | "update"
  | "archive"
  | "add_tag"
  | "remove_tag"
  | "batch_move"
  | "batch_tag"
  | "batch_delete"
  | "merge_folder"
  | "create_folder"
  | "rename_folder"
  | "delete_folder"
  | "undo";

export type SuggestionStatus = "pending" | "accepted" | "rejected" | "expired";

// Knowledge Studio 类型
export type SynthesisSourceType =
  | "folder"
  | "tag"
  | "selection"
  | "ai_recommend";

export type SynthesisDepthMode = "quick" | "standard" | "academic";

export type SynthesisStatus =
  | "pending"
  | "generating"
  | "completed"
  | "failed"
  | "cancelled";

export type MasteryLevel =
  | "unknown"
  | "learning"
  | "familiar"
  | "proficient"
  | "mastered";

export type ImpactLevel = "none" | "minor" | "moderate" | "major";

// Workflow 类型
export type WorkflowExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "waiting_confirmation";

export type WorkflowTriggerType =
  | "manual"
  | "event"
  | "schedule"
  | "conversation";

export type WorkflowCategory = "builtin" | "user_defined";

export type UpdateTaskStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type VersionSource =
  | "manual"
  | "incremental"
  | "full_regen"
  | "rollback";

export type TemplateVisibility = "private" | "shared" | "public";

export type TemplateStatus = "draft" | "active" | "archived";

export type UsageType =
  | "generation"
  | "chat_edit"
  | "ai_recommendation"
  | "export"
  | "storage";

export type BillingStatus =
  | "pending"
  | "paid"
  | "overdue"
  | "cancelled"
  | "refunded";

export type CheckInterval =
  | "every_6h"
  | "twice_daily"
  | "daily"
  | "weekly"
  | "custom";

export type MonitorStatus = "active" | "paused" | "failed" | "deleted";

export type CheckResult = "no_change" | "changed" | "failed" | "skipped";

// ============================================================================
// 自动生成的 Supabase 类型（以下由 Supabase CLI 生成）
// ============================================================================

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
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
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
      ai_conversation_summaries: {
        Row: {
          actions: Json | null;
          created_at: string | null;
          id: string;
          intents: string[] | null;
          learned_preferences: Json | null;
          message_count: number | null;
          pending_intents: string[] | null;
          sentiment: string | null;
          session_id: string;
          summary: string;
          user_id: string;
        };
        Insert: {
          actions?: Json | null;
          created_at?: string | null;
          id?: string;
          intents?: string[] | null;
          learned_preferences?: Json | null;
          message_count?: number | null;
          pending_intents?: string[] | null;
          sentiment?: string | null;
          session_id: string;
          summary: string;
          user_id: string;
        };
        Update: {
          actions?: Json | null;
          created_at?: string | null;
          id?: string;
          intents?: string[] | null;
          learned_preferences?: Json | null;
          message_count?: number | null;
          pending_intents?: string[] | null;
          sentiment?: string | null;
          session_id?: string;
          summary?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_conversations: {
        Row: {
          agent_type: string;
          context_bookmark_ids: number[] | null;
          context_folder_id: number | null;
          created_at: string;
          id: string;
          message_count: number;
          metadata: Json | null;
          status: string;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          agent_type?: string;
          context_bookmark_ids?: number[] | null;
          context_folder_id?: number | null;
          created_at?: string;
          id?: string;
          message_count?: number;
          metadata?: Json | null;
          status?: string;
          title?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          agent_type?: string;
          context_bookmark_ids?: number[] | null;
          context_folder_id?: number | null;
          created_at?: string;
          id?: string;
          message_count?: number;
          metadata?: Json | null;
          status?: string;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_context_folder_id_fkey";
            columns: ["context_folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
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
      ai_feedback: {
        Row: {
          classified_intent: string | null;
          conversation_id: string;
          created_at: string;
          execution_mode: string | null;
          id: string;
          message_id: string;
          negative_comment: string | null;
          negative_reason: string | null;
          original_message: string | null;
          skill_id: string | null;
          tool_used: string | null;
          type: string;
          user_id: string;
        };
        Insert: {
          classified_intent?: string | null;
          conversation_id: string;
          created_at?: string;
          execution_mode?: string | null;
          id?: string;
          message_id: string;
          negative_comment?: string | null;
          negative_reason?: string | null;
          original_message?: string | null;
          skill_id?: string | null;
          tool_used?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          classified_intent?: string | null;
          conversation_id?: string;
          created_at?: string;
          execution_mode?: string | null;
          id?: string;
          message_id?: string;
          negative_comment?: string | null;
          negative_reason?: string | null;
          original_message?: string | null;
          skill_id?: string | null;
          tool_used?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_intent_cache: {
        Row: {
          id: number;
          input_hash: string;
          normalized_input: string;
          original_message: string | null;
          intent_type: string;
          intent_subtype: string | null;
          confidence: number;
          method: string;
          slots: Json;
          message_embedding: string | null;
          hit_count: number;
          last_hit_at: string;
          created_at: string;
          updated_at: string | null;
          expires_at: string;
        };
        Insert: {
          id?: number;
          input_hash: string;
          normalized_input: string;
          original_message?: string | null;
          intent_type: string;
          intent_subtype?: string | null;
          confidence: number;
          method: string;
          slots?: Json;
          message_embedding?: string | null;
          hit_count?: number;
          last_hit_at?: string;
          created_at?: string;
          updated_at?: string | null;
          expires_at: string;
        };
        Update: {
          id?: number;
          input_hash?: string;
          normalized_input?: string;
          original_message?: string | null;
          intent_type?: string;
          intent_subtype?: string | null;
          confidence?: number;
          method?: string;
          slots?: Json;
          message_embedding?: string | null;
          hit_count?: number;
          last_hit_at?: string;
          created_at?: string;
          updated_at?: string | null;
          expires_at?: string;
        };
        Relationships: [];
      };
      ai_intent_feedback: {
        Row: {
          id: number;
          user_id: string;
          session_id: string;
          turn_id: string;
          original_input: string;
          predicted_type: string;
          predicted_subtype: string | null;
          predicted_confidence: number;
          actual_behavior: string;
          corrected_type: string | null;
          corrected_subtype: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          session_id: string;
          turn_id: string;
          original_input: string;
          predicted_type: string;
          predicted_subtype?: string | null;
          predicted_confidence: number;
          actual_behavior: string;
          corrected_type?: string | null;
          corrected_subtype?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          session_id?: string;
          turn_id?: string;
          original_input?: string;
          predicted_type?: string;
          predicted_subtype?: string | null;
          predicted_confidence?: number;
          actual_behavior?: string;
          corrected_type?: string | null;
          corrected_subtype?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_intent_pattern_suggestions: {
        Row: {
          id: number;
          type: string;
          subtype: string;
          pattern: string;
          weight: number;
          sample_inputs: string[];
          discovery_confidence: number;
          discovery_method: string;
          occurrence_count: number;
          status: string;
          approved_by: string | null;
          approved_at: string | null;
          rejection_reason: string | null;
          merged_into_id: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          type: string;
          subtype: string;
          pattern: string;
          weight?: number;
          sample_inputs?: string[];
          discovery_confidence: number;
          discovery_method?: string;
          occurrence_count?: number;
          status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          merged_into_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          type?: string;
          subtype?: string;
          pattern?: string;
          weight?: number;
          sample_inputs?: string[];
          discovery_confidence?: number;
          discovery_method?: string;
          occurrence_count?: number;
          status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          rejection_reason?: string | null;
          merged_into_id?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_system_config: {
        Row: {
          id: number;
          key: string;
          value: Json;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          key: string;
          value: Json;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          key?: string;
          value?: Json;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_user_shortcuts: {
        Row: {
          id: number;
          user_id: string;
          shortcut_phrase: string;
          intent_type: string;
          intent_subtype: string | null;
          default_slots: Json;
          usage_count: number;
          last_used_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          shortcut_phrase: string;
          intent_type: string;
          intent_subtype?: string | null;
          default_slots?: Json;
          usage_count?: number;
          last_used_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          shortcut_phrase?: string;
          intent_type?: string;
          intent_subtype?: string | null;
          default_slots?: Json;
          usage_count?: number;
          last_used_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_weight_history: {
        Row: {
          id: number;
          intent_type: string;
          intent_subtype: string | null;
          old_weight: number;
          new_weight: number;
          delta: number;
          reason: string;
          confidence: number;
          trigger_count: number;
          accuracy: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          intent_type: string;
          intent_subtype?: string | null;
          old_weight: number;
          new_weight: number;
          delta: number;
          reason: string;
          confidence: number;
          trigger_count: number;
          accuracy: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          intent_type?: string;
          intent_subtype?: string | null;
          old_weight?: number;
          new_weight?: number;
          delta?: number;
          reason?: string;
          confidence?: number;
          trigger_count?: number;
          accuracy?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_intent_history: {
        Row: {
          confidence: number | null;
          context: Json | null;
          created_at: string;
          id: string;
          intent_sub_type: string | null;
          intent_type: string;
          message_preview: string | null;
          satisfaction: number | null;
          success: boolean | null;
          user_id: string;
        };
        Insert: {
          confidence?: number | null;
          context?: Json | null;
          created_at?: string;
          id?: string;
          intent_sub_type?: string | null;
          intent_type: string;
          message_preview?: string | null;
          satisfaction?: number | null;
          success?: boolean | null;
          user_id: string;
        };
        Update: {
          confidence?: number | null;
          context?: Json | null;
          created_at?: string;
          id?: string;
          intent_sub_type?: string | null;
          intent_type?: string;
          message_preview?: string | null;
          satisfaction?: number | null;
          success?: boolean | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_interaction_logs: {
        Row: {
          action_target: string | null;
          action_type: string;
          ai_suggestion: Json | null;
          context: Json | null;
          created_at: string | null;
          id: string;
          session_id: string | null;
          user_choice: Json | null;
          user_feedback: string | null;
          user_id: string;
        };
        Insert: {
          action_target?: string | null;
          action_type: string;
          ai_suggestion?: Json | null;
          context?: Json | null;
          created_at?: string | null;
          id?: string;
          session_id?: string | null;
          user_choice?: Json | null;
          user_feedback?: string | null;
          user_id: string;
        };
        Update: {
          action_target?: string | null;
          action_type?: string;
          ai_suggestion?: Json | null;
          context?: Json | null;
          created_at?: string | null;
          id?: string;
          session_id?: string | null;
          user_choice?: Json | null;
          user_feedback?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_messages: {
        Row: {
          content: string | null;
          conversation_id: string;
          created_at: string;
          id: string;
          metadata: Json | null;
          role: string;
          tokens_completion: number | null;
          tokens_prompt: number | null;
          tool_call_id: string | null;
          tool_calls: Json | null;
          tool_results: Json | null;
        };
        Insert: {
          content?: string | null;
          conversation_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          role: string;
          tokens_completion?: number | null;
          tokens_prompt?: number | null;
          tool_call_id?: string | null;
          tool_calls?: Json | null;
          tool_results?: Json | null;
        };
        Update: {
          content?: string | null;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          role?: string;
          tokens_completion?: number | null;
          tokens_prompt?: number | null;
          tool_call_id?: string | null;
          tool_calls?: Json | null;
          tool_results?: Json | null;
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
      ai_notes: {
        Row: {
          content: string;
          content_format: string;
          conversation_id: string | null;
          created_at: string;
          id: string;
          is_pinned: boolean;
          message_id: string | null;
          related_bookmark_ids: number[] | null;
          skill_id: string | null;
          source_type: string;
          tags: string[] | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content: string;
          content_format?: string;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          is_pinned?: boolean;
          message_id?: string | null;
          related_bookmark_ids?: number[] | null;
          skill_id?: string | null;
          source_type: string;
          tags?: string[] | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          content_format?: string;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          is_pinned?: boolean;
          message_id?: string | null;
          related_bookmark_ids?: number[] | null;
          skill_id?: string | null;
          source_type?: string;
          tags?: string[] | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_operation_snapshots: {
        Row: {
          affected_bookmark_ids: number[] | null;
          after_state: Json | null;
          before_state: Json;
          bookmark_ids: number[] | null;
          conversation_id: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          is_reverted: boolean;
          operation_description: string | null;
          operation_type: string;
          operations: Json;
          reverted_at: string | null;
          skill_id: string | null;
          summary: string | null;
          user_id: string;
        };
        Insert: {
          affected_bookmark_ids?: number[] | null;
          after_state?: Json | null;
          before_state?: Json;
          bookmark_ids?: number[] | null;
          conversation_id?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          is_reverted?: boolean;
          operation_description?: string | null;
          operation_type: string;
          operations?: Json;
          reverted_at?: string | null;
          skill_id?: string | null;
          summary?: string | null;
          user_id: string;
        };
        Update: {
          affected_bookmark_ids?: number[] | null;
          after_state?: Json | null;
          before_state?: Json;
          bookmark_ids?: number[] | null;
          conversation_id?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          is_reverted?: boolean;
          operation_description?: string | null;
          operation_type?: string;
          operations?: Json;
          reverted_at?: string | null;
          skill_id?: string | null;
          summary?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_preferences_audit_log: {
        Row: {
          change_type: string;
          created_at: string;
          id: string;
          new_value: Json | null;
          old_value: Json | null;
          user_id: string;
        };
        Insert: {
          change_type: string;
          created_at?: string;
          id?: string;
          new_value?: Json | null;
          old_value?: Json | null;
          user_id: string;
        };
        Update: {
          change_type?: string;
          created_at?: string;
          id?: string;
          new_value?: Json | null;
          old_value?: Json | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_session_memory: {
        Row: {
          conversation_id: string;
          created_at: string;
          current_focus: Json | null;
          expires_at: string;
          id: string;
          last_intent: string | null;
          message_count: number;
          previous_session_summary: Json | null;
          state: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string;
          current_focus?: Json | null;
          expires_at?: string;
          id?: string;
          last_intent?: string | null;
          message_count?: number;
          previous_session_summary?: Json | null;
          state?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          current_focus?: Json | null;
          expires_at?: string;
          id?: string;
          last_intent?: string | null;
          message_count?: number;
          previous_session_summary?: Json | null;
          state?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_skill_executions: {
        Row: {
          completed_at: string | null;
          conversation_id: string | null;
          created_at: string;
          error_code: string | null;
          error_message: string | null;
          id: string;
          input: Json;
          latency_ms: number | null;
          message_id: string | null;
          output: Json | null;
          retry_count: number | null;
          skill_id: string;
          skill_version: string;
          started_at: string | null;
          status: string;
          tokens_used: number | null;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          input: Json;
          latency_ms?: number | null;
          message_id?: string | null;
          output?: Json | null;
          retry_count?: number | null;
          skill_id: string;
          skill_version?: string;
          started_at?: string | null;
          status?: string;
          tokens_used?: number | null;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          input?: Json;
          latency_ms?: number | null;
          message_id?: string | null;
          output?: Json | null;
          retry_count?: number | null;
          skill_id?: string;
          skill_version?: string;
          started_at?: string | null;
          status?: string;
          tokens_used?: number | null;
          user_id?: string;
        };
        Relationships: [
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
      ai_skill_versions: {
        Row: {
          avg_latency_ms: number | null;
          category: string | null;
          config: Json;
          created_at: string;
          description: string | null;
          error_count: number | null;
          execution_count: number | null;
          id: string;
          is_active: boolean;
          is_deprecated: boolean;
          name: string;
          skill_id: string;
          success_count: number | null;
          updated_at: string;
          version: string;
        };
        Insert: {
          avg_latency_ms?: number | null;
          category?: string | null;
          config?: Json;
          created_at?: string;
          description?: string | null;
          error_count?: number | null;
          execution_count?: number | null;
          id?: string;
          is_active?: boolean;
          is_deprecated?: boolean;
          name: string;
          skill_id: string;
          success_count?: number | null;
          updated_at?: string;
          version: string;
        };
        Update: {
          avg_latency_ms?: number | null;
          category?: string | null;
          config?: Json;
          created_at?: string;
          description?: string | null;
          error_count?: number | null;
          execution_count?: number | null;
          id?: string;
          is_active?: boolean;
          is_deprecated?: boolean;
          name?: string;
          skill_id?: string;
          success_count?: number | null;
          updated_at?: string;
          version?: string;
        };
        Relationships: [];
      };
      bookmark_chunks: {
        Row: {
          bookmark_id: number;
          chunk_index: number;
          chunk_type: string | null;
          content: string;
          content_hash: string;
          created_at: string | null;
          embedding: string | null;
          embedding_version: string | null;
          end_offset: number | null;
          id: string;
          parent_chunk_id: string | null;
          start_offset: number | null;
          token_count: number;
          updated_at: string | null;
        };
        Insert: {
          bookmark_id: number;
          chunk_index: number;
          chunk_type?: string | null;
          content: string;
          content_hash: string;
          created_at?: string | null;
          embedding?: string | null;
          embedding_version?: string | null;
          end_offset?: number | null;
          id?: string;
          parent_chunk_id?: string | null;
          start_offset?: number | null;
          token_count: number;
          updated_at?: string | null;
        };
        Update: {
          bookmark_id?: number;
          chunk_index?: number;
          chunk_type?: string | null;
          content?: string;
          content_hash?: string;
          created_at?: string | null;
          embedding?: string | null;
          embedding_version?: string | null;
          end_offset?: number | null;
          id?: string;
          parent_chunk_id?: string | null;
          start_offset?: number | null;
          token_count?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookmark_chunks_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmark_chunks_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmark_chunks_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmark_chunks_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmark_chunks_parent_chunk_id_fkey";
            columns: ["parent_chunk_id"];
            isOneToOne: false;
            referencedRelation: "bookmark_chunks";
            referencedColumns: ["id"];
          },
        ];
      };
      bookmark_embedding_queue: {
        Row: {
          bookmark_id: number;
          created_at: string | null;
          id: number;
          last_error: string | null;
          priority: number | null;
          processed_at: string | null;
          retry_count: number | null;
          update_type: string;
          user_id: string;
        };
        Insert: {
          bookmark_id: number;
          created_at?: string | null;
          id?: number;
          last_error?: string | null;
          priority?: number | null;
          processed_at?: string | null;
          retry_count?: number | null;
          update_type: string;
          user_id: string;
        };
        Update: {
          bookmark_id?: number;
          created_at?: string | null;
          id?: number;
          last_error?: string | null;
          priority?: number | null;
          processed_at?: string | null;
          retry_count?: number | null;
          update_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookmark_embedding_queue_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmark_embedding_queue_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmark_embedding_queue_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmark_embedding_queue_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
            referencedColumns: ["id"];
          },
        ];
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
          original_html: string | null;
          original_url: string;
          processed_html: string | null;
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
          style_preserve_level: string | null;
          trigger_source: string | null;
          trigger_tag: string | null;
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
          original_html?: string | null;
          original_url: string;
          processed_html?: string | null;
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
          style_preserve_level?: string | null;
          trigger_source?: string | null;
          trigger_tag?: string | null;
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
          original_html?: string | null;
          original_url?: string;
          processed_html?: string | null;
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
          style_preserve_level?: string | null;
          trigger_source?: string | null;
          trigger_tag?: string | null;
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
            foreignKeyName: "bookmark_snapshots_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmark_snapshots_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmark_snapshots_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
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
      bookmark_tags: {
        Row: {
          bookmark_id: number;
          created_at: string | null;
          id: number;
          tag_id: number;
        };
        Insert: {
          bookmark_id: number;
          created_at?: string | null;
          id?: number;
          tag_id: number;
        };
        Update: {
          bookmark_id?: number;
          created_at?: string | null;
          id?: number;
          tag_id?: number;
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
          content_length: number | null;
          content_type: string | null;
          cover_url: string | null;
          created_at: string | null;
          deleted_at: string | null;
          description: string | null;
          embedding: string | null;
          embedding_version: number | null;
          estimated_read_time: number | null;
          folder_id: number | null;
          full_content: string | null;
          has_snapshot: boolean | null;
          health_checked_at: string | null;
          health_error_type: string | null;
          health_response_time_ms: number | null;
          health_status: string | null;
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
          last_read_at: string | null;
          last_reviewed_at: string | null;
          last_snapshot_at: string | null;
          last_validation_at: string | null;
          next_review_at: string | null;
          notes: string | null;
          pending_cluster: boolean | null;
          pending_since: string | null;
          platform: string;
          platform_content_id: string | null;
          publish_time: string | null;
          rating: number | null;
          read_at: string | null;
          read_count: number;
          review_stage: number;
          search_vector: unknown;
          shadow_confidence: number | null;
          shadow_folder_id: number | null;
          shadow_folder_name: string | null;
          shadow_suggested_at: string | null;
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
          video_transcript: string | null;
          video_transcript_status: string | null;
          video_transcript_word_count: number | null;
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
          content_length?: number | null;
          content_type?: string | null;
          cover_url?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          embedding?: string | null;
          embedding_version?: number | null;
          estimated_read_time?: number | null;
          folder_id?: number | null;
          full_content?: string | null;
          has_snapshot?: boolean | null;
          health_checked_at?: string | null;
          health_error_type?: string | null;
          health_response_time_ms?: number | null;
          health_status?: string | null;
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
          last_read_at?: string | null;
          last_reviewed_at?: string | null;
          last_snapshot_at?: string | null;
          last_validation_at?: string | null;
          next_review_at?: string | null;
          notes?: string | null;
          pending_cluster?: boolean | null;
          pending_since?: string | null;
          platform: string;
          platform_content_id?: string | null;
          publish_time?: string | null;
          rating?: number | null;
          read_at?: string | null;
          read_count?: number;
          review_stage?: number;
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
          video_transcript?: string | null;
          video_transcript_status?: string | null;
          video_transcript_word_count?: number | null;
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
          content_length?: number | null;
          content_type?: string | null;
          cover_url?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          embedding?: string | null;
          embedding_version?: number | null;
          estimated_read_time?: number | null;
          folder_id?: number | null;
          full_content?: string | null;
          has_snapshot?: boolean | null;
          health_checked_at?: string | null;
          health_error_type?: string | null;
          health_response_time_ms?: number | null;
          health_status?: string | null;
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
          last_read_at?: string | null;
          last_reviewed_at?: string | null;
          last_snapshot_at?: string | null;
          last_validation_at?: string | null;
          next_review_at?: string | null;
          notes?: string | null;
          pending_cluster?: boolean | null;
          pending_since?: string | null;
          platform?: string;
          platform_content_id?: string | null;
          publish_time?: string | null;
          rating?: number | null;
          read_at?: string | null;
          read_count?: number;
          review_stage?: number;
          search_vector?: unknown;
          shadow_confidence?: number | null;
          shadow_folder_id?: number | null;
          shadow_folder_name?: string | null;
          shadow_suggested_at?: string | null;
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
          video_transcript?: string | null;
          video_transcript_status?: string | null;
          video_transcript_word_count?: number | null;
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
            foreignKeyName: "classification_decisions_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: true;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_decisions_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: true;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_decisions_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: true;
            referencedRelation: "v_content_bookmarks";
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
      classification_logs: {
        Row: {
          id: number;
          user_id: string;
          bookmark_id: number | null;
          input_title: string | null;
          input_tags: string[] | null;
          input_embedding: string | null;
          suggested_folder_id: number | null;
          suggested_folder_name: string | null;
          suggested_confidence: number | null;
          actual_folder_id: number | null;
          actual_folder_name: string | null;
          feedback_type: string | null;
          top_candidates: Json | null;
          execution_time_ms: number | null;
          llm_called: boolean;
          classification_source: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          bookmark_id?: number | null;
          input_title?: string | null;
          input_tags?: string[] | null;
          input_embedding?: string | null;
          suggested_folder_id?: number | null;
          suggested_folder_name?: string | null;
          suggested_confidence?: number | null;
          actual_folder_id?: number | null;
          actual_folder_name?: string | null;
          feedback_type?: string | null;
          top_candidates?: Json | null;
          execution_time_ms?: number | null;
          llm_called?: boolean;
          classification_source?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          bookmark_id?: number | null;
          input_title?: string | null;
          input_tags?: string[] | null;
          input_embedding?: string | null;
          suggested_folder_id?: number | null;
          suggested_folder_name?: string | null;
          suggested_confidence?: number | null;
          actual_folder_id?: number | null;
          actual_folder_name?: string | null;
          feedback_type?: string | null;
          top_candidates?: Json | null;
          execution_time_ms?: number | null;
          llm_called?: boolean;
          classification_source?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classification_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_logs_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_logs_suggested_folder_id_fkey";
            columns: ["suggested_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_logs_actual_folder_id_fkey";
            columns: ["actual_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
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
            foreignKeyName: "classification_metrics_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_metrics_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_metrics_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
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
      classification_metrics_v5: {
        Row: {
          id: string;
          user_id: string;
          bookmark_id: number;
          folder_id: number | null;
          stage: string;
          latency_ms: number;
          confidence: number;
          embedding_tokens: number | null;
          llm_tokens: number | null;
          is_correct: boolean | null;
          user_corrected_to_folder_id: number | null;
          degradation_level: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bookmark_id: number;
          folder_id?: number | null;
          stage: string;
          latency_ms: number;
          confidence: number;
          embedding_tokens?: number | null;
          llm_tokens?: number | null;
          is_correct?: boolean | null;
          user_corrected_to_folder_id?: number | null;
          degradation_level?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bookmark_id?: number;
          folder_id?: number | null;
          stage?: string;
          latency_ms?: number;
          confidence?: number;
          embedding_tokens?: number | null;
          llm_tokens?: number | null;
          is_correct?: boolean | null;
          user_corrected_to_folder_id?: number | null;
          degradation_level?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classification_metrics_v5_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_metrics_v5_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_metrics_v5_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_metrics_v5_user_corrected_to_folder_id_fkey";
            columns: ["user_corrected_to_folder_id"];
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
            foreignKeyName: "classification_suggestions_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_suggestions_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_suggestions_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
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
      context_anchors: {
        Row: {
          id: number;
          user_id: string;
          anchor_type: string;
          anchor_name: string;
          anchor_metadata: Json | null;
          embedding: string | null;
          bookmark_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          anchor_type: string;
          anchor_name: string;
          anchor_metadata?: Json | null;
          embedding?: string | null;
          bookmark_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          anchor_type?: string;
          anchor_name?: string;
          anchor_metadata?: Json | null;
          embedding?: string | null;
          bookmark_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "context_anchors_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      classification_t1_queue_v5: {
        Row: {
          id: string;
          user_id: string;
          bookmark_id: number;
          t0_folder_id: number | null;
          t0_confidence: number;
          t0_timestamp: string;
          trigger_reason: string;
          status: string;
          t1_folder_id: number | null;
          t1_confidence: number | null;
          t1_reasoning: string | null;
          t1_timestamp: string | null;
          error_message: string | null;
          retry_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          bookmark_id: number;
          t0_folder_id?: number | null;
          t0_confidence: number;
          t0_timestamp?: string;
          trigger_reason: string;
          status?: string;
          t1_folder_id?: number | null;
          t1_confidence?: number | null;
          t1_reasoning?: string | null;
          t1_timestamp?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          bookmark_id?: number;
          t0_folder_id?: number | null;
          t0_confidence?: number;
          t0_timestamp?: string;
          trigger_reason?: string;
          status?: string;
          t1_folder_id?: number | null;
          t1_confidence?: number | null;
          t1_reasoning?: string | null;
          t1_timestamp?: string | null;
          error_message?: string | null;
          retry_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classification_t1_queue_v5_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_t1_queue_v5_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_t1_queue_v5_t0_folder_id_fkey";
            columns: ["t0_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classification_t1_queue_v5_t1_folder_id_fkey";
            columns: ["t1_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      distribution_oauth_tokens: {
        Row: {
          access_token: string;
          bot_id: string | null;
          created_at: string;
          expires_at: string | null;
          id: string;
          provider: string;
          refresh_token: string | null;
          updated_at: string;
          user_id: string;
          workspace_icon: string | null;
          workspace_id: string | null;
          workspace_name: string | null;
        };
        Insert: {
          access_token: string;
          bot_id?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          provider: string;
          refresh_token?: string | null;
          updated_at?: string;
          user_id: string;
          workspace_icon?: string | null;
          workspace_id?: string | null;
          workspace_name?: string | null;
        };
        Update: {
          access_token?: string;
          bot_id?: string | null;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          provider?: string;
          refresh_token?: string | null;
          updated_at?: string;
          user_id?: string;
          workspace_icon?: string | null;
          workspace_id?: string | null;
          workspace_name?: string | null;
        };
        Relationships: [];
      };
      distribution_targets: {
        Row: {
          created_at: string | null;
          enabled: boolean;
          filter_folders: string[] | null;
          filter_platforms: string[] | null;
          filter_tags: string[] | null;
          id: string;
          include_ai_summary: boolean | null;
          last_error: string | null;
          last_sync_at: string | null;
          name: string;
          schedule_interval_minutes: number | null;
          status: string;
          synced_count: number;
          target_config: Json;
          target_type: string;
          trigger_mode: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          enabled?: boolean;
          filter_folders?: string[] | null;
          filter_platforms?: string[] | null;
          filter_tags?: string[] | null;
          id?: string;
          include_ai_summary?: boolean | null;
          last_error?: string | null;
          last_sync_at?: string | null;
          name: string;
          schedule_interval_minutes?: number | null;
          status?: string;
          synced_count?: number;
          target_config?: Json;
          target_type: string;
          trigger_mode?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          enabled?: boolean;
          filter_folders?: string[] | null;
          filter_platforms?: string[] | null;
          filter_tags?: string[] | null;
          id?: string;
          include_ai_summary?: boolean | null;
          last_error?: string | null;
          last_sync_at?: string | null;
          name?: string;
          schedule_interval_minutes?: number | null;
          status?: string;
          synced_count?: number;
          target_config?: Json;
          target_type?: string;
          trigger_mode?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
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
            foreignKeyName: "embedding_ab_test_metrics_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "embedding_ab_test_metrics_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "embedding_ab_test_metrics_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
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
      flashcards: {
        Row: {
          answer: string;
          bookmark_id: number;
          created_at: string | null;
          difficulty: string | null;
          ease_factor: number | null;
          id: number;
          interval_days: number | null;
          key_points: string[] | null;
          last_reviewed_at: string | null;
          next_review_at: string | null;
          question: string;
          question_depth: string | null;
          repetitions: number | null;
          source_paragraph: string | null;
          status: string | null;
          thinking_hint: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          answer: string;
          bookmark_id: number;
          created_at?: string | null;
          difficulty?: string | null;
          ease_factor?: number | null;
          id?: number;
          interval_days?: number | null;
          key_points?: string[] | null;
          last_reviewed_at?: string | null;
          next_review_at?: string | null;
          question: string;
          question_depth?: string | null;
          repetitions?: number | null;
          source_paragraph?: string | null;
          status?: string | null;
          thinking_hint?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          answer?: string;
          bookmark_id?: number;
          created_at?: string | null;
          difficulty?: string | null;
          ease_factor?: number | null;
          id?: number;
          interval_days?: number | null;
          key_points?: string[] | null;
          last_reviewed_at?: string | null;
          next_review_at?: string | null;
          question?: string;
          question_depth?: string | null;
          repetitions?: number | null;
          source_paragraph?: string | null;
          status?: string | null;
          thinking_hint?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcards_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flashcards_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flashcards_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "flashcards_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
            referencedColumns: ["id"];
          },
        ];
      };
      entropy_reduction_logs: {
        Row: {
          id: number;
          user_id: string;
          folder_id: number;
          action_type: string;
          before_entropy: number;
          after_entropy: number | null;
          affected_bookmark_count: number;
          action_details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          folder_id: number;
          action_type: string;
          before_entropy: number;
          after_entropy?: number | null;
          affected_bookmark_count?: number;
          action_details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          folder_id?: number;
          action_type?: string;
          before_entropy?: number;
          after_entropy?: number | null;
          affected_bookmark_count?: number;
          action_details?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entropy_reduction_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entropy_reduction_logs_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      folder_profiles: {
        Row: {
          bookmark_count: number | null;
          boundary_clarity: number | null;
          computed_at: string | null;
          core_count: number | null;
          core_embedding: string | null;
          core_radius: number | null;
          core_sample_ids: number[] | null;
          core_tightness: number | null;
          edge_count: number | null;
          edge_embedding: string | null;
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
          profile_embedding: string | null;
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
          core_radius?: number | null;
          core_sample_ids?: number[] | null;
          core_tightness?: number | null;
          edge_count?: number | null;
          edge_embedding?: string | null;
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
          profile_embedding?: string | null;
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
          core_radius?: number | null;
          core_sample_ids?: number[] | null;
          core_tightness?: number | null;
          edge_count?: number | null;
          edge_embedding?: string | null;
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
          profile_embedding?: string | null;
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
      folder_entropy_scores: {
        Row: {
          id: number;
          user_id: string;
          folder_id: number;
          entropy_score: number;
          bookmark_count: number;
          avg_similarity: number | null;
          similarity_stddev: number | null;
          calculated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          folder_id: number;
          entropy_score: number;
          bookmark_count?: number;
          avg_similarity?: number | null;
          similarity_stddev?: number | null;
          calculated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          folder_id?: number;
          entropy_score?: number;
          bookmark_count?: number;
          avg_similarity?: number | null;
          similarity_stddev?: number | null;
          calculated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "folder_entropy_scores_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "folder_entropy_scores_folder_id_fkey";
            columns: ["folder_id"];
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
      intent_corrections: {
        Row: {
          applied_count: number;
          confidence: number;
          correct_intent: string;
          created_at: string;
          id: string;
          last_applied_at: string | null;
          original_input: string;
          original_input_embedding: string | null;
          signal: string;
          updated_at: string;
          user_id: string;
          wrong_intent: string;
        };
        Insert: {
          applied_count?: number;
          confidence?: number;
          correct_intent: string;
          created_at?: string;
          id?: string;
          last_applied_at?: string | null;
          original_input: string;
          original_input_embedding?: string | null;
          signal: string;
          updated_at?: string;
          user_id: string;
          wrong_intent: string;
        };
        Update: {
          applied_count?: number;
          confidence?: number;
          correct_intent?: string;
          created_at?: string;
          id?: string;
          last_applied_at?: string | null;
          original_input?: string;
          original_input_embedding?: string | null;
          signal?: string;
          updated_at?: string;
          user_id?: string;
          wrong_intent?: string;
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
            foreignKeyName: "knowledge_links_source_bookmark_id_fkey";
            columns: ["source_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_links_source_bookmark_id_fkey";
            columns: ["source_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_links_source_bookmark_id_fkey";
            columns: ["source_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_links_target_bookmark_id_fkey";
            columns: ["target_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_links_target_bookmark_id_fkey";
            columns: ["target_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_links_target_bookmark_id_fkey";
            columns: ["target_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_links_target_bookmark_id_fkey";
            columns: ["target_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
            referencedColumns: ["id"];
          },
        ];
      };
      ks_bill_line_items: {
        Row: {
          bill_id: string;
          created_at: string;
          description: string;
          discount: number;
          id: string;
          quantity: number;
          total_price: number;
          unit_price: number;
          usage_type: string;
        };
        Insert: {
          bill_id: string;
          created_at?: string;
          description: string;
          discount?: number;
          id?: string;
          quantity?: number;
          total_price?: number;
          unit_price?: number;
          usage_type: string;
        };
        Update: {
          bill_id?: string;
          created_at?: string;
          description?: string;
          discount?: number;
          id?: string;
          quantity?: number;
          total_price?: number;
          unit_price?: number;
          usage_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ks_bill_line_items_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "ks_bills";
            referencedColumns: ["id"];
          },
        ];
      };
      ks_bills: {
        Row: {
          created_at: string;
          currency: string;
          discount: number;
          due_at: string;
          id: string;
          metadata: Json | null;
          paid_at: string | null;
          period_end: string;
          period_start: string;
          status: string;
          subtotal: number;
          tax: number;
          total: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          discount?: number;
          due_at: string;
          id?: string;
          metadata?: Json | null;
          paid_at?: string | null;
          period_end: string;
          period_start: string;
          status?: string;
          subtotal?: number;
          tax?: number;
          total?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          discount?: number;
          due_at?: string;
          id?: string;
          metadata?: Json | null;
          paid_at?: string | null;
          period_end?: string;
          period_start?: string;
          status?: string;
          subtotal?: number;
          tax?: number;
          total?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ks_blueprint_popularity: {
        Row: {
          blueprint_id: string;
          daily_uses: number;
          total_uses: number;
          updated_at: string;
          weekly_uses: number;
        };
        Insert: {
          blueprint_id: string;
          daily_uses?: number;
          total_uses?: number;
          updated_at?: string;
          weekly_uses?: number;
        };
        Update: {
          blueprint_id?: string;
          daily_uses?: number;
          total_uses?: number;
          updated_at?: string;
          weekly_uses?: number;
        };
        Relationships: [];
      };
      ks_consumption_records: {
        Row: {
          amount: number;
          blueprint_type: string | null;
          cost: number;
          created_at: string;
          description: string;
          id: string;
          report_id: string | null;
          usage_type: string;
          user_id: string;
        };
        Insert: {
          amount?: number;
          blueprint_type?: string | null;
          cost?: number;
          created_at?: string;
          description: string;
          id?: string;
          report_id?: string | null;
          usage_type: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          blueprint_type?: string | null;
          cost?: number;
          created_at?: string;
          description?: string;
          id?: string;
          report_id?: string | null;
          usage_type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ks_conversion_events: {
        Row: {
          created_at: string;
          feature_id: string | null;
          id: string;
          remaining_days: number | null;
          remaining_quota: number | null;
          responded_at: string | null;
          source_page: string | null;
          trigger_type: string;
          user_id: string;
          user_response: string | null;
        };
        Insert: {
          created_at?: string;
          feature_id?: string | null;
          id?: string;
          remaining_days?: number | null;
          remaining_quota?: number | null;
          responded_at?: string | null;
          source_page?: string | null;
          trigger_type: string;
          user_id: string;
          user_response?: string | null;
        };
        Update: {
          created_at?: string;
          feature_id?: string | null;
          id?: string;
          remaining_days?: number | null;
          remaining_quota?: number | null;
          responded_at?: string | null;
          source_page?: string | null;
          trigger_type?: string;
          user_id?: string;
          user_response?: string | null;
        };
        Relationships: [];
      };
      ks_custom_templates: {
        Row: {
          base_blueprint: string | null;
          created_at: string;
          description: string;
          icon: string | null;
          id: string;
          name: string;
          output_format: string | null;
          prompt_sections: Json;
          status: string;
          tags: string[] | null;
          updated_at: string;
          usage_count: number;
          user_id: string;
          variables: Json;
          version: number;
          visibility: string;
        };
        Insert: {
          base_blueprint?: string | null;
          created_at?: string;
          description?: string;
          icon?: string | null;
          id?: string;
          name: string;
          output_format?: string | null;
          prompt_sections?: Json;
          status?: string;
          tags?: string[] | null;
          updated_at?: string;
          usage_count?: number;
          user_id: string;
          variables?: Json;
          version?: number;
          visibility?: string;
        };
        Update: {
          base_blueprint?: string | null;
          created_at?: string;
          description?: string;
          icon?: string | null;
          id?: string;
          name?: string;
          output_format?: string | null;
          prompt_sections?: Json;
          status?: string;
          tags?: string[] | null;
          updated_at?: string;
          usage_count?: number;
          user_id?: string;
          variables?: Json;
          version?: number;
          visibility?: string;
        };
        Relationships: [];
      };
      ks_discount_offers: {
        Row: {
          created_at: string;
          discount_percent: number;
          id: string;
          metadata: Json | null;
          offer_type: string;
          promo_code: string | null;
          redeemed_at: string | null;
          user_id: string;
          valid_from: string;
          valid_until: string;
        };
        Insert: {
          created_at?: string;
          discount_percent: number;
          id?: string;
          metadata?: Json | null;
          offer_type: string;
          promo_code?: string | null;
          redeemed_at?: string | null;
          user_id: string;
          valid_from?: string;
          valid_until: string;
        };
        Update: {
          created_at?: string;
          discount_percent?: number;
          id?: string;
          metadata?: Json | null;
          offer_type?: string;
          promo_code?: string | null;
          redeemed_at?: string | null;
          user_id?: string;
          valid_from?: string;
          valid_until?: string;
        };
        Relationships: [];
      };
      ks_email_reminders: {
        Row: {
          clicked_at: string | null;
          created_at: string;
          email_id: string | null;
          id: string;
          metadata: Json | null;
          opened_at: string | null;
          reminder_type: string;
          scheduled_at: string;
          sent_at: string | null;
          user_id: string;
        };
        Insert: {
          clicked_at?: string | null;
          created_at?: string;
          email_id?: string | null;
          id?: string;
          metadata?: Json | null;
          opened_at?: string | null;
          reminder_type: string;
          scheduled_at: string;
          sent_at?: string | null;
          user_id: string;
        };
        Update: {
          clicked_at?: string | null;
          created_at?: string;
          email_id?: string | null;
          id?: string;
          metadata?: Json | null;
          opened_at?: string | null;
          reminder_type?: string;
          scheduled_at?: string;
          sent_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ks_incremental_update_config: {
        Row: {
          auto_detect: boolean;
          auto_update_threshold: string;
          created_at: string;
          detection_interval_minutes: number;
          id: string;
          keep_history: boolean;
          max_history_versions: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auto_detect?: boolean;
          auto_update_threshold?: string;
          created_at?: string;
          detection_interval_minutes?: number;
          id?: string;
          keep_history?: boolean;
          max_history_versions?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auto_detect?: boolean;
          auto_update_threshold?: string;
          created_at?: string;
          detection_interval_minutes?: number;
          id?: string;
          keep_history?: boolean;
          max_history_versions?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ks_incremental_update_tasks: {
        Row: {
          change_set_id: string;
          completed_at: string | null;
          created_at: string;
          error: string | null;
          id: string;
          impact_analysis: Json;
          new_version: number | null;
          report_id: string;
          started_at: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          change_set_id: string;
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          impact_analysis?: Json;
          new_version?: number | null;
          report_id: string;
          started_at?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          change_set_id?: string;
          completed_at?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          impact_analysis?: Json;
          new_version?: number | null;
          report_id?: string;
          started_at?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ks_incremental_update_tasks_change_set_id_fkey";
            columns: ["change_set_id"];
            isOneToOne: false;
            referencedRelation: "ks_report_change_sets";
            referencedColumns: ["id"];
          },
        ];
      };
      ks_knowledge_point_mastery: {
        Row: {
          accuracy: number;
          correct_count: number;
          created_at: string;
          ease_factor: number;
          id: string;
          interval_days: number;
          knowledge_point_id: string;
          last_reviewed_at: string | null;
          mastery_level: string;
          next_review_at: string | null;
          review_count: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          accuracy?: number;
          correct_count?: number;
          created_at?: string;
          ease_factor?: number;
          id?: string;
          interval_days?: number;
          knowledge_point_id: string;
          last_reviewed_at?: string | null;
          mastery_level?: string;
          next_review_at?: string | null;
          review_count?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accuracy?: number;
          correct_count?: number;
          created_at?: string;
          ease_factor?: number;
          id?: string;
          interval_days?: number;
          knowledge_point_id?: string;
          last_reviewed_at?: string | null;
          mastery_level?: string;
          next_review_at?: string | null;
          review_count?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ks_knowledge_point_mastery_knowledge_point_id_fkey";
            columns: ["knowledge_point_id"];
            isOneToOne: false;
            referencedRelation: "ks_knowledge_points";
            referencedColumns: ["id"];
          },
        ];
      };
      ks_knowledge_points: {
        Row: {
          content: string;
          created_at: string;
          difficulty: number;
          id: string;
          importance: number;
          keywords: string[] | null;
          paragraph_index: number;
          report_id: string;
          source_bookmark_ids: string[] | null;
        };
        Insert: {
          content: string;
          created_at?: string;
          difficulty?: number;
          id?: string;
          importance?: number;
          keywords?: string[] | null;
          paragraph_index?: number;
          report_id: string;
          source_bookmark_ids?: string[] | null;
        };
        Update: {
          content?: string;
          created_at?: string;
          difficulty?: number;
          id?: string;
          importance?: number;
          keywords?: string[] | null;
          paragraph_index?: number;
          report_id?: string;
          source_bookmark_ids?: string[] | null;
        };
        Relationships: [];
      };
      ks_learning_sessions: {
        Row: {
          correct_answers: number;
          duration_minutes: number;
          ended_at: string | null;
          id: string;
          points_reviewed: number;
          points_studied: number;
          report_id: string;
          started_at: string;
          total_answers: number;
          user_id: string;
        };
        Insert: {
          correct_answers?: number;
          duration_minutes?: number;
          ended_at?: string | null;
          id?: string;
          points_reviewed?: number;
          points_studied?: number;
          report_id: string;
          started_at?: string;
          total_answers?: number;
          user_id: string;
        };
        Update: {
          correct_answers?: number;
          duration_minutes?: number;
          ended_at?: string | null;
          id?: string;
          points_reviewed?: number;
          points_studied?: number;
          report_id?: string;
          started_at?: string;
          total_answers?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      ks_report_change_sets: {
        Row: {
          changes: Json;
          created_at: string;
          id: string;
          impact_level: string;
          processed: boolean;
          processed_at: string | null;
          report_id: string;
          user_id: string;
        };
        Insert: {
          changes?: Json;
          created_at?: string;
          id?: string;
          impact_level?: string;
          processed?: boolean;
          processed_at?: string | null;
          report_id: string;
          user_id: string;
        };
        Update: {
          changes?: Json;
          created_at?: string;
          id?: string;
          impact_level?: string;
          processed?: boolean;
          processed_at?: string | null;
          report_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ks_report_versions: {
        Row: {
          bookmark_ids: string[] | null;
          change_summary: string | null;
          content: Json;
          created_at: string;
          id: string;
          report_id: string;
          source: string;
          user_id: string;
          version: number;
        };
        Insert: {
          bookmark_ids?: string[] | null;
          change_summary?: string | null;
          content: Json;
          created_at?: string;
          id?: string;
          report_id: string;
          source?: string;
          user_id: string;
          version: number;
        };
        Update: {
          bookmark_ids?: string[] | null;
          change_summary?: string | null;
          content?: Json;
          created_at?: string;
          id?: string;
          report_id?: string;
          source?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [];
      };
      ks_review_records: {
        Row: {
          created_at: string;
          id: string;
          knowledge_point_id: string;
          new_interval: number;
          previous_interval: number;
          rating: number;
          response_time_ms: number;
          session_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          knowledge_point_id: string;
          new_interval?: number;
          previous_interval?: number;
          rating: number;
          response_time_ms?: number;
          session_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          knowledge_point_id?: string;
          new_interval?: number;
          previous_interval?: number;
          rating?: number;
          response_time_ms?: number;
          session_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ks_review_records_knowledge_point_id_fkey";
            columns: ["knowledge_point_id"];
            isOneToOne: false;
            referencedRelation: "ks_knowledge_points";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ks_review_records_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "ks_learning_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      ks_template_shares: {
        Row: {
          created_at: string;
          id: string;
          permission: string;
          shared_by: string;
          shared_with_user_id: string;
          template_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          permission?: string;
          shared_by: string;
          shared_with_user_id: string;
          template_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          permission?: string;
          shared_by?: string;
          shared_with_user_id?: string;
          template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ks_template_shares_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "ks_custom_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      ks_template_usages: {
        Row: {
          created_at: string;
          feedback: string | null;
          id: string;
          rating: number | null;
          report_id: string | null;
          template_id: string;
          user_id: string;
          variable_values: Json;
        };
        Insert: {
          created_at?: string;
          feedback?: string | null;
          id?: string;
          rating?: number | null;
          report_id?: string | null;
          template_id: string;
          user_id: string;
          variable_values?: Json;
        };
        Update: {
          created_at?: string;
          feedback?: string | null;
          id?: string;
          rating?: number | null;
          report_id?: string | null;
          template_id?: string;
          user_id?: string;
          variable_values?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "ks_template_usages_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "ks_custom_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      ks_template_versions: {
        Row: {
          changelog: string;
          created_at: string;
          created_by: string;
          id: string;
          prompt_sections: Json;
          template_id: string;
          variables: Json;
          version: number;
        };
        Insert: {
          changelog?: string;
          created_at?: string;
          created_by: string;
          id?: string;
          prompt_sections?: Json;
          template_id: string;
          variables?: Json;
          version: number;
        };
        Update: {
          changelog?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          prompt_sections?: Json;
          template_id?: string;
          variables?: Json;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ks_template_versions_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "ks_custom_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      ks_update_results: {
        Row: {
          change_summary: string | null;
          created_at: string;
          id: string;
          new_version: number;
          paragraphs_regenerated: number;
          paragraphs_updated: number;
          processing_time_ms: number;
          report_id: string;
          success: boolean;
          task_id: string;
          tokens_used: number;
          user_id: string;
        };
        Insert: {
          change_summary?: string | null;
          created_at?: string;
          id?: string;
          new_version: number;
          paragraphs_regenerated?: number;
          paragraphs_updated?: number;
          processing_time_ms?: number;
          report_id: string;
          success?: boolean;
          task_id: string;
          tokens_used?: number;
          user_id: string;
        };
        Update: {
          change_summary?: string | null;
          created_at?: string;
          id?: string;
          new_version?: number;
          paragraphs_regenerated?: number;
          paragraphs_updated?: number;
          processing_time_ms?: number;
          report_id?: string;
          success?: boolean;
          task_id?: string;
          tokens_used?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ks_update_results_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "ks_incremental_update_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      ks_upgrade_prompts: {
        Row: {
          cooldown_until: string | null;
          created_at: string;
          id: string;
          prompt_type: string;
          responded_at: string | null;
          response: string | null;
          shown_at: string;
          trigger_type: string;
          user_id: string;
        };
        Insert: {
          cooldown_until?: string | null;
          created_at?: string;
          id?: string;
          prompt_type: string;
          responded_at?: string | null;
          response?: string | null;
          shown_at?: string;
          trigger_type: string;
          user_id: string;
        };
        Update: {
          cooldown_until?: string | null;
          created_at?: string;
          id?: string;
          prompt_type?: string;
          responded_at?: string | null;
          response?: string | null;
          shown_at?: string;
          trigger_type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ks_usage_records: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          metadata: Json | null;
          resource_id: string | null;
          unit: string;
          usage_type: string;
          user_id: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          resource_id?: string | null;
          unit?: string;
          usage_type: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          resource_id?: string | null;
          unit?: string;
          usage_type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ks_usage_stats: {
        Row: {
          blueprint_id: string;
          cancel_count: number;
          created_at: string;
          id: string;
          last_used_at: string | null;
          preferred_length_mode: string | null;
          preferred_platform_style: string | null;
          success_count: number;
          updated_at: string;
          use_count: number;
          user_id: string;
        };
        Insert: {
          blueprint_id: string;
          cancel_count?: number;
          created_at?: string;
          id?: string;
          last_used_at?: string | null;
          preferred_length_mode?: string | null;
          preferred_platform_style?: string | null;
          success_count?: number;
          updated_at?: string;
          use_count?: number;
          user_id: string;
        };
        Update: {
          blueprint_id?: string;
          cancel_count?: number;
          created_at?: string;
          id?: string;
          last_used_at?: string | null;
          preferred_length_mode?: string | null;
          preferred_platform_style?: string | null;
          success_count?: number;
          updated_at?: string;
          use_count?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      ks_user_trial_states: {
        Row: {
          conversion_stage: string;
          converted_at: string | null;
          created_at: string;
          expires_at: string;
          features_experienced: string[];
          generations_used: number;
          id: string;
          last_active_at: string;
          metadata: Json | null;
          started_at: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          conversion_stage?: string;
          converted_at?: string | null;
          created_at?: string;
          expires_at: string;
          features_experienced?: string[];
          generations_used?: number;
          id?: string;
          last_active_at?: string;
          metadata?: Json | null;
          started_at?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          conversion_stage?: string;
          converted_at?: string | null;
          created_at?: string;
          expires_at?: string;
          features_experienced?: string[];
          generations_used?: number;
          id?: string;
          last_active_at?: string;
          metadata?: Json | null;
          started_at?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      learning_nodes: {
        Row: {
          bookmark_id: number | null;
          completed_at: string | null;
          created_at: string;
          description: string | null;
          estimated_minutes: number;
          id: string;
          note: string | null;
          path_id: string;
          rating: number | null;
          sort_order: number;
          status: string;
          title: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          bookmark_id?: number | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          estimated_minutes?: number;
          id?: string;
          note?: string | null;
          path_id: string;
          rating?: number | null;
          sort_order?: number;
          status?: string;
          title: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          bookmark_id?: number | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          estimated_minutes?: number;
          id?: string;
          note?: string | null;
          path_id?: string;
          rating?: number | null;
          sort_order?: number;
          status?: string;
          title?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_nodes_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_nodes_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_nodes_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_nodes_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_nodes_path_id_fkey";
            columns: ["path_id"];
            isOneToOne: false;
            referencedRelation: "learning_paths";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_paths: {
        Row: {
          completed_at: string | null;
          created_at: string;
          description: string | null;
          difficulty: string;
          estimated_days: number;
          estimated_total_minutes: number;
          id: string;
          started_at: string | null;
          status: string;
          title: string;
          topic: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          difficulty?: string;
          estimated_days?: number;
          estimated_total_minutes?: number;
          id?: string;
          started_at?: string | null;
          status?: string;
          title: string;
          topic: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          difficulty?: string;
          estimated_days?: number;
          estimated_total_minutes?: number;
          id?: string;
          started_at?: string | null;
          status?: string;
          title?: string;
          topic?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      learning_records: {
        Row: {
          created_at: string;
          id: string;
          learned_at: string;
          learned_minutes: number;
          node_id: string | null;
          path_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          learned_at?: string;
          learned_minutes?: number;
          node_id?: string | null;
          path_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          learned_at?: string;
          learned_minutes?: number;
          node_id?: string | null;
          path_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_records_node_id_fkey";
            columns: ["node_id"];
            isOneToOne: false;
            referencedRelation: "learning_nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_records_path_id_fkey";
            columns: ["path_id"];
            isOneToOne: false;
            referencedRelation: "learning_paths";
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
      link_health_checks: {
        Row: {
          bookmark_ids: number[] | null;
          completed_at: string | null;
          created_at: string;
          failed_count: number;
          folder_id: number | null;
          healthy_count: number;
          id: string;
          problems: Json;
          progress: number;
          redirect_count: number;
          scope: string;
          slow_count: number;
          started_at: string | null;
          status: string;
          total_checked: number;
          user_id: string;
        };
        Insert: {
          bookmark_ids?: number[] | null;
          completed_at?: string | null;
          created_at?: string;
          failed_count?: number;
          folder_id?: number | null;
          healthy_count?: number;
          id?: string;
          problems?: Json;
          progress?: number;
          redirect_count?: number;
          scope?: string;
          slow_count?: number;
          started_at?: string | null;
          status?: string;
          total_checked?: number;
          user_id: string;
        };
        Update: {
          bookmark_ids?: number[] | null;
          completed_at?: string | null;
          created_at?: string;
          failed_count?: number;
          folder_id?: number | null;
          healthy_count?: number;
          id?: string;
          problems?: Json;
          progress?: number;
          redirect_count?: number;
          scope?: string;
          slow_count?: number;
          started_at?: string | null;
          status?: string;
          total_checked?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "link_health_checks_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "link_health_checks_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
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
      md_collection_highlights: {
        Row: {
          anchor_text: string;
          collection_id: number;
          color: string;
          created_at: string;
          end_offset: number;
          id: string;
          start_offset: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          anchor_text: string;
          collection_id: number;
          color: string;
          created_at?: string;
          end_offset: number;
          id?: string;
          start_offset: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          anchor_text?: string;
          collection_id?: number;
          color?: string;
          created_at?: string;
          end_offset?: number;
          id?: string;
          start_offset?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "md_collection_highlights_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "md_collections";
            referencedColumns: ["id"];
          },
        ];
      };
      md_collections: {
        Row: {
          ai_summary: string | null;
          ai_tags: string[] | null;
          code_block_count: number | null;
          content_hash: string;
          content_type: string | null;
          content_type_confidence: number | null;
          created_at: string | null;
          deleted_at: string | null;
          embedding: string | null;
          embedding_version: string | null;
          folder_id: number | null;
          id: number;
          is_read: boolean | null;
          is_starred: boolean | null;
          notes: string | null;
          processed_at: string | null;
          processing_error: string | null;
          processing_status: string | null;
          raw_content: string;
          read_at: string | null;
          reading_time_minutes: number | null;
          source_filename: string | null;
          source_metadata: Json | null;
          source_type: string | null;
          starred_at: string | null;
          title: string;
          updated_at: string | null;
          user_id: string;
          user_tags: string[] | null;
          word_count: number | null;
        };
        Insert: {
          ai_summary?: string | null;
          ai_tags?: string[] | null;
          code_block_count?: number | null;
          content_hash: string;
          content_type?: string | null;
          content_type_confidence?: number | null;
          created_at?: string | null;
          deleted_at?: string | null;
          embedding?: string | null;
          embedding_version?: string | null;
          folder_id?: number | null;
          id?: number;
          is_read?: boolean | null;
          is_starred?: boolean | null;
          notes?: string | null;
          processed_at?: string | null;
          processing_error?: string | null;
          processing_status?: string | null;
          raw_content: string;
          read_at?: string | null;
          reading_time_minutes?: number | null;
          source_filename?: string | null;
          source_type?: string | null;
          starred_at?: string | null;
          title: string;
          updated_at?: string | null;
          user_id: string;
          user_tags?: string[] | null;
          word_count?: number | null;
        };
        Update: {
          ai_summary?: string | null;
          ai_tags?: string[] | null;
          code_block_count?: number | null;
          content_hash?: string;
          content_type?: string | null;
          content_type_confidence?: number | null;
          created_at?: string | null;
          deleted_at?: string | null;
          embedding?: string | null;
          embedding_version?: string | null;
          folder_id?: number | null;
          id?: number;
          is_read?: boolean | null;
          is_starred?: boolean | null;
          notes?: string | null;
          processed_at?: string | null;
          processing_error?: string | null;
          processing_status?: string | null;
          raw_content?: string;
          read_at?: string | null;
          reading_time_minutes?: number | null;
          source_filename?: string | null;
          source_type?: string | null;
          starred_at?: string | null;
          title?: string;
          updated_at?: string | null;
          user_id?: string;
          user_tags?: string[] | null;
          word_count?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "md_collections_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "md_collections_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      note_save_history: {
        Row: {
          content_hash: string | null;
          created_at: string | null;
          generated_title: string | null;
          id: number;
          is_duplicate_save: boolean | null;
          note_id: number;
          source_conversation_id: string | null;
          source_id: string | null;
          source_type: string;
          user_id: string;
        };
        Insert: {
          content_hash?: string | null;
          created_at?: string | null;
          generated_title?: string | null;
          id?: number;
          is_duplicate_save?: boolean | null;
          note_id: number;
          source_conversation_id?: string | null;
          source_id?: string | null;
          source_type: string;
          user_id: string;
        };
        Update: {
          content_hash?: string | null;
          created_at?: string | null;
          generated_title?: string | null;
          id?: number;
          is_duplicate_save?: boolean | null;
          note_id?: number;
          source_conversation_id?: string | null;
          source_id?: string | null;
          source_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "note_save_history_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "md_collections";
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
            foreignKeyName: "messages_related_bookmark_id_fkey";
            columns: ["related_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_related_bookmark_id_fkey";
            columns: ["related_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_related_bookmark_id_fkey";
            columns: ["related_bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
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
      monitor_check_logs: {
        Row: {
          id: number;
          monitor_id: number;
          user_id: string;
          check_result: string;
          previous_hash: string | null;
          current_hash: string | null;
          similarity_score: number | null;
          change_summary: string | null;
          error_message: string | null;
          checked_at: string;
          duration_ms: number | null;
          new_snapshot_id: number | null;
          archived_version_id: number | null;
        };
        Insert: {
          id?: number;
          monitor_id: number;
          user_id: string;
          check_result: string;
          previous_hash?: string | null;
          current_hash?: string | null;
          similarity_score?: number | null;
          change_summary?: string | null;
          error_message?: string | null;
          checked_at?: string;
          duration_ms?: number | null;
          new_snapshot_id?: number | null;
          archived_version_id?: number | null;
        };
        Update: {
          id?: number;
          monitor_id?: number;
          user_id?: string;
          check_result?: string;
          previous_hash?: string | null;
          current_hash?: string | null;
          similarity_score?: number | null;
          change_summary?: string | null;
          error_message?: string | null;
          checked_at?: string;
          duration_ms?: number | null;
          new_snapshot_id?: number | null;
          archived_version_id?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "monitor_check_logs_monitor_id_fkey";
            columns: ["monitor_id"];
            isOneToOne: false;
            referencedRelation: "page_monitors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "monitor_check_logs_new_snapshot_id_fkey";
            columns: ["new_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "bookmark_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "monitor_check_logs_archived_version_id_fkey";
            columns: ["archived_version_id"];
            isOneToOne: false;
            referencedRelation: "snapshot_versions";
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
      oauth_authorization_codes: {
        Row: {
          code: string;
          code_challenge: string;
          code_challenge_method: string;
          created_at: string;
          expires_at: string;
          redirect_uri: string;
          scope: string | null;
          state: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          code: string;
          code_challenge: string;
          code_challenge_method?: string;
          created_at?: string;
          expires_at: string;
          redirect_uri: string;
          scope?: string | null;
          state: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          code?: string;
          code_challenge?: string;
          code_challenge_method?: string;
          created_at?: string;
          expires_at?: string;
          redirect_uri?: string;
          scope?: string | null;
          state?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      oauth_states: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          provider: string;
          state: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          provider: string;
          state: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          provider?: string;
          state?: string;
          user_id?: string;
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
      page_monitors: {
        Row: {
          id: number;
          user_id: string;
          bookmark_id: number;
          check_interval: string;
          custom_interval_hours: number | null;
          last_checked_at: string | null;
          next_check_at: string | null;
          baseline_snapshot_id: number | null;
          baseline_content_hash: string | null;
          baseline_captured_at: string | null;
          status: string;
          consecutive_failures: number;
          last_error_message: string | null;
          change_count: number;
          last_change_at: string | null;
          notification_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          bookmark_id: number;
          check_interval?: string;
          custom_interval_hours?: number | null;
          last_checked_at?: string | null;
          next_check_at?: string | null;
          baseline_snapshot_id?: number | null;
          baseline_content_hash?: string | null;
          baseline_captured_at?: string | null;
          status?: string;
          consecutive_failures?: number;
          last_error_message?: string | null;
          change_count?: number;
          last_change_at?: string | null;
          notification_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          bookmark_id?: number;
          check_interval?: string;
          custom_interval_hours?: number | null;
          last_checked_at?: string | null;
          next_check_at?: string | null;
          baseline_snapshot_id?: number | null;
          baseline_content_hash?: string | null;
          baseline_captured_at?: string | null;
          status?: string;
          consecutive_failures?: number;
          last_error_message?: string | null;
          change_count?: number;
          last_change_at?: string | null;
          notification_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "page_monitors_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "page_monitors_baseline_snapshot_id_fkey";
            columns: ["baseline_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "bookmark_snapshots";
            referencedColumns: ["id"];
          },
        ];
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
            foreignKeyName: "pending_confirmations_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pending_confirmations_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pending_confirmations_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
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
      periodic_report_cache: {
        Row: {
          created_at: string;
          id: string;
          period: string;
          period_end: string;
          period_start: string;
          report_data: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          period: string;
          period_end: string;
          period_start: string;
          report_data: Json;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          period?: string;
          period_end?: string;
          period_start?: string;
          report_data?: Json;
          user_id?: string;
        };
        Relationships: [];
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
      plugin_authorizations: {
        Row: {
          access_token_jti: string;
          browser: string;
          created_at: string;
          expires_at: string;
          extension_version: string | null;
          id: string;
          last_used_at: string;
          refresh_token_hash: string;
          revoked_at: string | null;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          access_token_jti: string;
          browser: string;
          created_at?: string;
          expires_at: string;
          extension_version?: string | null;
          id?: string;
          last_used_at?: string;
          refresh_token_hash: string;
          revoked_at?: string | null;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          access_token_jti?: string;
          browser?: string;
          created_at?: string;
          expires_at?: string;
          extension_version?: string | null;
          id?: string;
          last_used_at?: string;
          refresh_token_hash?: string;
          revoked_at?: string | null;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      proactive_insights: {
        Row: {
          created_at: string;
          expires_at: string | null;
          id: string;
          is_dismissed: boolean;
          is_read: boolean;
          metadata: Json | null;
          priority: number;
          read_at: string | null;
          related_bookmark_ids: number[] | null;
          summary: string;
          title: string;
          type: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          is_dismissed?: boolean;
          is_read?: boolean;
          metadata?: Json | null;
          priority?: number;
          read_at?: string | null;
          related_bookmark_ids?: number[] | null;
          summary: string;
          title: string;
          type: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          is_dismissed?: boolean;
          is_read?: boolean;
          metadata?: Json | null;
          priority?: number;
          read_at?: string | null;
          related_bookmark_ids?: number[] | null;
          summary?: string;
          title?: string;
          type?: string;
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
          last_visit_at: string | null;
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
          last_visit_at?: string | null;
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
          last_visit_at?: string | null;
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
      quota_operations: {
        Row: {
          confirmed_at: string | null;
          cost: number;
          created_at: string;
          error_message: string | null;
          id: string;
          operation_type: string;
          refunded_at: string | null;
          request_id: string;
          status: string;
          synthesis_report_id: string | null;
          user_id: string;
        };
        Insert: {
          confirmed_at?: string | null;
          cost: number;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          operation_type: string;
          refunded_at?: string | null;
          request_id: string;
          status?: string;
          synthesis_report_id?: string | null;
          user_id: string;
        };
        Update: {
          confirmed_at?: string | null;
          cost?: number;
          created_at?: string;
          error_message?: string | null;
          id?: string;
          operation_type?: string;
          refunded_at?: string | null;
          request_id?: string;
          status?: string;
          synthesis_report_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      reading_plan_items: {
        Row: {
          actual_read_time: number | null;
          bookmark_id: number;
          completed_at: string | null;
          created_at: string;
          estimated_read_time: number;
          id: string;
          is_review: boolean | null;
          plan_id: string;
          priority: string;
          scheduled_date: string;
          scheduled_day: number;
          sort_order: number;
          status: string;
        };
        Insert: {
          actual_read_time?: number | null;
          bookmark_id: number;
          completed_at?: string | null;
          created_at?: string;
          estimated_read_time: number;
          id?: string;
          is_review?: boolean | null;
          plan_id: string;
          priority: string;
          scheduled_date: string;
          scheduled_day: number;
          sort_order?: number;
          status?: string;
        };
        Update: {
          actual_read_time?: number | null;
          bookmark_id?: number;
          completed_at?: string | null;
          created_at?: string;
          estimated_read_time?: number;
          id?: string;
          is_review?: boolean | null;
          plan_id?: string;
          priority?: string;
          scheduled_date?: string;
          scheduled_day?: number;
          sort_order?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reading_plan_items_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reading_plan_items_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reading_plan_items_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reading_plan_items_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reading_plan_items_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "reading_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      reading_plans: {
        Row: {
          completed_items: number;
          created_at: string;
          daily_minutes: number;
          days_per_week: number;
          end_date: string;
          goal: string;
          id: string;
          name: string;
          preferences: Json;
          scope_folder_id: number | null;
          scope_tags: string[] | null;
          scope_unread_only: boolean | null;
          skill_execution_id: string | null;
          start_date: string;
          status: string;
          topic: string | null;
          total_items: number;
          total_reading_time: number;
          total_weeks: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_items?: number;
          created_at?: string;
          daily_minutes: number;
          days_per_week: number;
          end_date: string;
          goal: string;
          id?: string;
          name: string;
          preferences?: Json;
          scope_folder_id?: number | null;
          scope_tags?: string[] | null;
          scope_unread_only?: boolean | null;
          skill_execution_id?: string | null;
          start_date: string;
          status?: string;
          topic?: string | null;
          total_items?: number;
          total_reading_time?: number;
          total_weeks?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_items?: number;
          created_at?: string;
          daily_minutes?: number;
          days_per_week?: number;
          end_date?: string;
          goal?: string;
          id?: string;
          name?: string;
          preferences?: Json;
          scope_folder_id?: number | null;
          scope_tags?: string[] | null;
          scope_unread_only?: boolean | null;
          skill_execution_id?: string | null;
          start_date?: string;
          status?: string;
          topic?: string | null;
          total_items?: number;
          total_reading_time?: number;
          total_weeks?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reading_plans_scope_folder_id_fkey";
            columns: ["scope_folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "reading_plans_scope_folder_id_fkey";
            columns: ["scope_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reading_plans_skill_execution_id_fkey";
            columns: ["skill_execution_id"];
            isOneToOne: false;
            referencedRelation: "ai_skill_executions";
            referencedColumns: ["id"];
          },
        ];
      };
      review_preferences: {
        Row: {
          created_at: string | null;
          enabled: boolean | null;
          excluded_folder_ids: number[] | null;
          included_folder_ids: number[] | null;
          notification_channel: string | null;
          preferred_day: string | null;
          preferred_time: string | null;
          timezone: string | null;
          updated_at: string | null;
          user_id: string;
          weekly_limit: number | null;
        };
        Insert: {
          created_at?: string | null;
          enabled?: boolean | null;
          excluded_folder_ids?: number[] | null;
          included_folder_ids?: number[] | null;
          notification_channel?: string | null;
          preferred_day?: string | null;
          preferred_time?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
          user_id: string;
          weekly_limit?: number | null;
        };
        Update: {
          created_at?: string | null;
          enabled?: boolean | null;
          excluded_folder_ids?: number[] | null;
          included_folder_ids?: number[] | null;
          notification_channel?: string | null;
          preferred_day?: string | null;
          preferred_time?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
          user_id?: string;
          weekly_limit?: number | null;
        };
        Relationships: [];
      };
      review_records: {
        Row: {
          bookmark_id: number;
          created_at: string;
          id: string;
          metadata: Json | null;
          next_review_at: string | null;
          retention_score: number | null;
          review_stage: number;
          review_type: string;
          reviewed_at: string;
          skill_execution_id: string | null;
          user_id: string;
        };
        Insert: {
          bookmark_id: number;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          next_review_at?: string | null;
          retention_score?: number | null;
          review_stage?: number;
          review_type?: string;
          reviewed_at?: string;
          skill_execution_id?: string | null;
          user_id: string;
        };
        Update: {
          bookmark_id?: number;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          next_review_at?: string | null;
          retention_score?: number | null;
          review_stage?: number;
          review_type?: string;
          reviewed_at?: string;
          skill_execution_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_records_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_records_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_records_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_records_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_records_skill_execution_id_fkey";
            columns: ["skill_execution_id"];
            isOneToOne: false;
            referencedRelation: "ai_skill_executions";
            referencedColumns: ["id"];
          },
        ];
      };
      review_sessions: {
        Row: {
          comprehension: string | null;
          created_at: string | null;
          flashcard_id: number;
          id: number;
          new_ease: number;
          new_interval: number;
          prev_ease: number;
          prev_interval: number;
          response: string;
          response_time_ms: number | null;
          session_type: string | null;
          user_id: string;
          user_note: string | null;
        };
        Insert: {
          comprehension?: string | null;
          created_at?: string | null;
          flashcard_id: number;
          id?: number;
          new_ease: number;
          new_interval: number;
          prev_ease: number;
          prev_interval: number;
          response: string;
          response_time_ms?: number | null;
          session_type?: string | null;
          user_id: string;
          user_note?: string | null;
        };
        Update: {
          comprehension?: string | null;
          created_at?: string | null;
          flashcard_id?: number;
          id?: number;
          new_ease?: number;
          new_interval?: number;
          prev_ease?: number;
          prev_interval?: number;
          response?: string;
          response_time_ms?: number | null;
          session_type?: string | null;
          user_id?: string;
          user_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "review_sessions_flashcard_id_fkey";
            columns: ["flashcard_id"];
            isOneToOne: false;
            referencedRelation: "flashcards";
            referencedColumns: ["id"];
          },
        ];
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
      search_history: {
        Row: {
          id: string;
          user_id: string;
          query: string;
          keywords: string[];
          result_count: number;
          clicked_bookmark_ids: number[];
          platform_filter: string | null;
          time_filter: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          query: string;
          keywords?: string[];
          result_count?: number;
          clicked_bookmark_ids?: number[];
          platform_filter?: string | null;
          time_filter?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          query?: string;
          keywords?: string[];
          result_count?: number;
          clicked_bookmark_ids?: number[];
          platform_filter?: string | null;
          time_filter?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      share_bundles: {
        Row: {
          bookmark_ids: number[];
          created_at: string;
          description: string | null;
          expires_at: string | null;
          format: string;
          id: string;
          options: Json;
          password_hash: string | null;
          share_id: string;
          title: string;
          updated_at: string;
          user_id: string;
          view_count: number;
          visibility: string;
        };
        Insert: {
          bookmark_ids?: number[];
          created_at?: string;
          description?: string | null;
          expires_at?: string | null;
          format?: string;
          id?: string;
          options?: Json;
          password_hash?: string | null;
          share_id: string;
          title: string;
          updated_at?: string;
          user_id: string;
          view_count?: number;
          visibility?: string;
        };
        Update: {
          bookmark_ids?: number[];
          created_at?: string;
          description?: string | null;
          expires_at?: string | null;
          format?: string;
          id?: string;
          options?: Json;
          password_hash?: string | null;
          share_id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          view_count?: number;
          visibility?: string;
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
      synthesis_highlights: {
        Row: {
          color: string | null;
          content: string;
          created_at: string | null;
          id: string;
          note: string | null;
          position: Json;
          report_id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          content: string;
          created_at?: string | null;
          id?: string;
          note?: string | null;
          position?: Json;
          report_id: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          color?: string | null;
          content?: string;
          created_at?: string | null;
          id?: string;
          note?: string | null;
          position?: Json;
          report_id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      synthesis_reports: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          /** 来源类型: folder, tag, selection, ai_recommend */
          source_type: string;
          /** 来源 ID（文件夹或标签 ID） */
          source_id: string | null;
          /** 手动选择的书签 ID 列表 */
          source_bookmark_ids: string[] | null;
          /** 综述深度: quick, standard, academic */
          depth_mode: string;
          /** 输出风格: narrative, bullet, hybrid */
          output_style: string | null;
          /** 概述内容 */
          overview: string | null;
          /** 核心共识 JSONB 数组 */
          consensus: Json | null;
          /** 观点分歧 JSONB 数组 */
          divergence: Json | null;
          /** 知识盲区 JSONB 数组 */
          blind_spots: Json | null;
          /** 完整 Markdown 文本 */
          full_markdown: string | null;
          /** 状态: pending, generating, completed, failed, cancelled */
          status: string;
          /** 错误信息 */
          error_message: string | null;
          /** 来源书签数量 */
          source_count: number;
          /** 生成字数 */
          word_count: number;
          created_at: string;
          updated_at: string;
          /** 完成时间 */
          completed_at: string | null;
          /** Knowledge Studio v1: 蓝图类型 */
          blueprint_type: string | null;
          /** Knowledge Studio v1: 生成内容 */
          content: string | null;
          /** Knowledge Studio v1: 引用来源 JSONB */
          citations: Json | null;
          /** Knowledge Studio v1: 生成元数据 */
          generation_metadata: Json | null;
          /** Knowledge Studio v1: 版本号 */
          version: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          source_type: string;
          source_id?: string | null;
          source_bookmark_ids?: string[] | null;
          depth_mode?: string;
          output_style?: string | null;
          overview?: string | null;
          consensus?: Json | null;
          divergence?: Json | null;
          blind_spots?: Json | null;
          full_markdown?: string | null;
          status?: string;
          error_message?: string | null;
          source_count?: number;
          word_count?: number;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          blueprint_type?: string | null;
          content?: string | null;
          citations?: Json | null;
          generation_metadata?: Json | null;
          version?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          source_type?: string;
          source_id?: string | null;
          source_bookmark_ids?: string[] | null;
          depth_mode?: string;
          output_style?: string | null;
          overview?: string | null;
          consensus?: Json | null;
          divergence?: Json | null;
          blind_spots?: Json | null;
          full_markdown?: string | null;
          status?: string;
          error_message?: string | null;
          source_count?: number;
          word_count?: number;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          blueprint_type?: string | null;
          content?: string | null;
          citations?: Json | null;
          generation_metadata?: Json | null;
          version?: number | null;
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
      system_jobs: {
        Row: {
          bookmark_id: number | null;
          completed_at: string | null;
          created_at: string;
          depends_on: string | null;
          id: string;
          last_error: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_retries: number;
          payload: Json;
          priority: number;
          result: Json | null;
          retry_count: number;
          scheduled_for: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["job_status"];
          type: Database["public"]["Enums"]["job_type"];
          user_id: string | null;
        };
        Insert: {
          bookmark_id?: number | null;
          completed_at?: string | null;
          created_at?: string;
          depends_on?: string | null;
          id?: string;
          last_error?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_retries?: number;
          payload?: Json;
          priority?: number;
          result?: Json | null;
          retry_count?: number;
          scheduled_for?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          type: Database["public"]["Enums"]["job_type"];
          user_id?: string | null;
        };
        Update: {
          bookmark_id?: number | null;
          completed_at?: string | null;
          created_at?: string;
          depends_on?: string | null;
          id?: string;
          last_error?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_retries?: number;
          payload?: Json;
          priority?: number;
          result?: Json | null;
          retry_count?: number;
          scheduled_for?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          type?: Database["public"]["Enums"]["job_type"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "system_jobs_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_jobs_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_active_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_jobs_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_browser_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_jobs_bookmark_id_fkey";
            columns: ["bookmark_id"];
            isOneToOne: false;
            referencedRelation: "v_content_bookmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "system_jobs_depends_on_fkey";
            columns: ["depends_on"];
            isOneToOne: false;
            referencedRelation: "system_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          created_at: string | null;
          id: number;
          name: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: number;
          name: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: number;
          name?: string;
          updated_at?: string | null;
          user_id?: string;
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
      token_usage_logs: {
        Row: {
          cost: number;
          created_at: string;
          id: string;
          input_tokens: number;
          model: string;
          output_tokens: number;
          request_id: string;
          tier_id: string;
          total_tokens: number;
          user_id: string;
        };
        Insert: {
          cost?: number;
          created_at?: string;
          id?: string;
          input_tokens?: number;
          model: string;
          output_tokens?: number;
          request_id: string;
          tier_id: string;
          total_tokens?: number;
          user_id: string;
        };
        Update: {
          cost?: number;
          created_at?: string;
          id?: string;
          input_tokens?: number;
          model?: string;
          output_tokens?: number;
          request_id?: string;
          tier_id?: string;
          total_tokens?: number;
          user_id?: string;
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
      user_classification_rules: {
        Row: {
          id: number;
          user_id: string;
          type: string;
          pattern: string;
          pattern_type: string;
          target_folder_id: number;
          target_folder_name: string;
          priority: number;
          source_text: string | null;
          description: string | null;
          is_active: boolean;
          match_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          type: string;
          pattern: string;
          pattern_type: string;
          target_folder_id: number;
          target_folder_name: string;
          priority?: number;
          source_text?: string | null;
          description?: string | null;
          is_active?: boolean;
          match_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          type?: string;
          pattern?: string;
          pattern_type?: string;
          target_folder_id?: number;
          target_folder_name?: string;
          priority?: number;
          source_text?: string | null;
          description?: string | null;
          is_active?: boolean;
          match_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_classification_rules_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_classification_rules_target_folder_id_fkey";
            columns: ["target_folder_id"];
            isOneToOne: false;
            referencedRelation: "folder_stats";
            referencedColumns: ["folder_id"];
          },
          {
            foreignKeyName: "user_classification_rules_target_folder_id_fkey";
            columns: ["target_folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
        ];
      };
      user_corrections: {
        Row: {
          ai_action: string;
          ai_intent_type: string | null;
          ai_parameters: Json | null;
          corrected_action: string | null;
          corrected_intent_type: string | null;
          corrected_parameters: Json | null;
          correction_type: string;
          created_at: string;
          feedback_applied: boolean;
          feedback_text: string | null;
          id: string;
          session_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_action: string;
          ai_intent_type?: string | null;
          ai_parameters?: Json | null;
          corrected_action?: string | null;
          corrected_intent_type?: string | null;
          corrected_parameters?: Json | null;
          correction_type: string;
          created_at?: string;
          feedback_applied?: boolean;
          feedback_text?: string | null;
          id?: string;
          session_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_action?: string;
          ai_intent_type?: string | null;
          ai_parameters?: Json | null;
          corrected_action?: string | null;
          corrected_intent_type?: string | null;
          corrected_parameters?: Json | null;
          correction_type?: string;
          created_at?: string;
          feedback_applied?: boolean;
          feedback_text?: string | null;
          id?: string;
          session_id?: string | null;
          updated_at?: string;
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
      weekly_review_queue: {
        Row: {
          completed_count: number | null;
          completed_ids: number[];
          created_at: string | null;
          flashcard_ids: number[];
          id: number;
          total_count: number | null;
          updated_at: string | null;
          user_id: string;
          week_start: string;
        };
        Insert: {
          completed_count?: number | null;
          completed_ids?: number[];
          created_at?: string | null;
          flashcard_ids?: number[];
          id?: number;
          total_count?: number | null;
          updated_at?: string | null;
          user_id: string;
          week_start: string;
        };
        Update: {
          completed_count?: number | null;
          completed_ids?: number[];
          created_at?: string | null;
          flashcard_ids?: number[];
          id?: number;
          total_count?: number | null;
          updated_at?: string | null;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      workflow_executions: {
        Row: {
          id: string;
          workflow_id: string;
          user_id: string;
          status: string;
          trigger_type: string;
          trigger_context: Json;
          current_step_index: number;
          step_results: Json;
          error_message: string | null;
          started_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workflow_id: string;
          user_id: string;
          status?: string;
          trigger_type?: string;
          trigger_context?: Json;
          current_step_index?: number;
          step_results?: Json;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workflow_id?: string;
          user_id?: string;
          status?: string;
          trigger_type?: string;
          trigger_context?: Json;
          current_step_index?: number;
          step_results?: Json;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
        ];
      };
      workflows: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          description: string | null;
          definition: Json;
          category: string;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          description?: string | null;
          definition: Json;
          category?: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          description?: string | null;
          definition?: Json;
          category?: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
      embedding_queue_stats: {
        Row: {
          avg_processing_time_seconds: number | null;
          failed_count: number | null;
          oldest_pending: string | null;
          pending_content: number | null;
          pending_count: number | null;
          pending_full: number | null;
          pending_tags: number | null;
          pending_title: number | null;
          processed_24h: number | null;
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
      v_active_bookmarks: {
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
          embedding_version: number | null;
          folder_id: number | null;
          has_snapshot: boolean | null;
          id: number | null;
          image_count: number | null;
          import_batch_id: string | null;
          import_source: string | null;
          invalidated_at: string | null;
          is_in_trash: boolean | null;
          is_invalid: boolean | null;
          is_locked: boolean | null;
          is_marked_for_deletion: boolean | null;
          is_read: boolean | null;
          is_starred: boolean | null;
          last_snapshot_at: string | null;
          last_validation_at: string | null;
          notes: string | null;
          pending_cluster: boolean | null;
          pending_since: string | null;
          platform: string | null;
          platform_content_id: string | null;
          publish_time: string | null;
          rating: number | null;
          read_at: string | null;
          search_vector: unknown;
          shadow_confidence: number | null;
          shadow_folder_id: number | null;
          shadow_folder_name: string | null;
          shadow_suggested_at: string | null;
          snapshot_status: string | null;
          source_name: string | null;
          starred_at: string | null;
          status: string | null;
          tag_embedding: string | null;
          tag_embedding_at: string | null;
          title: string | null;
          title_embedding: string | null;
          title_embedding_at: string | null;
          trashed_at: string | null;
          updated_at: string | null;
          url: string | null;
          user_id: string | null;
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
          embedding_version?: number | null;
          folder_id?: number | null;
          has_snapshot?: boolean | null;
          id?: number | null;
          image_count?: number | null;
          import_batch_id?: string | null;
          import_source?: string | null;
          invalidated_at?: string | null;
          is_in_trash?: boolean | null;
          is_invalid?: boolean | null;
          is_locked?: boolean | null;
          is_marked_for_deletion?: boolean | null;
          is_read?: boolean | null;
          is_starred?: boolean | null;
          last_snapshot_at?: string | null;
          last_validation_at?: string | null;
          notes?: string | null;
          pending_cluster?: boolean | null;
          pending_since?: string | null;
          platform?: string | null;
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
          title?: string | null;
          title_embedding?: string | null;
          title_embedding_at?: string | null;
          trashed_at?: string | null;
          updated_at?: string | null;
          url?: string | null;
          user_id?: string | null;
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
          embedding_version?: number | null;
          folder_id?: number | null;
          has_snapshot?: boolean | null;
          id?: number | null;
          image_count?: number | null;
          import_batch_id?: string | null;
          import_source?: string | null;
          invalidated_at?: string | null;
          is_in_trash?: boolean | null;
          is_invalid?: boolean | null;
          is_locked?: boolean | null;
          is_marked_for_deletion?: boolean | null;
          is_read?: boolean | null;
          is_starred?: boolean | null;
          last_snapshot_at?: string | null;
          last_validation_at?: string | null;
          notes?: string | null;
          pending_cluster?: boolean | null;
          pending_since?: string | null;
          platform?: string | null;
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
          title?: string | null;
          title_embedding?: string | null;
          title_embedding_at?: string | null;
          trashed_at?: string | null;
          updated_at?: string | null;
          url?: string | null;
          user_id?: string | null;
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
      v_browser_bookmarks: {
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
          embedding_version: number | null;
          folder_id: number | null;
          has_snapshot: boolean | null;
          id: number | null;
          image_count: number | null;
          import_batch_id: string | null;
          import_source: string | null;
          invalidated_at: string | null;
          is_in_trash: boolean | null;
          is_invalid: boolean | null;
          is_locked: boolean | null;
          is_marked_for_deletion: boolean | null;
          is_read: boolean | null;
          is_starred: boolean | null;
          last_snapshot_at: string | null;
          last_validation_at: string | null;
          notes: string | null;
          pending_cluster: boolean | null;
          pending_since: string | null;
          platform: string | null;
          platform_content_id: string | null;
          publish_time: string | null;
          rating: number | null;
          read_at: string | null;
          search_vector: unknown;
          shadow_confidence: number | null;
          shadow_folder_id: number | null;
          shadow_folder_name: string | null;
          shadow_suggested_at: string | null;
          snapshot_status: string | null;
          source_name: string | null;
          starred_at: string | null;
          status: string | null;
          tag_embedding: string | null;
          tag_embedding_at: string | null;
          title: string | null;
          title_embedding: string | null;
          title_embedding_at: string | null;
          trashed_at: string | null;
          updated_at: string | null;
          url: string | null;
          user_id: string | null;
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
          embedding_version?: number | null;
          folder_id?: number | null;
          has_snapshot?: boolean | null;
          id?: number | null;
          image_count?: number | null;
          import_batch_id?: string | null;
          import_source?: string | null;
          invalidated_at?: string | null;
          is_in_trash?: boolean | null;
          is_invalid?: boolean | null;
          is_locked?: boolean | null;
          is_marked_for_deletion?: boolean | null;
          is_read?: boolean | null;
          is_starred?: boolean | null;
          last_snapshot_at?: string | null;
          last_validation_at?: string | null;
          notes?: string | null;
          pending_cluster?: boolean | null;
          pending_since?: string | null;
          platform?: string | null;
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
          title?: string | null;
          title_embedding?: string | null;
          title_embedding_at?: string | null;
          trashed_at?: string | null;
          updated_at?: string | null;
          url?: string | null;
          user_id?: string | null;
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
          embedding_version?: number | null;
          folder_id?: number | null;
          has_snapshot?: boolean | null;
          id?: number | null;
          image_count?: number | null;
          import_batch_id?: string | null;
          import_source?: string | null;
          invalidated_at?: string | null;
          is_in_trash?: boolean | null;
          is_invalid?: boolean | null;
          is_locked?: boolean | null;
          is_marked_for_deletion?: boolean | null;
          is_read?: boolean | null;
          is_starred?: boolean | null;
          last_snapshot_at?: string | null;
          last_validation_at?: string | null;
          notes?: string | null;
          pending_cluster?: boolean | null;
          pending_since?: string | null;
          platform?: string | null;
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
          title?: string | null;
          title_embedding?: string | null;
          title_embedding_at?: string | null;
          trashed_at?: string | null;
          updated_at?: string | null;
          url?: string | null;
          user_id?: string | null;
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
      v_content_bookmarks: {
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
          embedding_version: number | null;
          folder_id: number | null;
          has_snapshot: boolean | null;
          id: number | null;
          image_count: number | null;
          import_batch_id: string | null;
          import_source: string | null;
          invalidated_at: string | null;
          is_in_trash: boolean | null;
          is_invalid: boolean | null;
          is_locked: boolean | null;
          is_marked_for_deletion: boolean | null;
          is_read: boolean | null;
          is_starred: boolean | null;
          last_snapshot_at: string | null;
          last_validation_at: string | null;
          notes: string | null;
          pending_cluster: boolean | null;
          pending_since: string | null;
          platform: string | null;
          platform_content_id: string | null;
          publish_time: string | null;
          rating: number | null;
          read_at: string | null;
          search_vector: unknown;
          shadow_confidence: number | null;
          shadow_folder_id: number | null;
          shadow_folder_name: string | null;
          shadow_suggested_at: string | null;
          snapshot_status: string | null;
          source_name: string | null;
          starred_at: string | null;
          status: string | null;
          tag_embedding: string | null;
          tag_embedding_at: string | null;
          title: string | null;
          title_embedding: string | null;
          title_embedding_at: string | null;
          trashed_at: string | null;
          updated_at: string | null;
          url: string | null;
          user_id: string | null;
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
          embedding_version?: number | null;
          folder_id?: number | null;
          has_snapshot?: boolean | null;
          id?: number | null;
          image_count?: number | null;
          import_batch_id?: string | null;
          import_source?: string | null;
          invalidated_at?: string | null;
          is_in_trash?: boolean | null;
          is_invalid?: boolean | null;
          is_locked?: boolean | null;
          is_marked_for_deletion?: boolean | null;
          is_read?: boolean | null;
          is_starred?: boolean | null;
          last_snapshot_at?: string | null;
          last_validation_at?: string | null;
          notes?: string | null;
          pending_cluster?: boolean | null;
          pending_since?: string | null;
          platform?: string | null;
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
          title?: string | null;
          title_embedding?: string | null;
          title_embedding_at?: string | null;
          trashed_at?: string | null;
          updated_at?: string | null;
          url?: string | null;
          user_id?: string | null;
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
          embedding_version?: number | null;
          folder_id?: number | null;
          has_snapshot?: boolean | null;
          id?: number | null;
          image_count?: number | null;
          import_batch_id?: string | null;
          import_source?: string | null;
          invalidated_at?: string | null;
          is_in_trash?: boolean | null;
          is_invalid?: boolean | null;
          is_locked?: boolean | null;
          is_marked_for_deletion?: boolean | null;
          is_read?: boolean | null;
          is_starred?: boolean | null;
          last_snapshot_at?: string | null;
          last_validation_at?: string | null;
          notes?: string | null;
          pending_cluster?: boolean | null;
          pending_since?: string | null;
          platform?: string | null;
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
          title?: string | null;
          title_embedding?: string | null;
          title_embedding_at?: string | null;
          trashed_at?: string | null;
          updated_at?: string | null;
          url?: string | null;
          user_id?: string | null;
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
      analyze_user_preferences: { Args: { p_user_id: string }; Returns: Json };
      assign_cluster_id: {
        Args: {
          p_bookmark_ids: number[];
          p_cluster_id: string;
          p_confidence: number;
        };
        Returns: number;
      };
      batch_add_tags: {
        Args: { p_bookmark_ids: number[]; p_tags: string[] };
        Returns: Json;
      };
      batch_create_flashcards: {
        Args: { p_bookmark_id: number; p_flashcards: Json; p_user_id: string };
        Returns: Json;
      };
      batch_remove_tags: {
        Args: { p_bookmark_ids: number[]; p_tags: string[] };
        Returns: Json;
      };
      batch_reorder_folders: {
        Args: { p_updates: Json; p_user_id: string };
        Returns: Json;
      };
      batch_update_health_status: {
        Args: { p_updates: Json; p_user_id: string };
        Returns: number;
      };
      batch_upsert_knowledge_links: {
        Args: { p_links: Json; p_user_id: string };
        Returns: number;
      };
      calculate_matcher_weight_adjustments: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      calculate_next_review_date: {
        Args: { p_retention_score?: number; p_review_stage: number };
        Returns: string;
      };
      calculate_sm2_next_review: {
        Args: {
          p_current_ease_factor: number;
          p_current_interval: number;
          p_rating: number;
        };
        Returns: {
          new_ease_factor: number;
          new_interval: number;
          new_mastery_level: string;
        }[];
      };
      calculate_folder_entropy: {
        Args: { p_folder_id: number };
        Returns: {
          entropy_score: number;
          bookmark_count: number;
          avg_similarity: number;
          similarity_stddev: number;
        }[];
      };
      calculate_all_folder_entropy: {
        Args: Record<string, never>;
        Returns: {
          folder_id: number;
          folder_name: string;
          entropy_score: number;
          bookmark_count: number;
        }[];
      };
      can_create_snapshot: {
        Args: { p_estimated_size?: number; p_user_id: string };
        Returns: boolean;
      };
      cancel_job: {
        Args: { p_job_id: string; p_user_id: string };
        Returns: boolean;
      };
      cascade_delete_folder: {
        Args: { p_folder_id: number; p_user_id: string };
        Returns: { deleted_folder_count: number; moved_bookmark_count: number };
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
      check_rate_limit: {
        Args: {
          p_identifier: string;
          p_config_key: string;
          p_window_start: string;
          p_max_requests: number;
          p_window_ms: number;
        };
        Returns: {
          allowed: boolean;
          remaining: number;
          reset_ms: number;
        }[];
      };
      claim_jobs_batch: {
        Args: {
          p_job_types?: Database["public"]["Enums"]["job_type"][];
          p_limit?: number;
          p_lock_duration?: unknown;
          p_worker_id: string;
        };
        Returns: {
          bookmark_id: number | null;
          completed_at: string | null;
          created_at: string;
          depends_on: string | null;
          id: string;
          last_error: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_retries: number;
          payload: Json;
          priority: number;
          result: Json | null;
          retry_count: number;
          scheduled_for: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["job_status"];
          type: Database["public"]["Enums"]["job_type"];
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "system_jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_next_job:
        | {
            Args: {
              p_job_types?: Database["public"]["Enums"]["job_type"][];
              p_lock_duration?: unknown;
              p_worker_id: string;
            };
            Returns: {
              bookmark_id: number | null;
              completed_at: string | null;
              created_at: string;
              depends_on: string | null;
              id: string;
              last_error: string | null;
              locked_at: string | null;
              locked_by: string | null;
              max_retries: number;
              payload: Json;
              priority: number;
              result: Json | null;
              retry_count: number;
              scheduled_for: string | null;
              started_at: string | null;
              status: Database["public"]["Enums"]["job_status"];
              type: Database["public"]["Enums"]["job_type"];
              user_id: string | null;
            }[];
            SetofOptions: {
              from: "*";
              to: "system_jobs";
              isOneToOne: false;
              isSetofReturn: true;
            };
          }
        | {
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
      cleanup_expired_ai_snapshots: { Args: never; Returns: number };
      cleanup_expired_folder_exclusions: { Args: never; Returns: number };
      cleanup_expired_insights: { Args: never; Returns: number };
      cleanup_expired_messages: { Args: never; Returns: number };
      cleanup_expired_oauth_codes: { Args: never; Returns: number };
      cleanup_expired_oauth_states: { Args: never; Returns: undefined };
      cleanup_expired_session_memory: { Args: never; Returns: number };
      cleanup_old_ai_memory: {
        Args: { p_log_days?: number; p_summary_days?: number };
        Returns: Json;
      };
      cleanup_old_ai_messages: { Args: { p_days?: number }; Returns: number };
      cleanup_old_ai_preferences_audit: { Args: never; Returns: number };
      cleanup_old_chat_cache: { Args: { p_days?: number }; Returns: number };
      cleanup_old_intent_history: {
        Args: { p_days?: number };
        Returns: number;
      };
      cleanup_old_jobs: {
        Args: { p_retention_days?: number };
        Returns: number;
      };
      cleanup_old_patrol_reports: { Args: never; Returns: undefined };
      cleanup_old_token_usage_logs: { Args: never; Returns: number };
      cleanup_old_trash: { Args: { days_to_keep?: number }; Returns: number };
      clear_bookmark_pending_cluster: {
        Args: { p_bookmark_id: number; p_user_id: string };
        Returns: boolean;
      };
      clone_template: {
        Args: { p_new_name?: string; p_template_id: string };
        Returns: string;
      };
      complete_job:
        | { Args: { p_job_id: string; p_result?: Json }; Returns: boolean }
        | {
            Args: {
              p_error?: string;
              p_job_id: string;
              p_result?: Json;
              p_success: boolean;
            };
            Returns: undefined;
          };
      compute_folder_heat: { Args: { p_folder_id: number }; Returns: number };
      compute_folder_profile:
        | { Args: { p_folder_id: number; p_user_id: string }; Returns: Json }
        | { Args: { p_folder_id: number }; Returns: undefined };
      compute_user_folder_profiles: {
        Args: { p_user_id: string };
        Returns: number;
      };
      confirm_quota: {
        Args: { p_request_id: string; p_synthesis_report_id?: string };
        Returns: boolean;
      };
      create_ai_operation_snapshot: {
        Args: {
          p_bookmark_ids: number[];
          p_operation_description: string;
          p_operation_type: string;
          p_ttl_hours?: number;
          p_user_id: string;
        };
        Returns: string;
      };
      create_incremental_update_task: {
        Args: {
          p_change_set_id: string;
          p_impact_analysis: Json;
          p_report_id: string;
        };
        Returns: string;
      };
      create_trial_discount_offer: {
        Args: {
          p_discount_percent?: number;
          p_offer_type: string;
          p_user_id: string;
          p_valid_days?: number;
        };
        Returns: Json;
      };
      decrement_storage_used:
        | { Args: { target_user_id: string }; Returns: undefined }
        | {
            Args: { decrement_by?: number; target_user_id: string };
            Returns: undefined;
          };
      deduct_quota: {
        Args: {
          p_cost: number;
          p_operation_type: string;
          p_request_id: string;
          p_user_id: string;
        };
        Returns: string;
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
        Returns: Json;
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
      find_similar_context_anchors: {
        Args: {
          p_user_id: string;
          p_query_embedding: string;
          p_similarity_threshold: number;
          p_limit: number;
        };
        Returns: {
          anchor_id: number;
          anchor_type: string;
          anchor_name: string;
          anchor_metadata: Json;
          bookmark_count: number;
          similarity: number;
        }[];
      };
      find_similar_corrections: {
        Args: {
          limit_count?: number;
          query_embedding: string;
          similarity_threshold?: number;
          target_user_id: string;
        };
        Returns: {
          correct_intent: string;
          id: string;
          original_input: string;
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
      get_ai_feedback_stats: {
        Args: { p_user_id: string };
        Returns: {
          negative_count: number;
          positive_count: number;
          satisfaction_rate: number;
          total_count: number;
        }[];
      };
      get_ai_folder_settings: { Args: { p_user_id: string }; Returns: Json };
      get_ai_global_insight: { Args: { p_user_id: string }; Returns: Json };
      get_blueprint_recommendations: {
        Args: {
          p_limit?: number;
          p_user_id: string;
        };
        Returns: {
          blueprint_id: string;
          last_used_at: string | null;
          recommendation_type: string;
          score: number;
          use_count: number;
        }[];
      };
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
      get_bookmarks_for_review: {
        Args: {
          p_include_overdue?: boolean;
          p_limit?: number;
          p_user_id: string;
        };
        Returns: {
          bookmark_id: number;
          days_overdue: number;
          last_retention_score: number;
          review_stage: number;
          title: string;
          url: string;
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
      get_chunk_stats: {
        Args: { p_user_id?: string };
        Returns: {
          avg_chunks_per_bookmark: number;
          bookmarks_with_chunks: number;
          child_chunks: number;
          parent_chunks: number;
          total_chunks: number;
        }[];
      };
      get_consumption_summary: {
        Args: { p_end_date: string; p_start_date: string; p_user_id: string };
        Returns: Json;
      };
      get_conversion_funnel_metrics: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: Json;
      };
      get_due_for_review: {
        Args: { p_limit?: number; p_user_id: string };
        Returns: {
          content: string;
          interval_days: number;
          knowledge_point_id: string;
          last_reviewed_at: string;
          mastery_level: string;
          next_review_at: string;
          overdue_days: number;
        }[];
      };
      get_expiring_trials: {
        Args: { p_within_days?: number };
        Returns: {
          conversion_stage: string;
          converted_at: string | null;
          created_at: string;
          expires_at: string;
          features_experienced: string[];
          generations_used: number;
          id: string;
          last_active_at: string;
          metadata: Json | null;
          started_at: string;
          status: string;
          updated_at: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "ks_user_trial_states";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_folder_descendant_ids: {
        Args: { p_folder_id: number; p_user_id: string };
        Returns: number[];
      };
      get_folder_bookmark_stats: {
        Args: {
          p_folder_ids: number[];
          p_today_start: string;
          p_user_id: string;
        };
        Returns: Database["public"]["CompositeTypes"]["folder_bookmark_stats"][];
        SetofOptions: {
          from: "*";
          to: "folder_bookmark_stats";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_folder_path: {
        Args: { p_folder_id: number };
        Returns: {
          depth: number;
          id: number;
          name: string;
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
      get_folders_with_counts: {
        Args: { p_user_id: string };
        Returns: {
          bookmarkCount: number;
          created_at: string;
          deleted_at: string;
          folder_group: string;
          id: number;
          is_archived: boolean;
          is_system: boolean;
          name: string;
          parent_id: number;
          sort_order: number;
          system_type: string;
          updated_at: string;
          user_id: string;
        }[];
      };
      get_intent_cache_stats: {
        Args: Record<string, never>;
        Returns: {
          total_count: number;
          with_embedding_count: number;
          expired_count: number;
          total_hits: number;
          avg_confidence: number;
          cache_types: Json;
        }[];
      };
      get_intent_stats: {
        Args: { p_days?: number; p_user_id: string };
        Returns: {
          avg_confidence: number;
          count: number;
          intent_sub_type: string;
          intent_type: string;
          success_count: number;
        }[];
      };
      get_interaction_stats: {
        Args: { p_days?: number; p_user_id: string };
        Returns: Json;
      };
      get_job_stats: {
        Args: { p_user_id?: string };
        Returns: {
          count: number;
          status: Database["public"]["Enums"]["job_status"];
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
      get_last_session_summary: {
        Args: { p_exclude_conversation_id?: string; p_user_id: string };
        Returns: {
          conversation_id: string;
          current_focus: Json;
          previous_session_summary: Json;
          updated_at: string;
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
      get_negative_feedback_reasons: {
        Args: { p_limit?: number };
        Returns: {
          count: number;
          percentage: number;
          reason: string;
        }[];
      };
      get_offline_changes: {
        Args: { p_since: string; p_user_id: string };
        Returns: {
          new_bookmarks_count: number;
          platforms: Json;
          top_tags: Json;
          untagged_count: number;
        }[];
      };
      get_or_create_ai_generated_folder: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_or_create_inbox_folder: {
        Args: { p_user_id?: string };
        Returns: number;
      };
      get_or_create_review_preferences: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      get_or_create_session_memory: {
        Args: { p_conversation_id: string; p_user_id: string };
        Returns: {
          conversation_id: string;
          created_at: string;
          current_focus: Json | null;
          expires_at: string;
          id: string;
          last_intent: string | null;
          message_count: number;
          previous_session_summary: Json | null;
          state: Json;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "ai_session_memory";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_pending_change_sets: {
        Args: { p_limit?: number; p_user_id: string };
        Returns: {
          changes: Json;
          created_at: string;
          id: string;
          impact_level: string;
          report_id: string;
        }[];
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
      get_pending_embedding_tasks: {
        Args: { p_limit?: number; p_lock_for_update?: boolean };
        Returns: {
          bookmark_id: number;
          created_at: string;
          id: number;
          priority: number;
          retry_count: number;
          update_type: string;
          user_id: string;
        }[];
      };
      get_pending_flashcards: {
        Args: {
          p_excluded_folders?: number[];
          p_included_folders?: number[];
          p_limit?: number;
          p_user_id: string;
        };
        Returns: {
          answer: string;
          bookmark_id: number;
          bookmark_title: string;
          bookmark_url: string;
          days_overdue: number;
          ease_factor: number;
          flashcard_id: number;
          interval_days: number;
          next_review_at: string;
          priority_score: number;
          question: string;
          repetitions: number;
          source_paragraph: string;
          status: string;
        }[];
      };
      get_pending_intents: { Args: { p_user_id: string }; Returns: string[] };
      get_pending_suggestions_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_quota_usage_summary: {
        Args: {
          p_period_end?: string;
          p_period_start?: string;
          p_user_id: string;
        };
        Returns: {
          operation_count: number;
          total_consumed: number;
          total_pending: number;
          total_refunded: number;
        }[];
      };
      get_recent_searches: {
        Args: { p_user_id: string; p_limit?: number };
        Returns: {
          id: string;
          query: string;
          result_count: number;
          created_at: string;
        }[];
      };
      get_recent_summaries: {
        Args: { p_limit?: number; p_user_id: string };
        Returns: {
          actions: Json;
          created_at: string;
          id: string;
          intents: string[];
          message_count: number;
          pending_intents: string[];
          sentiment: string;
          session_id: string;
          summary: string;
        }[];
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
      get_report_update_history: {
        Args: { p_limit?: number; p_report_id: string };
        Returns: {
          change_summary: string;
          created_at: string;
          id: string;
          paragraphs_regenerated: number;
          paragraphs_updated: number;
          source: string;
          tokens_used: number;
          version: number;
        }[];
      };
      get_review_related_bookmarks: {
        Args: { p_bookmark_id: number; p_limit?: number; p_user_id: string };
        Returns: {
          id: number;
          relevance_reason: string;
          similarity: number;
          title: string;
        }[];
      };
      get_review_stats: {
        Args: { p_time_range?: string; p_user_id: string };
        Returns: Json;
      };
      get_suggestion_bookmark_ids: {
        Args: { p_suggestion_id: number };
        Returns: number[];
      };
      get_synthesis_recommend_preferences: {
        Args: { p_user_id: string };
        Returns: Json;
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
      get_today_reading_items: {
        Args: { p_user_id: string };
        Returns: {
          bookmark_id: number;
          estimated_read_time: number;
          is_review: boolean;
          item_id: string;
          plan_name: string;
          platform: string;
          priority: string;
          status: string;
          title: string;
          url: string;
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
      get_user_active_sessions: {
        Args: { p_user_id: string };
        Returns: {
          conversation_id: string;
          created_at: string;
          expires_in: unknown;
          last_intent: string;
          message_count: number;
          updated_at: string;
        }[];
      };
      get_user_ai_stats: {
        Args: { p_days?: number; p_user_id: string };
        Returns: {
          avg_latency_ms: number;
          success_rate: number;
          total_conversations: number;
          total_messages: number;
          total_skill_executions: number;
          total_tokens_used: number;
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
      get_user_health_stats: { Args: { p_user_id: string }; Returns: Json };
      get_user_hot_keywords: {
        Args: { p_user_id: string; p_limit?: number; p_days?: number };
        Returns: {
          keyword: string;
          count: number;
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
      get_user_learning_stats: {
        Args: { target_user_id: string };
        Returns: Json;
      };
      get_user_mastery_stats: { Args: { p_user_id: string }; Returns: Json };
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
      get_user_token_stats: {
        Args: {
          p_month_start?: string;
          p_today_start?: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      get_user_trust_mode: { Args: { p_user_id: string }; Returns: Json };
      get_undoable_ai_operations: {
        Args: { p_user_id: string; p_limit?: number };
        Returns: {
          id: string;
          operation_type: string;
          operation_description: string | null;
          conversation_id: string | null;
          skill_id: string | null;
          bookmark_ids: number[] | null;
          before_state: Json;
          after_state: Json | null;
          summary: string | null;
          created_at: string;
          expires_at: string;
          is_reverted: boolean;
        }[];
      };
      get_top_intent_cache_entries: {
        Args: { top_k?: number };
        Returns: {
          id: number;
          input_hash: string;
          normalized_input: string;
          intent_type: string;
          intent_subtype: string | null;
          confidence: number;
          hit_count: number;
          message_embedding: string | null;
        }[];
      };
      get_user_usage_stats: {
        Args: {
          p_end_date?: string;
          p_period?: string;
          p_start_date?: string;
          p_user_id: string;
        };
        Returns: Json;
      };
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
      increment_correction_applied_count: {
        Args: { correction_id: string };
        Returns: undefined;
      };
      increment_intent_cache_hit: {
        Args: { p_cache_id: number };
        Returns: undefined;
      };
      increment_rule_match_count: {
        Args: { p_rule_id: number };
        Returns: undefined;
      };
      increment_monitor_change_count: {
        Args: { p_monitor_id: string };
        Returns: undefined;
      };
      increment_snapshot_version: {
        Args: { p_snapshot_id: number };
        Returns: number;
      };
      increment_storage_used: {
        Args: { target_user_id: string };
        Returns: undefined;
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
      increment_trust_mode_stats: {
        Args: {
          p_auto_decisions?: number;
          p_pending_confirmations?: number;
          p_user_corrections?: number;
          p_user_id: string;
        };
        Returns: undefined;
      };
      init_smart_list_presets: { Args: { p_user_id: string }; Returns: number };
      mark_bookmark_pending_cluster: {
        Args: { p_bookmark_id: number; p_user_id: string };
        Returns: boolean;
      };
      mark_embedding_task_completed: {
        Args: { p_task_ids: number[] };
        Returns: number;
      };
      mark_embedding_task_failed: {
        Args: { p_error_message: string; p_task_id: number };
        Returns: undefined;
      };
      mark_flashcard_completed_in_queue: {
        Args: { p_flashcard_id: number; p_user_id: string };
        Returns: Json;
      };
      mark_messages_read: {
        Args: { p_message_ids?: number[]; p_user_id: string };
        Returns: number;
      };
      mark_operation_undone: {
        Args: { p_operation_id: string; p_user_id: string };
        Returns: boolean;
      };
      match_intent_cache_semantic: {
        Args: {
          query_embedding: string;
          similarity_threshold?: number;
          match_count?: number;
        };
        Returns: {
          id: number;
          input_hash: string;
          normalized_input: string;
          original_message: string | null;
          intent_type: string;
          intent_subtype: string | null;
          confidence: number;
          method: string;
          slots: Json | null;
          similarity: number;
        }[];
      };
      merge_folders_atomic: {
        Args: {
          p_source_folder_id: number;
          p_target_folder_id: number;
          p_user_id: string;
        };
        Returns: Json;
      };
      queue_embedding_update: {
        Args: {
          p_bookmark_id: number;
          p_priority?: number;
          p_update_type: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      record_blueprint_usage: {
        Args: {
          p_blueprint_id: string;
          p_length_mode?: string;
          p_platform_style?: string;
          p_success?: boolean;
          p_user_id: string;
        };
        Returns: undefined;
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
      record_intent_history: {
        Args: {
          p_confidence?: number;
          p_context?: Json;
          p_intent_sub_type?: string;
          p_intent_type: string;
          p_message_preview?: string;
          p_success?: boolean;
          p_user_id: string;
        };
        Returns: string;
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
      record_review_and_update_mastery: {
        Args: {
          p_knowledge_point_id: string;
          p_rating: number;
          p_response_time_ms?: number;
          p_session_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      record_search_click: {
        Args: { p_search_id: string; p_bookmark_id: number };
        Returns: undefined;
      };
      refund_quota: {
        Args: { p_error_message?: string; p_request_id: string };
        Returns: boolean;
      };
      reject_classification_suggestions: {
        Args: { p_suggestion_ids: number[]; p_user_id: string };
        Returns: number;
      };
      remove_pending_intent: {
        Args: { p_intent: string; p_user_id: string };
        Returns: undefined;
      };
      reset_stuck_md_collections: {
        Args: { p_stuck_threshold_minutes?: number; p_user_id: string };
        Returns: Json;
      };
      reset_ks_daily_counts: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      reset_ks_weekly_counts: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      revert_ai_operation_snapshot: {
        Args: { p_snapshot_id: string; p_user_id: string };
        Returns: {
          error_message: string;
          restored_count: number;
          success: boolean;
        }[];
      };
      revoke_all_plugin_authorizations: {
        Args: { p_user_id: string };
        Returns: number;
      };
      rollback_report_to_version: {
        Args: { p_report_id: string; p_target_version: number };
        Returns: Json;
      };
      save_bookmark_chunks_atomic: {
        Args: {
          p_bookmark_id: number;
          p_chunks: Database["public"]["CompositeTypes"]["chunk_input"][];
          p_embedding_version?: string;
        };
        Returns: {
          child_count: number;
          error_message: string;
          parent_count: number;
          success: boolean;
        }[];
      };
      save_session_state: {
        Args: {
          p_conversation_id: string;
          p_last_intent?: string;
          p_message_count?: number;
          p_state: Json;
          p_user_id: string;
        };
        Returns: boolean;
      };
      search_bookmark_chunks: {
        Args: {
          match_count?: number;
          match_threshold?: number;
          p_user_id?: string;
          query_embedding: string;
        };
        Returns: {
          bookmark_id: number;
          chunk_content: string;
          chunk_id: string;
          chunk_index: number;
          chunk_type: string;
          parent_content: string;
          similarity: number;
        }[];
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
      search_md_collections_semantic: {
        Args: {
          match_count?: number;
          match_threshold?: number;
          p_user_id: string;
          query_embedding: string;
        };
        Returns: {
          ai_summary: string;
          id: number;
          similarity: number;
          title: string;
        }[];
      };
      search_public_templates: {
        Args: { p_limit?: number; p_offset?: number; p_query: string };
        Returns: {
          base_blueprint: string;
          created_at: string;
          description: string;
          icon: string;
          id: string;
          name: string;
          tags: string[];
          usage_count: number;
          user_id: string;
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
      start_user_trial: {
        Args: { p_duration_days?: number; p_user_id: string };
        Returns: Json;
      };
      shadow_sorting_batch_confirm: {
        Args: { p_bookmark_ids: number[] };
        Returns: {
          bookmark_id: number;
          success: boolean;
          error_message: string | null;
        }[];
      };
      shadow_sorting_batch_reject: {
        Args: { p_bookmark_ids: number[] };
        Returns: {
          bookmark_id: number;
          success: boolean;
          error_message: string | null;
        }[];
      };
      toggle_bookmark_starred: {
        Args: { p_bookmark_id: number; p_user_id: string };
        Returns: boolean;
      };
      undo_ai_operation: {
        Args: { p_snapshot_id: string; p_user_id: string };
        Returns: {
          message: string | null;
          restored_count: number;
          success: boolean;
        }[];
      };
      update_ai_folder_settings: {
        Args: { p_settings: Json; p_user_id: string };
        Returns: Json;
      };
      update_ai_global_insight: {
        Args: { p_insight: Json; p_user_id: string };
        Returns: undefined;
      };
      update_ai_learned_preferences: {
        Args: { p_learned: Json; p_user_id: string };
        Returns: undefined;
      };
      update_bookmark_read_record: {
        Args: { p_bookmark_id: number; p_user_id: string };
        Returns: undefined;
      };
      update_bookmark_review_record: {
        Args: {
          p_bookmark_id: number;
          p_retention_score?: number;
          p_user_id: string;
        };
        Returns: {
          new_stage: number;
          next_review: string;
        }[];
      };
      update_flashcard_review: {
        Args: {
          p_comprehension?: string;
          p_flashcard_id: number;
          p_new_ease?: number;
          p_new_interval?: number;
          p_new_repetitions?: number;
          p_response: string;
          p_response_time_ms?: number;
          p_session_type?: string;
          p_user_id: string;
          p_user_note?: string;
        };
        Returns: Json;
      };
      update_folder_heat: { Args: { p_folder_id: number }; Returns: undefined };
      update_folder_name_embedding: {
        Args: { p_folder_id: number; p_name_embedding: string };
        Returns: undefined;
      };
      update_last_visit_time: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      update_md_collection_status: {
        Args: {
          p_collection_id: number;
          p_expected_status?: string;
          p_new_status: string;
          p_update_data?: Json;
          p_user_id: string;
        };
        Returns: Json;
      };
      update_session_cross_memory: {
        Args: {
          p_conversation_id: string;
          p_current_focus?: Json;
          p_previous_summary: Json;
          p_user_id: string;
        };
        Returns: undefined;
      };
      update_synthesis_recommend_preferences: {
        Args: {
          p_clear_dismissed?: boolean;
          p_dismissed_topic?: string;
          p_enabled?: boolean;
          p_increment_daily_count?: boolean;
          p_user_id: string;
        };
        Returns: Json;
      };
      update_trial_status: { Args: never; Returns: number };
      update_user_folder_heats: {
        Args: { p_user_id: string };
        Returns: number;
      };
      update_user_trust_mode: {
        Args: { p_reason?: string; p_trust_mode: string; p_user_id: string };
        Returns: Json;
      };
      update_folder_profile_incremental: {
        Args: {
          p_folder_id: number;
          p_new_embedding: string;
          p_learning_rate: number;
        };
        Returns: undefined;
      };
      upsert_intent_cache_semantic: {
        Args: {
          p_input_hash: string;
          p_normalized_input: string;
          p_original_message: string | null;
          p_intent_type: string;
          p_intent_subtype: string | null;
          p_confidence: number;
          p_method: string;
          p_slots: Json;
          p_message_embedding: string;
          p_ttl_days?: number;
        };
        Returns: number;
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
      validate_refresh_token: {
        Args: { p_token_hash: string; p_user_id: string };
        Returns: {
          authorization_id: string;
          browser: string;
          expires_at: string;
          valid: boolean;
        }[];
      };
      verify_bookmark_views_consistency: {
        Args: { p_user_id: string };
        Returns: {
          browser_count: number;
          content_count: number;
          is_consistent: boolean;
          total_active: number;
        }[];
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
      job_status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
      job_type:
        | "FETCH_METADATA"
        | "GENERATE_EMBEDDING"
        | "AUTO_CLASSIFY"
        | "DEEP_CRAWL"
        | "CLEANUP_TRASH"
        | "VALIDATE_LINKS"
        | "PROFILE_UPDATE"
        | "BATCH_IMPORT"
        | "SEND_NOTIFICATION";
    };
    CompositeTypes: {
      chunk_input: {
        chunk_index: number | null;
        content: string | null;
        content_hash: string | null;
        chunk_type: string | null;
        token_count: number | null;
        start_offset: number | null;
        end_offset: number | null;
        parent_index: number | null;
        embedding: string | null;
      };
      folder_bookmark_stats: {
        folder_id: number | null;
        bookmark_count: number | null;
        today_count: number | null;
      };
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
  graphql_public: {
    Enums: {},
  },
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
      job_status: ["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"],
      job_type: [
        "FETCH_METADATA",
        "GENERATE_EMBEDDING",
        "AUTO_CLASSIFY",
        "DEEP_CRAWL",
        "CLEANUP_TRASH",
        "VALIDATE_LINKS",
        "PROFILE_UPDATE",
        "BATCH_IMPORT",
        "SEND_NOTIFICATION",
      ],
    },
  },
} as const;

// ============================================================================
// Derived Table Types
// ============================================================================

export type Bookmark = Tables<"bookmarks">;
export type BookmarkInsert = TablesInsert<"bookmarks">;
export type BookmarkUpdate = TablesUpdate<"bookmarks">;

export type Folder = Tables<"folders">;
export type FolderInsert = TablesInsert<"folders">;
export type FolderUpdate = TablesUpdate<"folders">;

export type Profile = Tables<"profiles">;
export type ProfileInsert = TablesInsert<"profiles">;
export type ProfileUpdate = TablesUpdate<"profiles">;

// Note: browser_bookmarks is stored in the bookmarks table with platform = 'BROWSER_*'
// Use v_browser_bookmarks view for filtered access

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

export type SynthesisReport = Tables<"synthesis_reports">;
export type SynthesisReportInsert = TablesInsert<"synthesis_reports">;
export type SynthesisReportUpdate = TablesUpdate<"synthesis_reports">;

// Note: ContentMonitor and MonitorCheckLog tables are planned but not yet created
// Uncomment when tables are added to the database
// export type ContentMonitor = Tables<"content_monitors">;
// export type ContentMonitorInsert = TablesInsert<"content_monitors">;
// export type ContentMonitorUpdate = TablesUpdate<"content_monitors">;
// export type MonitorCheckLog = Tables<"monitor_check_logs">;
// export type MonitorCheckLogInsert = TablesInsert<"monitor_check_logs">;

// Page monitors (actual table names)
export type PageMonitor = Tables<"page_monitors">;
export type PageMonitorInsert = TablesInsert<"page_monitors">;
export type PageMonitorUpdate = TablesUpdate<"page_monitors">;
export type MonitorCheckLog = Tables<"monitor_check_logs">;
export type MonitorCheckLogInsert = TablesInsert<"monitor_check_logs">;

// Knowledge Studio types
export type KsReportChangeSet = Tables<"ks_report_change_sets">;
export type KsIncrementalUpdateTask = Tables<"ks_incremental_update_tasks">;
export type KsUpdateResult = Tables<"ks_update_results">;
export type KsReportVersion = Tables<"ks_report_versions">;
export type KsIncrementalUpdateConfig = Tables<"ks_incremental_update_config">;
export type KsKnowledgePoint = Tables<"ks_knowledge_points">;
export type KsKnowledgePointMastery = Tables<"ks_knowledge_point_mastery">;
export type KsLearningSession = Tables<"ks_learning_sessions">;
export type KsReviewRecord = Tables<"ks_review_records">;
export type KsCustomTemplate = Tables<"ks_custom_templates">;
export type KsCustomTemplateInsert = TablesInsert<"ks_custom_templates">;
export type KsCustomTemplateUpdate = TablesUpdate<"ks_custom_templates">;
export type KsTemplateVersion = Tables<"ks_template_versions">;
export type KsTemplateUsage = Tables<"ks_template_usages">;
export type KsTemplateShare = Tables<"ks_template_shares">;
export type KsUsageRecord = Tables<"ks_usage_records">;
export type KsConsumptionRecord = Tables<"ks_consumption_records">;
export type KsBill = Tables<"ks_bills">;
export type KsBillLineItem = Tables<"ks_bill_line_items">;

// ============================================================================
// Additional Enum Types
// ============================================================================

/** 分类状态 */
export type ClassificationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "classified"
  | "suggested"
  | "inbox";

/** 聚类处理状态接口 */
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
// Custom Tag Types & Constants
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

// ============================================================================
// Business Interface Types
// ============================================================================

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
  operation_type?: string;
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
  parentId: number | null;
  children: FolderTreeNode[];
  bookmarkCount?: number;
  isSystem?: boolean;
  systemType?: string;
}

/** 带快照的书签类型 */
export type BookmarkWithSnapshot = Bookmark & {
  latest_snapshot?: {
    id: string;
    html_content: string | null;
    created_at: string;
  } | null;
};

/** 导入选项 */
export interface ImportOptions {
  preserveFolders?: boolean;
  skipDuplicates?: boolean;
  validateUrls?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// AI 分类相关业务类型
// ============================================================================

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

/** 分类候选项 */
export interface ClassificationCandidate {
  folderId: number;
  folderName: string;
  score: number;
  matchType: "profile" | "name" | "ai_select" | "ai_create";
  topTags?: string[];
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

/** 报告建议 */
export interface ReportSuggestion {
  id: string;
  type: "split" | "merge" | "rename" | "archive" | "create" | "cleanup";
  description?: string;
  folderId?: number;
  folderName?: string;
  targetFolderId?: number;
  newName?: string;
  reason: string;
  confidence: number;
  affectedBookmarks?: number;
  status: "pending" | "accepted" | "rejected";
}
