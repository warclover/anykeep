/**
 * 栏目（文件夹分类）领域类型定义
 * @module types/domain/folder-category
 */

export interface FolderCategory {
  id: number;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_default: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface FolderCategoryDbRow {
  id: number;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  sort_order: number | null;
  is_default: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export function toFolderCategory(row: FolderCategoryDbRow): FolderCategory {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    sort_order: row.sort_order ?? 0,
    is_default: row.is_default ?? false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toFolderCategoryList(
  rows: FolderCategoryDbRow[],
): FolderCategory[] {
  return rows.map(toFolderCategory);
}
