/**
 * Tool 分层定义
 *
 * 将 82 个工具按使用频率和场景分层，实现意图驱动的智能加载
 *
 * 分层架构：
 * - Layer 0 (Core): 始终加载的核心工具 (8个)
 * - Layer 1 (Intent): 按意图类型加载 (按需)
 * - Layer 2 (Extended): 显式请求时加载 (按需)
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

/**
 * 工具层级定义
 */
export type ToolLayer = "core" | "intent" | "extended";

/**
 * 工具集名称
 */
export type ToolSetName =
  // Layer 1: Intent-Specific
  | "query_tools"
  | "manage_tools"
  | "organize_tools"
  | "analyze_tools"
  | "export_tools"
  | "learn_tools"
  | "settings_tools"
  // Layer 2: Extended
  | "import_tools"
  | "messages_tools";

// ============================================
// Layer 0: Core Tools - 始终加载 (8个)
// ============================================

/**
 * 核心工具列表
 *
 * 这些工具覆盖最常见的场景，始终可用
 *
 * P0-3b 修复：移除不存在的 "get_bookmark"，实际工具名为 "read_bookmark"
 */
export const CORE_TOOLS: readonly string[] = [
  // 搜索 - 最常用功能
  "search_bookmarks",
  // 快速查询
  "list_recent",
  "count_total",
  "get_stats",
  // 文件夹列表 - 常见查询
  "list_folders",
  // 标签列表
  "list_tags",
  // 内容阅读/书签详情
  "read_bookmark",
] as const;

// ============================================
// Layer 1: Intent-Specific Tools - 按意图加载
// ============================================

/**
 * 查询工具集 (12个)
 *
 * 触发意图: query:list, query:count, query:stats
 */
export const QUERY_TOOLS: readonly string[] = [
  // 按条件查询
  "list_by_folder",
  "list_by_platform",
  "list_wechat_articles",
  // 统计
  "count_by_folder",
  "count_by_platform",
  // 文件夹详情
  "get_folder_detail",
  "get_folder_bookmarks",
  // 智能列表
  "list_smart_lists",
  "get_smart_list_items",
  "get_smart_list_count",
  // MD 收藏
  "list_md_collections",
  "get_md_collection",
] as const;

/**
 * 管理工具集 (18个)
 *
 * 触发意图: action:tag, action:move, action:delete, action:create, action:update
 */
export const MANAGE_TOOLS: readonly string[] = [
  // 书签操作
  "toggle_bookmark_read",
  "toggle_bookmark_starred",
  "create_bookmark",
  "update_bookmark",
  "delete_bookmark",
  // 批量操作
  "batch_tags",
  "move_bookmarks",
  "move_bookmark_to_folder",
  // 文件夹操作
  "create_folder",
  "rename_folder",
  "toggle_folder_archive",
  // 智能列表操作
  "toggle_smart_list_pin",
  "create_smart_list",
  "update_smart_list",
  "delete_smart_list",
  // MD 收藏操作
  "create_md_collection",
  "update_md_collection",
  "delete_md_collection",
] as const;

/**
 * 整理工具集 (15个)
 *
 * 触发意图: organize:cleanup, organize:classify, organize:dedupe, organize:merge
 */
export const ORGANIZE_TOOLS: readonly string[] = [
  // 批量操作（复用）
  "batch_tags",
  "move_bookmarks",
  "batch_delete_bookmarks",
  // 自动分类
  "auto_classify_inbox",
  // 文件夹高级操作
  "merge_folders",
  "split_folder",
  "delete_folder",
  "delete_folder_bookmarks",
  "toggle_folder_lock",
  "reorder_folder",
  "move_folder_to_group",
  // 快照操作
  "create_snapshot",
  "compare_snapshots",
  "list_snapshots",
  "delete_snapshot",
] as const;

/**
 * 分析工具集 (8个)
 *
 * 触发意图: analyze:report, analyze:insight
 */
export const ANALYZE_TOOLS: readonly string[] = [
  // 统计（Core 已有 get_stats，这里补充专项）
  "get_wechat_article_stats",
  "get_md_stats",
  "get_mastery_stats",
  // 知识图谱（精简后保留主题关联）
  "find_related_by_topic",
  // 复习队列
  "get_review_queue",
  // 搜索（用于分析场景的搜索）
  "search_md_collections",
] as const;

/**
 * 导出工具集 (4个)
 *
 * 触发意图: create:export
 */
export const EXPORT_TOOLS: readonly string[] = [
  "export_bookmarks",
  "preview_export",
  "list_export_formats",
  "search_md_collections",
] as const;

/**
 * 学习工具集
 *
 * 触发意图: learn:path
 */
export const LEARN_TOOLS: readonly string[] = [
  // [已移除] active_recall 工具 - 精简重构 2026-03-09
  // [已移除] get_knowledge_graph - 知识图谱精简重构 2026-01-29
] as const;

/**
 * 设置工具集 (8个)
 *
 * 触发意图: action:settings, query:trust_mode
 */
export const SETTINGS_TOOLS: readonly string[] = [
  "get_trust_mode",
  "recommend_trust_mode",
  "update_trust_mode",
  "get_user_settings",
  "get_classification_settings",
  "update_classification_settings",
  "get_user_interests",
  "update_user_interests",
] as const;

// ============================================
// Layer 2: Extended Tools - 显式请求时加载
// ============================================

/**
 * 导入工具集 (3个)
 *
 * 触发条件: 用户明确提及"导入"
 */
export const IMPORT_TOOLS: readonly string[] = [
  "import_bookmarks",
  "import_browser_bookmarks",
  "import_wechat_article",
] as const;

/**
 * 消息工具集 (3个)
 *
 * 触发条件: 用户提及"消息"、"通知"
 */
export const MESSAGES_TOOLS: readonly string[] = [
  "list_messages",
  // P1-6 修复：命名统一为 summarize_unread_messages
  "summarize_unread_messages",
  "batch_mark_read",
] as const;

// ============================================
// 工具集映射表
// ============================================

/**
 * 工具集名称到工具列表的映射
 */
export const TOOL_SETS: Record<ToolSetName, readonly string[]> = {
  // Layer 1
  query_tools: QUERY_TOOLS,
  manage_tools: MANAGE_TOOLS,
  organize_tools: ORGANIZE_TOOLS,
  analyze_tools: ANALYZE_TOOLS,
  export_tools: EXPORT_TOOLS,
  learn_tools: LEARN_TOOLS,
  settings_tools: SETTINGS_TOOLS,
  // Layer 2
  import_tools: IMPORT_TOOLS,
  messages_tools: MESSAGES_TOOLS,
};

/**
 * 获取工具集
 */
export function getToolSet(name: ToolSetName): readonly string[] {
  return TOOL_SETS[name] ?? [];
}

/**
 * 合并多个工具集名称（去重）
 *
 * 注意：此函数合并工具集名称，返回工具名称列表
 * 与 ai-sdk-types.ts 中的 mergeToolSets 不同（后者合并 Vercel AI SDK ToolSet 对象）
 */
export function mergeToolSetNames(...setNames: ToolSetName[]): string[] {
  const merged = new Set<string>();

  for (const name of setNames) {
    const tools = TOOL_SETS[name];
    if (tools) {
      for (const tool of tools) {
        merged.add(tool);
      }
    }
  }

  return Array.from(merged);
}

/**
 * 获取所有工具名称
 */
export function getAllToolNames(): string[] {
  const all = new Set<string>();

  // Core
  for (const tool of CORE_TOOLS) {
    all.add(tool);
  }

  // All sets
  for (const tools of Object.values(TOOL_SETS)) {
    for (const tool of tools) {
      all.add(tool);
    }
  }

  return Array.from(all);
}
