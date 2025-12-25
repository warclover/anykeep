/**
 * 统一查询字段常量
 * @description 确保所有 API 端点返回一致的字段集
 * @version 1.0.0
 *
 * 设计原则:
 * - BOOKMARK_LIST_FIELDS: 列表查询，排除大字段（embedding），包含 UI 展示所需字段
 * - BOOKMARK_DETAIL_FIELDS: 详情查询，包含所有字段
 * - FOLDER_LIST_FIELDS: 文件夹列表，包含树形结构所需字段
 */

/**
 * 书签列表查询字段
 * 用于: GET /api/bookmarks, GET /api/init (bookmarks 部分)
 *
 * 排除字段:
 * - embedding, title_embedding, tag_embedding (向量字段，约 8KB/条)
 * - search_vector (搜索向量)
 * - classification_result (分类 JSON)
 * - ai_vision_data (视觉分析 JSON)
 */
export const BOOKMARK_LIST_FIELDS = `
  id,
  title,
  url,
  platform,
  cover_url,
  description,
  source_name,
  rating,
  is_invalid,
  is_in_trash,
  is_read,
  is_starred,
  is_locked,
  folder_id,
  user_tags,
  ai_summary,
  ai_tags,
  ai_content_type,
  ai_content_type_confidence,
  status,
  pending_cluster,
  author,
  publish_time,
  word_count,
  image_count,
  read_at,
  starred_at,
  has_snapshot,
  snapshot_status,
  created_at,
  updated_at,
  folders(name)
`.replace(/\s+/g, "");

/**
 * 书签详情查询字段
 * 用于: GET /api/bookmarks/[id]
 *
 * 包含所有字段（含 embedding），用于详情页和编辑
 */
export const BOOKMARK_DETAIL_FIELDS = `*, folders(name)`;

/**
 * 文件夹列表查询字段
 * 用于: GET /api/folders, GET /api/init (folders 部分)
 */
export const FOLDER_LIST_FIELDS = `
  id,
  name,
  parent_id,
  is_system,
  system_type,
  is_archived,
  folder_group,
  sort_order,
  created_at,
  updated_at
`.replace(/\s+/g, "");

/**
 * 智能列表查询字段
 * 用于: GET /api/smart-lists, GET /api/init (smartLists 部分)
 */
export const SMART_LIST_FIELDS = `
  id,
  user_id,
  name,
  description,
  icon,
  color,
  filters,
  sort_by,
  view_mode,
  sort_order,
  is_pinned,
  is_preset,
  bookmark_count,
  last_accessed_at,
  created_at,
  updated_at
`.replace(/\s+/g, "");
