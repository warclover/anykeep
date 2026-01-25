/* eslint-disable @typescript-eslint/no-explicit-any */
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
      bookmarks: {
        Row: {
          id: number;
          created_at: string;
          user_id: string;
          title: string;
          url: string;
          description: string | null;
          content: string | null;
          platform: string;
          author: string | null;
          published_at: string | null;
          folder_id: number | null;
          tags: string[] | null;
          embedding: string | null;
          is_archived: boolean;
          [key: string]: any;
        };
        Insert: {
          id?: number;
          created_at?: string;
          user_id: string;
          title: string;
          url: string;
          platform?: string;
          [key: string]: any;
        };
        Update: {
          id?: number;
          [key: string]: any;
        };
        Relationships: [];
      };
      folders: {
        Row: {
          id: number;
          created_at: string;
          user_id: string;
          name: string;
          parent_id: number | null;
          is_system: boolean;
          is_archived: boolean;
          icon: string | null;
          color: string | null;
          [key: string]: any;
        };
        Insert: {
          id?: number;
          created_at?: string;
          user_id: string;
          name: string;
          [key: string]: any;
        };
        Update: {
          id?: number;
          [key: string]: any;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          updated_at: string | null;
          nickname: string | null;
          avatar_url: string | null;
          website: string | null;
          membership_type: string;
          settings: Json | null;
          ai_preferences: Json | null;
          [key: string]: any;
        };
        Insert: {
          id: string;
          [key: string]: any;
        };
        Update: {
          id?: string;
          [key: string]: any;
        };
        Relationships: [];
      };
      folder_profiles: {
        Row: {
          id: number;
          folder_id: number;
          profile_data: Json | null;
          created_at: string;
          updated_at: string;
          [key: string]: any;
        };
        Insert: {
          id?: number;
          folder_id: number;
          [key: string]: any;
        };
        Update: {
          id?: number;
          [key: string]: any;
        };
        Relationships: [];
      };
      import_history: {
        Row: {
          id: string;
          user_id: string;
          import_source: string;
          status: string;
          total_count: number;
          success_count: number;
          fail_count: number;
          created_at: string;
          error_log: Json | null;
          [key: string]: any;
        };
        Insert: {
          id?: string;
          user_id: string;
          import_source: string;
          [key: string]: any;
        };
        Update: {
          id?: string;
          [key: string]: any;
        };
        Relationships: [];
      };
      classification_suggestions: {
        Row: {
          id: number;
          bookmark_id: number;
          suggested_folder_id: number | null;
          confidence: number;
          reason: string | null;
          status: string;
          created_at: string;
          [key: string]: any;
        };
        Insert: {
          id?: number;
          bookmark_id: number;
          [key: string]: any;
        };
        Update: {
          id?: number;
          [key: string]: any;
        };
        Relationships: [];
      };
      browser_bookmarks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          url: string;
          folder_id: string | null;
          created_at: string;
          source: string;
          favicon_url: string | null;
          [key: string]: any;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          url: string;
          [key: string]: any;
        };
        Update: {
          id?: string;
          [key: string]: any;
        };
        Relationships: [];
      };
      browser_bookmark_folders: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          parent_id: string | null;
          source: string;
          created_at: string;
          [key: string]: any;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          [key: string]: any;
        };
        Update: {
          id?: string;
          [key: string]: any;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: number;
          name: string;
          [key: string]: any;
        };
        Insert: {
          id?: number;
          name: string;
          [key: string]: any;
        };
        Update: {
          id?: number;
          [key: string]: any;
        };
        Relationships: [];
      };
      bookmark_tags: {
        Row: {
          id: number;
          bookmark_id: number;
          tag_id: number;
          [key: string]: any;
        };
        Insert: {
          bookmark_id: number;
          tag_id: number;
          [key: string]: any;
        };
        Update: {
          id?: number;
          [key: string]: any;
        };
        Relationships: [];
      };
      source_profiles: {
        Row: {
          id: number;
          [key: string]: any;
        };
        Insert: {
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
      job_queue: {
        Row: {
          id: number;
          [key: string]: any;
        };
        Insert: {
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
      scheduled_workflow_executions: {
        Row: {
          id: string;
          [key: string]: any;
        };
        Insert: {
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
      operation_snapshots: {
        Row: {
          id: number;
          [key: string]: any;
        };
        Insert: {
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
      pending_confirmations: {
        Row: {
          id: string;
          [key: string]: any;
        };
        Insert: {
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
      page_monitors: {
        Row: {
          id: number;
          [key: string]: any;
        };
        Insert: {
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
      monitor_check_logs: {
        Row: {
          id: number;
          [key: string]: any;
        };
        Insert: {
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
      distribution_targets: {
        Row: {
          id: string;
          [key: string]: any;
        };
        Insert: {
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
      distribution_records: {
        Row: {
          id: string;
          [key: string]: any;
        };
        Insert: {
          [key: string]: any;
        };
        Update: {
          [key: string]: any;
        };
        Relationships: [];
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, any>;
      };
    };
    Functions: {
      batch_add_tags: {
        Args: {
          p_bookmark_ids: number[];
          p_tags: string[];
          p_user_id?: string;
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
      toggle_bookmark_starred: {
        Args: {
          p_bookmark_id: number;
          p_user_id: string;
        };
        Returns: Database["public"]["Tables"]["bookmarks"]["Row"][];
      };
      get_or_create_inbox_folder: {
        Args: {
          p_user_id: string;
        };
        Returns: number;
      };
      increment_storage_used: {
        Args: {
          target_user_id: string;
        };
        Returns: void;
      };
      [key: string]: {
        Args: Record<string, any>;
        Returns: any;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
