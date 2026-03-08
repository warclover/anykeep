/**
 * 默认栏目初始化服务
 *
 * 当用户没有任何栏目时，自动创建 5 个默认栏目。
 * 仅在 Server Component / API Route 中使用。
 *
 * @module folder/category-defaults
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import type { FolderCategory } from "@/types/domain";

interface DefaultCategoryDef {
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}

const DEFAULT_CATEGORIES: DefaultCategoryDef[] = [
  { name: "工作相关", icon: "Briefcase", color: "#3B82F6", sort_order: 0 },
  { name: "学习成长", icon: "GraduationCap", color: "#10B981", sort_order: 1 },
  { name: "生活方式", icon: "Heart", color: "#EC4899", sort_order: 2 },
  { name: "休闲娱乐", icon: "Gamepad2", color: "#8B5CF6", sort_order: 3 },
  { name: "其他收藏", icon: "MoreHorizontal", color: "#F87171", sort_order: 4 },
];

/**
 * 确保用户拥有默认栏目。
 * 如果已有栏目则直接返回，否则批量插入默认栏目。
 *
 * @returns 用户的所有栏目列表
 */
export async function ensureDefaultCategories(
  supabase: SupabaseClient,
  userId: string,
): Promise<FolderCategory[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: existing, error: queryError } = await sb
    .from("folder_categories")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (queryError) {
    logger.error({ error: queryError }, "ensureDefaultCategories: query error");
    return [];
  }

  if (existing && existing.length > 0) {
    return (existing as Record<string, unknown>[]).map(mapRowToCategory);
  }

  const rows = DEFAULT_CATEGORIES.map((def) => ({
    user_id: userId,
    name: def.name,
    icon: def.icon,
    color: def.color,
    sort_order: def.sort_order,
    is_default: true,
  }));

  const { data: created, error: insertError } = await sb
    .from("folder_categories")
    .insert(rows)
    .select();

  if (insertError) {
    logger.error(
      { error: insertError },
      "ensureDefaultCategories: insert error",
    );
    return [];
  }

  return (created as Record<string, unknown>[]).map(mapRowToCategory);
}

function mapRowToCategory(row: Record<string, unknown>): FolderCategory {
  return {
    id: row.id as number,
    user_id: row.user_id as string,
    name: row.name as string,
    icon: (row.icon as string) || null,
    color: (row.color as string) || null,
    sort_order: (row.sort_order as number) ?? 0,
    is_default: (row.is_default as boolean) ?? false,
    created_at: (row.created_at as string) || null,
    updated_at: (row.updated_at as string) || null,
  };
}
