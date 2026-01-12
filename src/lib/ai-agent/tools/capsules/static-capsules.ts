/**
 * 静态胶囊映射 - 极简版
 *
 * 设计原则：
 * 1. 按意图类型分组，不做动态合成
 * 2. 跨域意图（如"搜索并删除"）暂时拆成两步执行
 * 3. 未来需要动态合成时再升级
 *
 * @version 1.0.0
 * @since 2026-01-12
 */

import type { IntentType } from "@/lib/shared/types";

/**
 * 静态胶囊定义
 */
export interface StaticCapsule {
  /** 胶囊 ID */
  id: string;
  /** 胶囊名称 */
  name: string;
  /** 包含的工具 ID 列表 */
  toolIds: string[];
  /** 适用的意图类型 */
  intentTypes: IntentType[];
  /** 优先级（越小越优先） */
  priority: number;
}

/**
 * 静态胶囊定义列表
 *
 * 按使用频率排序，覆盖 80%+ 场景
 */
export const STATIC_CAPSULES: StaticCapsule[] = [
  // ============================================
  // 高频胶囊（覆盖 80% 场景）
  // ============================================

  {
    id: "query",
    name: "查询胶囊",
    toolIds: [
      // 列表类
      "list_recent",
      "list_by_folder",
      "list_by_platform",
      "list_wechat_articles",
      // 统计类
      "count_total",
      "count_by_folder",
      "count_by_platform",
      "get_stats",
      // 文件夹查询
      "list_folders",
      "get_folder_detail",
      "get_folder_bookmarks",
    ],
    intentTypes: ["query"],
    priority: 1,
  },

  {
    id: "search",
    name: "搜索胶囊",
    toolIds: [
      "search",
      "semantic_search",
      // 支持搜索后的列表操作
      "list_recent",
      "list_by_folder",
    ],
    intentTypes: ["query"], // search 属于 query 大类
    priority: 2,
  },

  {
    id: "action",
    name: "操作胶囊",
    toolIds: [
      // 标签管理
      "batch_add_tags",
      "batch_remove_tags",
      // 书签操作
      "update_bookmark",
      "toggle_bookmark_read",
      "toggle_bookmark_starred",
      "move_bookmarks",
      "move_bookmark",
    ],
    intentTypes: ["action"],
    priority: 1,
  },

  // ============================================
  // 中频胶囊（覆盖 15% 场景）
  // ============================================

  {
    id: "organize",
    name: "整理胶囊",
    toolIds: [
      // 文件夹管理
      "create_folder",
      "rename_folder",
      "delete_folder",
      "merge_folders",
      "split_folder",
      "move_folder_to_group",
      // 自动分类
      "auto_classify_inbox",
      // 标签管理
      "batch_add_tags",
      "batch_remove_tags",
    ],
    intentTypes: ["organize"],
    priority: 1,
  },

  {
    id: "export",
    name: "导出胶囊",
    toolIds: ["export_bookmarks", "list_export_formats", "preview_export"],
    intentTypes: ["action"], // 导出属于 action 子集
    priority: 3,
  },

  {
    id: "import",
    name: "导入胶囊",
    toolIds: [
      "import_browser_bookmarks",
      "import_bookmarks",
      "import_wechat_article",
    ],
    intentTypes: ["create"],
    priority: 2,
  },

  // ============================================
  // 低频胶囊（覆盖 5% 场景）
  // ============================================

  {
    id: "danger",
    name: "危险操作胶囊",
    toolIds: [
      "delete_bookmark",
      "batch_delete_bookmarks",
      "delete_folder",
      "delete_folder_bookmarks",
    ],
    intentTypes: ["action"],
    priority: 10, // 最低优先级
  },

  {
    id: "learn",
    name: "学习胶囊",
    toolIds: [
      // 主动回忆
      "get_review_queue",
      "submit_review_response",
      "get_mastery_stats",
      "generate_flashcards",
      "update_review_preferences",
      // 知识链接
      "find_related_by_topic",
      "get_knowledge_graph",
    ],
    intentTypes: ["learn"],
    priority: 1,
  },

  {
    id: "analyze",
    name: "分析胶囊",
    toolIds: [
      "get_stats",
      "get_mastery_stats",
      "get_knowledge_graph",
      // 插件授权统计
      "get_plugin_auth_stats",
    ],
    intentTypes: ["analyze"],
    priority: 1,
  },

  {
    id: "settings",
    name: "设置胶囊",
    toolIds: [
      "get_user_settings",
      "get_user_interests",
      "update_user_interests",
      "get_classification_settings",
      "update_classification_settings",
      "update_trust_mode",
    ],
    intentTypes: ["action", "query"],
    priority: 5,
  },

  {
    id: "create",
    name: "创建胶囊",
    toolIds: [
      "create_bookmark",
      "create_folder",
      "create_snapshot",
      "create_smart_list",
    ],
    intentTypes: ["create"],
    priority: 1,
  },

  {
    id: "refine",
    name: "精细化胶囊",
    toolIds: ["update_bookmark", "update_smart_list", "rename_folder"],
    intentTypes: ["refine"],
    priority: 1,
  },

  {
    id: "chitchat",
    name: "闲聊胶囊",
    toolIds: [
      // 闲聊场景通常不需要工具
      // 但保留一些信息查询工具
      "get_stats",
      "count_total",
    ],
    intentTypes: ["chitchat"],
    priority: 1,
  },

  {
    id: "smart_list",
    name: "智能列表胶囊",
    toolIds: [
      "create_smart_list",
      "list_smart_lists",
      "get_smart_list_count",
      "get_smart_list_items",
      "update_smart_list",
      "delete_smart_list",
      "toggle_smart_list_pin",
    ],
    intentTypes: ["query", "create", "action"],
    priority: 4,
  },

  {
    id: "read",
    name: "阅读胶囊",
    toolIds: ["read_bookmark", "toggle_bookmark_read"],
    intentTypes: ["query", "action"],
    priority: 3,
  },
];

/**
 * 获取所有唯一的工具 ID
 */
export function getAllToolIds(): string[] {
  const toolIds = new Set<string>();
  for (const capsule of STATIC_CAPSULES) {
    for (const toolId of capsule.toolIds) {
      toolIds.add(toolId);
    }
  }
  return Array.from(toolIds);
}

/**
 * 根据意图类型获取对应的胶囊
 */
export function getCapsulesForIntent(intent: IntentType): StaticCapsule[] {
  return STATIC_CAPSULES.filter((capsule) =>
    capsule.intentTypes.includes(intent),
  ).sort((a, b) => a.priority - b.priority);
}

/**
 * 根据胶囊 ID 获取胶囊
 */
export function getCapsuleById(id: string): StaticCapsule | undefined {
  return STATIC_CAPSULES.find((capsule) => capsule.id === id);
}
