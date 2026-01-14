/**
 * BatchOrganizeSkill 步骤内部类型
 *
 * @module ai-skills/skills/batch-organize/steps/types
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { BookmarkRow, FolderRow } from "@/types/domain";

// ============================================
// Supabase 客户端类型
// ============================================

export type SupabaseClientType = SupabaseClient<Database>;

// ============================================
// 导出统一类型
// ============================================

export type { BookmarkRow, FolderRow };

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
