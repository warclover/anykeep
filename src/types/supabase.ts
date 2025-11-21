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
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          phone: string | null
          nickname: string | null
          avatar_url: string | null
          membership_type: 'FREE' | 'PRO'
          storage_quota: number
          storage_used: number
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          phone?: string | null
          nickname?: string | null
          avatar_url?: string | null
          membership_type?: 'FREE' | 'PRO'
          storage_quota?: number
          storage_used?: number
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone?: string | null
          nickname?: string | null
          avatar_url?: string | null
          membership_type?: 'FREE' | 'PRO'
          storage_quota?: number
          storage_used?: number
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      folders: {
        Row: {
          id: number
          user_id: string
          name: string
          parent_id: number | null
          sort_order: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: number
          user_id: string
          name: string
          parent_id?: number | null
          sort_order?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          name?: string
          parent_id?: number | null
          sort_order?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'folders_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'folders_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'folders'
            referencedColumns: ['id']
          }
        ]
      }
      bookmarks: {
        Row: {
          id: number
          user_id: string
          title: string
          url: string
          description: string | null
          cover_url: string | null
          platform: 'WECHAT_OFFICIAL_ACCOUNT' | 'BILIBILI' | 'XIAOHONGSHU' | 'UNKNOWN'
          platform_content_id: string | null
          ai_summary: string | null
          ai_tags: string[] | null
          folder_id: number | null
          user_tags: string[] | null
          notes: string | null
          author: string | null
          publish_time: string | null
          content_type: 'ARTICLE' | 'VIDEO' | 'IMAGE' | 'UNKNOWN' | null
          embedding: number[] | null
          status: 'PROCESSING' | 'COMPLETED' | 'FAILED'
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: number
          user_id: string
          title: string
          url: string
          description?: string | null
          cover_url?: string | null
          platform: 'WECHAT_OFFICIAL_ACCOUNT' | 'BILIBILI' | 'XIAOHONGSHU' | 'UNKNOWN'
          platform_content_id?: string | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          folder_id?: number | null
          user_tags?: string[] | null
          notes?: string | null
          author?: string | null
          publish_time?: string | null
          content_type?: 'ARTICLE' | 'VIDEO' | 'IMAGE' | 'UNKNOWN' | null
          embedding?: number[] | null
          status?: 'PROCESSING' | 'COMPLETED' | 'FAILED'
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: number
          user_id?: string
          title?: string
          url?: string
          description?: string | null
          cover_url?: string | null
          platform?: 'WECHAT_OFFICIAL_ACCOUNT' | 'BILIBILI' | 'XIAOHONGSHU' | 'UNKNOWN'
          platform_content_id?: string | null
          ai_summary?: string | null
          ai_tags?: string[] | null
          folder_id?: number | null
          user_tags?: string[] | null
          notes?: string | null
          author?: string | null
          publish_time?: string | null
          content_type?: 'ARTICLE' | 'VIDEO' | 'IMAGE' | 'UNKNOWN' | null
          embedding?: number[] | null
          status?: 'PROCESSING' | 'COMPLETED' | 'FAILED'
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'bookmarks_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bookmarks_folder_id_fkey'
            columns: ['folder_id']
            isOneToOne: false
            referencedRelation: 'folders'
            referencedColumns: ['id']
          }
        ]
      }
      platform_authorizations: {
        Row: {
          id: number
          user_id: string
          platform: 'WECHAT' | 'BILIBILI' | 'XIAOHONGSHU'
          access_token: string | null
          refresh_token: string | null
          expires_at: string | null
          status: 'ACTIVE' | 'EXPIRED' | 'REVOKED'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          platform: 'WECHAT' | 'BILIBILI' | 'XIAOHONGSHU'
          access_token?: string | null
          refresh_token?: string | null
          expires_at?: string | null
          status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          platform?: 'WECHAT' | 'BILIBILI' | 'XIAOHONGSHU'
          access_token?: string | null
          refresh_token?: string | null
          expires_at?: string | null
          status?: 'ACTIVE' | 'EXPIRED' | 'REVOKED'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'platform_authorizations_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_bookmarks_semantic: {
        Args: {
          query_embedding: number[]
          search_user_id: string
          match_threshold?: number
          match_count?: number
        }
        Returns: {
          id: number
          title: string
          url: string
          description: string | null
          cover_url: string | null
          platform: string
          ai_summary: string | null
          ai_tags: string[] | null
          created_at: string
          similarity: number
        }[]
      }
      increment_storage_used: {
        Args: {
          target_user_id: string
        }
        Returns: void
      }
      decrement_storage_used: {
        Args: {
          target_user_id: string
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// 便捷类型别名
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Folder = Database['public']['Tables']['folders']['Row']
export type FolderInsert = Database['public']['Tables']['folders']['Insert']
export type FolderUpdate = Database['public']['Tables']['folders']['Update']

export type Bookmark = Database['public']['Tables']['bookmarks']['Row']
export type BookmarkInsert = Database['public']['Tables']['bookmarks']['Insert']
export type BookmarkUpdate = Database['public']['Tables']['bookmarks']['Update']

export type PlatformAuthorization = Database['public']['Tables']['platform_authorizations']['Row']
export type PlatformAuthorizationInsert = Database['public']['Tables']['platform_authorizations']['Insert']
export type PlatformAuthorizationUpdate = Database['public']['Tables']['platform_authorizations']['Update']

// 平台类型
export type Platform = 'WECHAT_OFFICIAL_ACCOUNT' | 'BILIBILI' | 'XIAOHONGSHU' | 'UNKNOWN'
export type AuthPlatform = 'WECHAT' | 'BILIBILI' | 'XIAOHONGSHU'
export type ContentType = 'ARTICLE' | 'VIDEO' | 'IMAGE' | 'UNKNOWN'
export type BookmarkStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED'
export type MembershipType = 'FREE' | 'PRO'
export type AuthorizationStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED'
