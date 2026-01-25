export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
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
          operationName?: string;
          query?: string;
          variables?: Json;
          extensions?: Json;
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
      ai_chat_contexts: {
        Row: {
          context_metadata: Json;
          created_at: string | null;
          embedding: string | null;
          id: string;
          importance_score: number | null;
          last_accessed_at: string | null;
          memory_type: string;
          message_count: number | null;
          summary: string;
          ttl: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          context_metadata?: Json;
          created_at?: string | null;
          embedding?: string | null;
          id?: string;
          importance_score?: number | null;
          last_accessed_at?: string | null;
          memory_type?: string;
          message_count?: number | null;
          summary: string;
          ttl?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          context_metadata?: Json;
          created_at?: string | null;
          embedding?: string | null;
          id?: string;
          importance_score?: number | null;
          last_accessed_at?: string | null;
          memory_type?: string;
          message_count?: number | null;
          summary?: string;
          ttl?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_chat_sessions: {
        Row: {
          created_at: string | null;
          id: string;
          last_message_at: string | null;
          metadata: Json;
          status: string;
          title: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          last_message_at?: string | null;
          metadata?: Json;
          status?: string;
          title: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          last_message_at?: string | null;
          metadata?: Json;
          status?: string;
          title?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_feedback: {
        Row: {
          category: string | null;
          comment: string | null;
          created_at: string | null;
          id: string;
          rating: number;
          tags: string[] | null;
          target_id: string;
          target_type: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          comment?: string | null;
          created_at?: string | null;
          id?: string;
          rating: number;
          tags?: string[] | null;
          target_id: string;
          target_type: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          comment?: string | null;
          created_at?: string | null;
          id?: string;
          rating?: number;
          tags?: string[] | null;
          target_id?: string;
          target_type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_knowledge_nodes: {
        Row: {
          confidence_score: number | null;
          content: string | null;
          created_at: string | null;
          embedding: string | null;
          id: string;
          metadata: Json;
          node_type: string;
          source_id: string | null;
          source_type: string | null;
          summary: string | null;
          tags: string[] | null;
          title: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          confidence_score?: number | null;
          content?: string | null;
          created_at?: string | null;
          embedding?: string | null;
          id?: string;
          metadata?: Json;
          node_type?: string;
          source_id?: string | null;
          source_type?: string | null;
          summary?: string | null;
          tags?: string[] | null;
          title: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          confidence_score?: number | null;
          content?: string | null;
          created_at?: string | null;
          embedding?: string | null;
          id?: string;
          metadata?: Json;
          node_type?: string;
          source_id?: string | null;
          source_type?: string | null;
          summary?: string | null;
          tags?: string[] | null;
          title?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_memory_store: {
        Row: {
          access_count: number | null;
          content: string;
          created_at: string | null;
          embedding: string | null;
          expires_at: string | null;
          id: string;
          importance: number | null;
          last_accessed: string | null;
          metadata: Json;
          source: string | null;
          tags: string[] | null;
          type: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          access_count?: number | null;
          content: string;
          created_at?: string | null;
          embedding?: string | null;
          expires_at?: string | null;
          id?: string;
          importance?: number | null;
          last_accessed?: string | null;
          metadata?: Json;
          source?: string | null;
          tags?: string[] | null;
          type?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          access_count?: number | null;
          content?: string;
          created_at?: string | null;
          embedding?: string | null;
          expires_at?: string | null;
          id?: string;
          importance?: number | null;
          last_accessed?: string | null;
          metadata?: Json;
          source?: string | null;
          tags?: string[] | null;
          type?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_message_archives: {
        Row: {
          archived_at: string | null;
          content: string;
          created_at: string | null;
          id: string;
          metadata: Json;
          role: string;
          session_id: string;
          user_id: string;
        };
        Insert: {
          archived_at?: string | null;
          content: string;
          created_at?: string | null;
          id?: string;
          metadata?: Json;
          role: string;
          session_id: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          content?: string;
          created_at?: string | null;
          id?: string;
          metadata?: Json;
          role?: string;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_message_archives_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "ai_chat_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_messages: {
        Row: {
          content: string;
          created_at: string | null;
          embedding: string | null;
          id: string;
          metadata: Json;
          role: string;
          session_id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          embedding?: string | null;
          id?: string;
          metadata?: Json;
          role: string;
          session_id: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          embedding?: string | null;
          id?: string;
          metadata?: Json;
          role?: string;
          session_id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "ai_chat_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_skill_executions: {
        Row: {
          created_at: string | null;
          duration_ms: number | null;
          error: string | null;
          id: string;
          input_params: Json;
          output_result: Json;
          skill_name: string;
          status: string;
          trace_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          duration_ms?: number | null;
          error?: string | null;
          id?: string;
          input_params?: Json;
          output_result?: Json;
          skill_name: string;
          status?: string;
          trace_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          duration_ms?: number | null;
          error?: string | null;
          id?: string;
          input_params?: Json;
          output_result?: Json;
          skill_name?: string;
          status?: string;
          trace_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      bookmarks: {
        Row: {
          author: string | null;
          content: string | null;
          created_at: string;
          description: string | null;
          embedding: string | null;
          folder_id: string | null;
          id: string;
          image_url: string | null;
          is_favorite: boolean | null;
          is_read: boolean | null;
          platform: string | null;
          published_date: string | null;
          tags: string[] | null;
          title: string;
          updated_at: string;
          url: string;
          user_id: string;
        };
        Insert: {
          author?: string | null;
          content?: string | null;
          created_at?: string;
          description?: string | null;
          embedding?: string | null;
          folder_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_favorite?: boolean | null;
          is_read?: boolean | null;
          platform?: string | null;
          published_date?: string | null;
          tags?: string[] | null;
          title: string;
          updated_at?: string;
          url: string;
          user_id?: string;
        };
        Update: {
          author?: string | null;
          content?: string | null;
          created_at?: string;
          description?: string | null;
          embedding?: string | null;
          folder_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_favorite?: boolean | null;
          is_read?: boolean | null;
          platform?: string | null;
          published_date?: string | null;
          tags?: string[] | null;
          title?: string;
          updated_at?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookmarks_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "folders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      browser_bookmark_folders: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          parent_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          parent_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          parent_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "browser_bookmark_folders_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "browser_bookmark_folders";
            referencedColumns: ["id"];
          },
        ];
      };
      browser_bookmarks: {
        Row: {
          created_at: string;
          folder_id: string | null;
          icon: string | null;
          id: string;
          title: string;
          updated_at: string;
          url: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          folder_id?: string | null;
          icon?: string | null;
          id?: string;
          title: string;
          updated_at?: string;
          url: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          folder_id?: string | null;
          icon?: string | null;
          id?: string;
          title?: string;
          updated_at?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "browser_bookmarks_folder_id_fkey";
            columns: ["folder_id"];
            isOneToOne: false;
            referencedRelation: "browser_bookmark_folders";
            referencedColumns: ["id"];
          },
        ];
      };
      folders: {
        Row: {
          color: string | null;
          created_at: string;
          icon: string | null;
          id: string;
          is_public: boolean | null;
          name: string;
          parent_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_public?: boolean | null;
          name: string;
          parent_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_public?: boolean | null;
          name?: string;
          parent_id?: string | null;
          updated_at?: string;
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
          {
            foreignKeyName: "folders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      import_history: {
        Row: {
          created_at: string;
          error_count: number | null;
          file_name: string | null;
          file_size: number | null;
          id: string;
          import_source: string;
          status: string;
          success_count: number | null;
          total_count: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          error_count?: number | null;
          file_name?: string | null;
          file_size?: number | null;
          id?: string;
          import_source: string;
          status?: string;
          success_count?: number | null;
          total_count: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          error_count?: number | null;
          file_name?: string | null;
          file_size?: number | null;
          id?: string;
          import_source?: string;
          status?: string;
          success_count?: number | null;
          total_count?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          id: string;
          membership_type: string | null;
          nickname: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          id: string;
          membership_type?: string | null;
          nickname?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          id?: string;
          membership_type?: string | null;
          nickname?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          created_at: string;
          id: string;
          setting_key: string;
          setting_value: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          setting_key: string;
          setting_value: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          setting_key?: string;
          setting_value?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      binary_quantize:
        | {
            Args: {
              "": string;
            };
            Returns: unknown;
          }
        | {
            Args: {
              "": unknown;
            };
            Returns: unknown;
          };
      halfvec_avg: {
        Args: {
          "": number[];
        };
        Returns: unknown;
      };
      halfvec_out: {
        Args: {
          "": unknown;
        };
        Returns: unknown;
      };
      halfvec_send: {
        Args: {
          "": unknown;
        };
        Returns: string;
      };
      halfvec_typmod_in: {
        Args: {
          "": unknown[];
        };
        Returns: number;
      };
      hnsw_bit_support: {
        Args: {
          "": unknown;
        };
        Returns: unknown;
      };
      hnsw_halfvec_support: {
        Args: {
          "": unknown;
        };
        Returns: unknown;
      };
      hnsw_sparsevec_support: {
        Args: {
          "": unknown;
        };
        Returns: unknown;
      };
      hnswhandler: {
        Args: {
          "": unknown;
        };
        Returns: unknown;
      };
      ivfflat_bit_support: {
        Args: {
          "": unknown;
        };
        Returns: unknown;
      };
      ivfflat_halfvec_support: {
        Args: {
          "": unknown;
        };
        Returns: unknown;
      };
      ivfflathandler: {
        Args: {
          "": unknown;
        };
        Returns: unknown;
      };
      l2_norm:
        | {
            Args: {
              "": unknown;
            };
            Returns: number;
          }
        | {
            Args: {
              "": unknown;
            };
            Returns: number;
          };
      l2_normalize:
        | {
            Args: {
              "": string;
            };
            Returns: string;
          }
        | {
            Args: {
              "": unknown;
            };
            Returns: unknown;
          }
        | {
            Args: {
              "": unknown;
            };
            Returns: unknown;
          };
      match_bookmarks: {
        Args: {
          query_embedding: string;
          match_threshold: number;
          match_count: number;
        };
        Returns: {
          id: string;
          title: string;
          url: string;
          content: string;
          similarity: number;
        }[];
      };
      sparsevec_out: {
        Args: {
          "": unknown;
        };
        Returns: unknown;
      };
      sparsevec_send: {
        Args: {
          "": unknown;
        };
        Returns: string;
      };
      sparsevec_typmod_in: {
        Args: {
          "": unknown[];
        };
        Returns: number;
      };
      vector_avg: {
        Args: {
          "": number[];
        };
        Returns: string;
      };
      vector_dims:
        | {
            Args: {
              "": string;
            };
            Returns: number;
          }
        | {
            Args: {
              "": unknown;
            };
            Returns: number;
          };
      vector_norm: {
        Args: {
          "": string;
        };
        Returns: number;
      };
      vector_out: {
        Args: {
          "": string;
        };
        Returns: unknown;
      };
      vector_send: {
        Args: {
          "": string;
        };
        Returns: string;
      };
      vector_typmod_in: {
        Args: {
          "": unknown[];
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

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;
