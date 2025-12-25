/**
 * BatchOrganizeSkill 步骤内部类型
 *
 * @module ai-skills/skills/batch-organize/steps/types
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// ============================================
// Supabase 客户端类型
// ============================================

export type SupabaseClientType = SupabaseClient<Database>;

// ============================================
// 书签行数据类型
// ============================================

export interface BookmarkRow {
  id: number;
  title: string;
  url: string;
  platform: string;
  ai_tags: string[] | null;
  user_tags: string[] | null;
  ai_summary: string | null;
  folder_id: number | null;
  created_at: string;
  folders?: Array<{ name: string }> | { name: string } | null;
}

// ============================================
// 文件夹类型
// ============================================

export interface FolderRow {
  id: number;
  name: string;
}

// ============================================
// 执行结果类型
// ============================================

export interface ExecutionResult {
  success: number;
  failed: number;
}

// ============================================
// 文件夹建议结果
// ============================================

export interface FolderSuggestionResult {
  suggestedFolder: string;
  suggestedFolderId?: number;
  confidence: number;
  reason: string;
}
