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
          pending_cluster: boolean | null;
          pending_since: string | null;
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
          source_id: string | null;
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
          pending_cluster?: boolean | null;
          pending_since?: string | null;
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
          source_id?: string | null;
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
          pending_cluster?: boolean | null;
          pending_since?: string | null;
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
          source_id?: string | null;
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
            referencedRelation: "folders";
            referencedColumns: ["id"];
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
          computed_at: string | null;
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
        };
        Insert: {
          bookmark_count?: number | null;
          computed_at?: string | null;
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
        };
        Update: {
          bookmark_count?: number | null;
          computed_at?: string | null;
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
      smart_lists: {
        Row: {
          id: number;
          user_id: string;
          name: string;
          description: string | null;
          icon: string;
          color: string;
          filters: Json;
          sort_by: string;
          view_mode: string;
          sort_order: number;
          is_pinned: boolean;
          is_preset: boolean;
          bookmark_count: number;
          last_accessed_at: string | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          name: string;
          description?: string | null;
          icon?: string;
          color?: string;
          filters?: Json;
          sort_by?: string;
          view_mode?: string;
          sort_order?: number;
          is_pinned?: boolean;
          is_preset?: boolean;
          bookmark_count?: number;
          last_accessed_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          name?: string;
          description?: string | null;
          icon?: string;
          color?: string;
          filters?: Json;
          sort_by?: string;
          view_mode?: string;
          sort_order?: number;
          is_pinned?: boolean;
          is_preset?: boolean;
          bookmark_count?: number;
          last_accessed_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
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
      assign_cluster_id: {
        Args: {
          p_bookmark_ids: number[];
          p_cluster_id: string;
          p_confidence: number;
        };
        Returns: number;
      };
      calculate_matcher_weight_adjustments: {
        Args: { p_user_id: string };
        Returns: Json;
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
      fail_job: {
        Args: { p_error: string; p_job_id: string; p_retry?: boolean };
        Returns: boolean;
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
      get_vision_tags: { Args: { vision_data: Json }; Returns: string[] };
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
      update_folder_heat: { Args: { p_folder_id: number }; Returns: undefined };
      update_folder_name_embedding: {
        Args: { p_folder_id: number; p_name_embedding: string };
        Returns: undefined;
      };
      update_user_folder_heats: {
        Args: { p_user_id: string };
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
    Enums: {},
  },
} as const;

// ============================================================================
// 便捷类型别名
// ============================================================================

// �?Row 类型
export type Bookmark = Database["public"]["Tables"]["bookmarks"]["Row"];
export type BookmarkInsert =
  Database["public"]["Tables"]["bookmarks"]["Insert"];
export type BookmarkUpdate =
  Database["public"]["Tables"]["bookmarks"]["Update"];

// ============================================================================
// V4.2.1 快照扩展字段 (数据库已添加，类型需要手动扩展)
// ============================================================================

/** 快照状态类型 */
export type SnapshotStatusType =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/** 带快照字段的书签类型 (V4.2.1) */
export type BookmarkWithSnapshot = Bookmark & {
  /** 是否有快照 */
  has_snapshot?: boolean | null;
  /** 快照状态 */
  snapshot_status?: SnapshotStatusType | null;
  /** 最后快照时间 */
  last_snapshot_at?: string | null;
};

export type Folder = Database["public"]["Tables"]["folders"]["Row"];
export type FolderInsert = Database["public"]["Tables"]["folders"]["Insert"];
export type FolderUpdate = Database["public"]["Tables"]["folders"]["Update"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type ImportHistory =
  Database["public"]["Tables"]["import_history"]["Row"];
export type ImportHistoryInsert =
  Database["public"]["Tables"]["import_history"]["Insert"];

export type ClassificationSuggestion =
  Database["public"]["Tables"]["classification_suggestions"]["Row"];
export type ClassificationSuggestionInsert =
  Database["public"]["Tables"]["classification_suggestions"]["Insert"];

export type ClassificationFeedback =
  Database["public"]["Tables"]["classification_feedback"]["Row"];
export type ClassificationFeedbackInsert =
  Database["public"]["Tables"]["classification_feedback"]["Insert"];

export type ClassificationDecision =
  Database["public"]["Tables"]["classification_decisions"]["Row"];
export type OperationSnapshot =
  Database["public"]["Tables"]["operation_snapshots"]["Row"];
export type FolderProfile =
  Database["public"]["Tables"]["folder_profiles"]["Row"];

// ============================================================================
// 枚举类型（字符串联合类型�?// ============================================================================

/** 平台类型 */
export type Platform =
  | "wechat"
  | "bilibili"
  | "xiaohongshu"
  | "zhihu"
  | "weibo"
  | "douyin"
  | "twitter"
  | "youtube"
  | "github"
  | "juejin"
  | "csdn"
  | "jianshu"
  | "toutiao"
  | "chrome"
  | "edge"
  | "firefox"
  | "safari"
  | "other"
  | "WECHAT_OFFICIAL_ACCOUNT"
  | "BROWSER_CHROME"
  | "BROWSER_EDGE"
  | "BROWSER_FIREFOX"
  | "BROWSER_SAFARI"
  | "UNKNOWN"
  | "BILIBILI"
  | "XIAOHONGSHU"
  | "ZHIHU"
  | "WEIBO"
  | "DOUYIN"
  | "TWITTER"
  | "YOUTUBE"
  | "GITHUB"
  | "JUEJIN"
  | "CSDN"
  | "JIANSHU"
  | "TOUTIAO";

/** 浏览器平台列�?*/
export const BROWSER_PLATFORMS: Platform[] = [
  "chrome",
  "edge",
  "firefox",
  "safari",
];

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

/** 文件夹分�?*/
export type FolderGroup =
  | "default"
  | "pinned"
  | "archived"
  | "work"
  | "study"
  | "life"
  | "entertainment"
  | "other";

/** 建议状�?*/
export type SuggestionStatus = "pending" | "accepted" | "rejected" | "expired";

/** 分类状�?*/
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
// 业务接口类型
// ============================================================================

/** 自定义标签颜�?*/
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

/** 自定义用途标�?*/
export interface CustomUsageTag {
  id: string;
  name?: string;
  label?: string;
  value: string;
  color: CustomTagColor;
  createdAt: string;
  lastUsedAt?: string;
}

/** 自定义标签颜色配�?*/
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

/** 自定义标签数量限�?*/
export const CUSTOM_USAGE_TAG_LIMIT = 10;

/** 用户配置设置 */
export interface ProfileSettings {
  customUsageTags?: CustomUsageTag[];
  theme?: "light" | "dark" | "system";
  language?: string;
  aiEvolutionLevel?: "manual" | "semi" | "auto";
  [key: string]: unknown;
}

/** 重分类设�?*/
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

/** 操作历史详情（用�?UI 展示�?*/
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

/** AI 文件夹设�?*/
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
