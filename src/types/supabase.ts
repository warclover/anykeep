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
          content_type: string | null;
          cover_url: string | null;
          created_at: string | null;
          deleted_at: string | null;
          description: string | null;
          embedding: string | null;
          folder_id: number | null;
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
          last_validation_at: string | null;
          notes: string | null;
          platform: string;
          platform_content_id: string | null;
          publish_time: string | null;
          rating: number | null;
          read_at: string | null;
          source_name: string | null;
          starred_at: string | null;
          status: string | null;
          title: string;
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
          content_type?: string | null;
          cover_url?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          embedding?: string | null;
          folder_id?: number | null;
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
          last_validation_at?: string | null;
          notes?: string | null;
          platform: string;
          platform_content_id?: string | null;
          publish_time?: string | null;
          rating?: number | null;
          read_at?: string | null;
          source_name?: string | null;
          starred_at?: string | null;
          status?: string | null;
          title: string;
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
          content_type?: string | null;
          cover_url?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          embedding?: string | null;
          folder_id?: number | null;
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
          last_validation_at?: string | null;
          notes?: string | null;
          platform?: string;
          platform_content_id?: string | null;
          publish_time?: string | null;
          rating?: number | null;
          read_at?: string | null;
          source_name?: string | null;
          starred_at?: string | null;
          status?: string | null;
          title?: string;
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
            referencedRelation: "folders";
            referencedColumns: ["id"];
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
            referencedRelation: "folders";
            referencedColumns: ["id"];
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
      classification_suggestions: {
        Row: {
          batch_id: string;
          bookmark_id: number;
          confidence: number;
          created_at: string | null;
          id: number;
          processed_at: string | null;
          reason: string | null;
          status: string | null;
          suggest_new_folder: boolean | null;
          suggested_folder_id: number | null;
          suggested_folder_name: string;
          user_id: string;
        };
        Insert: {
          batch_id: string;
          bookmark_id: number;
          confidence: number;
          created_at?: string | null;
          id?: number;
          processed_at?: string | null;
          reason?: string | null;
          status?: string | null;
          suggest_new_folder?: boolean | null;
          suggested_folder_id?: number | null;
          suggested_folder_name: string;
          user_id: string;
        };
        Update: {
          batch_id?: string;
          bookmark_id?: number;
          confidence?: number;
          created_at?: string | null;
          id?: number;
          processed_at?: string | null;
          reason?: string | null;
          status?: string | null;
          suggest_new_folder?: boolean | null;
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
          computed_at: string | null;
          folder_id: number;
          id: number;
          internal_similarity: number | null;
          last_bookmark_at: string | null;
          name_embedding: string | null;
          profile_embedding: string | null;
          sample_titles: string[] | null;
          source: string | null;
          top_tags: string[] | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          bookmark_count?: number | null;
          computed_at?: string | null;
          folder_id: number;
          id?: number;
          internal_similarity?: number | null;
          last_bookmark_at?: string | null;
          name_embedding?: string | null;
          profile_embedding?: string | null;
          sample_titles?: string[] | null;
          source?: string | null;
          top_tags?: string[] | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          bookmark_count?: number | null;
          computed_at?: string | null;
          folder_id?: number;
          id?: number;
          internal_similarity?: number | null;
          last_bookmark_at?: string | null;
          name_embedding?: string | null;
          profile_embedding?: string | null;
          sample_titles?: string[] | null;
          source?: string | null;
          top_tags?: string[] | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
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
      embedding_stats: {
        Row: {
          bookmarks_with_embedding: number | null;
          bookmarks_without_embedding: number | null;
          embedding_coverage_percent: number | null;
          total_bookmarks: number | null;
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
      calculate_matcher_weight_adjustments: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      cleanup_expired_messages: { Args: never; Returns: number };
      cleanup_old_chat_cache: { Args: { p_days?: number }; Returns: number };
      cleanup_old_patrol_reports: { Args: never; Returns: undefined };
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
      expire_old_suggestions: { Args: never; Returns: number };
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
      get_ai_folder_settings: { Args: { p_user_id: string }; Returns: Json };
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
      get_or_create_inbox_folder: {
        Args: { p_user_id?: string };
        Returns: number;
      };
      get_pending_suggestions_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
      get_system_folder_name: {
        Args: { p_locale?: string; p_system_type: string };
        Returns: string;
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
      get_vision_tags: { Args: { vision_data: Json }; Returns: string[] };
      has_vision_analysis: { Args: { vision_data: Json }; Returns: boolean };
      increment_chat_usage: {
        Args: { p_date: string; p_tokens?: number; p_user_id: string };
        Returns: undefined;
      };
      increment_storage_used: {
        Args: { target_user_id: string };
        Returns: undefined;
      };
      mark_messages_read: {
        Args: { p_message_ids?: number[]; p_user_id: string };
        Returns: number;
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
      update_folder_name_embedding: {
        Args: { p_folder_id: number; p_name_embedding: string };
        Returns: undefined;
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
    Enums: {},
  },
} as const;
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
  | "confirm" // V4.2: 用户确认分类正确
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
  | "folder_auto_created" // V4.2: AI 自动创建文件夹
  | "folder_auto_split" // V4.2: AI 自动分拆文件夹
  | "folder_auto_merged" // V4.2: AI 自动合并文件夹
  | "folder_auto_renamed" // V4.2: AI 自动重命名文件夹
  | "folder_operation_undone" // V4.2: 操作已撤销
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
  | "ai_processing_failed"
  | "ai_evolution_report" // V4.2: 月度进化报告
  // V4.2: 成本监控
  | "cost_warning" // 成本预警
  | "cost_critical" // 成本超限
  | "cost_daily_exceeded"; // 日成本超限

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

// ============================================
// V4.2 新增：AI 文件夹进化系统类型定义
// 注意：这些类型用于 V4.2 新功能，独立于 Database 类型
// ============================================

/**
 * AI 进化等级
 */
export type AIEvolutionLevel = "manual" | "semi" | "auto";

/**
 * 建议操作类型
 */
export type SuggestedAction =
  | "classify"
  | "create_folder"
  | "merge_cluster"
  | "split_folder";

/**
 * 操作快照动作类型
 */
export type OperationSnapshotAction =
  | "create"
  | "split"
  | "merge"
  | "rename"
  | "move"
  | "delete";

/**
 * 任务队列类型
 */
export type JobQueueType =
  | "compute_folder_profile"
  | "cluster_bookmarks"
  | "generate_suggestions"
  | "update_folder_heat"
  | "ai_rename_folder"
  | "batch_classify";

/**
 * 任务状态
 */
export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * 聚类处理状态 (V4.2)
 */
export interface ClusterProcessingStatus {
  pendingClusterCount: number;
  clusterCount: number;
  lastProcessedAt: Date | null;
  nextScheduledAt: Date;
  hasPendingSuggestions: boolean;
}

/**
 * AI 文件夹设置
 */
export interface AIFolderSettings {
  // 基本设置
  autoClassify?: boolean;
  autoRename?: boolean;
  suggestSplitMerge?: boolean;
  confidenceThreshold?: number;
  // V4.2 智能分拣设置
  autonomy_level?: number; // 1=全自动, 2=建议确认, 3=仅建议
  enable_auto_create?: boolean;
  enable_auto_split?: boolean;
  enable_auto_merge?: boolean;
  enable_auto_rename?: boolean;
  create_notification?: boolean;
  report_interval?: "weekly" | "monthly" | "never";
  daily_create_limit?: number;
  [key: string]: unknown;
}

/**
 * 操作详情（用于历史记录展示）
 */
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
  undone_at: string | null;
  created_at: string;
  expires_at: string;
  can_undo: boolean;
  folder_name?: string;
  folder_names?: string[];
  bookmark_count?: number;
}

/**
 * V4.2 任务队列项（手动定义，数据库表未纳入 Database 类型）
 */
export interface JobQueueItem {
  id: string;
  user_id: string;
  type: JobQueueType;
  payload: Json;
  status: JobStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  worker_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobQueueInsert {
  id?: string;
  user_id: string;
  type: JobQueueType;
  payload?: Json;
  status?: JobStatus;
  priority?: number;
  attempts?: number;
  max_attempts?: number;
  scheduled_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  worker_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * V4.2 文件夹配置（手动定义）
 */
export interface FolderProfile {
  id: number;
  folder_id: number;
  user_id: string;
  description: string | null;
  sample_titles: string[] | null;
  embedding: number[] | null;
  confidence_threshold: number;
  is_ai_renamable: boolean;
  is_system_locked: boolean;
  recent_additions: number;
  heat_score: number;
  heat_computed_at: string | null;
  suggested_name: string | null;
  suggested_name_reason: string | null;
  is_split_candidate: boolean;
  is_merge_candidate: boolean;
  similar_folder_ids: number[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * V4.2 操作快照（手动定义）
 */
export interface OperationSnapshot {
  id: string;
  user_id: string;
  action: OperationSnapshotAction;
  folder_id: number | null;
  folder_ids: number[] | null;
  bookmark_ids: number[] | null;
  before_state: Json;
  after_state: Json;
  reason: string | null;
  is_undone: boolean;
  undone_at: string | null;
  created_at: string;
  expires_at: string;
}
