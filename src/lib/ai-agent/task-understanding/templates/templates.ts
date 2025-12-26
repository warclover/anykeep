/**
 * 预定义任务模板
 *
 * 定义常见任务的快速匹配模式
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import type { TaskTemplate } from "./types";

// =============================================================================
// 搜索相关模板
// =============================================================================

/**
 * 简单搜索模板
 */
export const searchSimpleTemplate: TaskTemplate = {
  id: "search_simple",
  name: "简单搜索",
  taskType: "search",
  patterns: [
    /^搜索?\s*(?<query>.+)$/i,
    /^查找?\s*(?<query>.+)$/i,
    /^找一?下?\s*(?<query>.+)$/i,
    /^搜一?下?\s*(?<query>.+)$/i,
  ],
  keywords: ["搜索", "查找", "找一下", "搜一下"],
  goalTemplate: "搜索包含「{query}」的收藏内容",
  reasoningTemplate: "用户希望查找特定内容，使用关键词搜索匹配标题和摘要",
  executionPlanTemplate: [
    {
      descriptionTemplate: "搜索包含「{query}」的收藏",
      action: "search_bookmarks",
      paramsTemplate: { query: "{query}" },
    },
    {
      descriptionTemplate: "返回搜索结果",
      action: "return_results",
    },
  ],
  riskLevel: "low",
  baseConfidence: 0.85,
  requiresConfirmation: false,
  priority: 100,
  enabled: true,
};

// =============================================================================
// 整理相关模板
// =============================================================================

/**
 * 整理收藏模板
 */
export const organizeGeneralTemplate: TaskTemplate = {
  id: "organize_general",
  name: "整理收藏",
  taskType: "organize",
  patterns: [
    /^(?:帮我)?整理(?:一下)?(?:我的)?收藏$/i,
    /^(?:帮我)?整理(?:一下)?(?:书签|内容)$/i,
    /^整理$/i,
  ],
  keywords: ["整理收藏", "整理一下", "帮我整理"],
  excludeKeywords: [
    "按时间",
    "按平台",
    "按作者",
    "到文件夹",
    "到目录",
    "到...文件夹",
  ],
  goalTemplate: "智能整理用户的收藏内容到合适的文件夹",
  reasoningTemplate: "用户希望整理收藏，将使用智能分类将内容归档到合适的文件夹",
  executionPlanTemplate: [
    {
      descriptionTemplate: "获取待整理的收藏列表",
      action: "get_unclassified_bookmarks",
    },
    {
      descriptionTemplate: "智能分析内容主题",
      action: "analyze_topics",
    },
    {
      descriptionTemplate: "匹配或创建目标文件夹",
      action: "match_folders",
    },
    {
      descriptionTemplate: "移动书签到对应文件夹",
      action: "move_bookmarks",
    },
  ],
  riskLevel: "medium",
  baseConfidence: 0.8,
  requiresConfirmation: false,
  priority: 90,
  enabled: true,
};

/**
 * 按时间整理模板
 */
export const organizeByTimeTemplate: TaskTemplate = {
  id: "organize_by_time",
  name: "按时间整理",
  taskType: "organize",
  patterns: [
    /^(?:帮我)?按时间整理(?:收藏)?$/i,
    /^(?:帮我)?整理(?:一下)?最近(?:的)?收藏$/i,
  ],
  keywords: ["按时间整理", "时间整理", "最近的收藏"],
  goalTemplate: "按时间顺序整理用户的收藏内容",
  reasoningTemplate: "用户希望按时间维度整理收藏，将按添加时间进行分组整理",
  executionPlanTemplate: [
    {
      descriptionTemplate: "获取收藏列表并按时间排序",
      action: "get_bookmarks_by_time",
    },
    {
      descriptionTemplate: "按时间段分组（本周/本月/更早）",
      action: "group_by_time",
    },
    {
      descriptionTemplate: "移动到对应的时间文件夹",
      action: "move_bookmarks",
    },
  ],
  riskLevel: "medium",
  baseConfidence: 0.85,
  requiresConfirmation: false,
  priority: 95,
  enabled: true,
};

/**
 * 整理到文件夹模板（实际是移动操作）
 *
 * 用户说"把这些整理到xxx文件夹"时，实际意图是移动，而不是智能整理
 * 注意：不匹配纯粹的 "移到/放到"，这些由 moveToFolderTemplate 处理
 */
export const organizeToFolderTemplate: TaskTemplate = {
  id: "organize_to_folder",
  name: "整理到文件夹",
  taskType: "move", // 注意：taskType 是 move，不是 organize
  patterns: [
    // 含 "整理" 关键词
    /^(?:把)?(?:这些?)?整理到\s*(?<folder>[^\s]+?)(?:文件夹)?$/i,
    // 含 "归档/归类" 关键词
    /^(?:把)?(?:这些?)?归(?:档|类)到\s*(?<folder>[^\s]+?)(?:文件夹)?$/i,
    // 含 "一个/某个" + "文件夹/目录" 的模式（表示新建文件夹意图）
    /^(?:把)?(?:这些?)?(?:放|移)到\s*(?:一个|某个)\s*(?<folder>[^\s]*?)(?:文件夹|目录)(?:里)?$/i,
    // "这些" + "整理" 组合
    /^这些?整理到\s*(?<folder>[^\s]+?)(?:文件夹)?$/i,
  ],
  keywords: ["整理到", "归档到", "归类到"],
  goalTemplate: "将选中的书签整理到「{folder}」文件夹",
  reasoningTemplate:
    "用户希望将当前选中或搜索到的书签移动到指定文件夹，这是一个移动操作",
  executionPlanTemplate: [
    {
      descriptionTemplate: "确认目标文件夹「{folder}」",
      action: "find_or_create_folder",
      paramsTemplate: { folderName: "{folder}" },
    },
    {
      descriptionTemplate: "移动选中的书签",
      action: "move_bookmarks",
      paramsTemplate: { targetFolder: "{folder}" },
    },
  ],
  riskLevel: "medium",
  baseConfidence: 0.9,
  requiresConfirmation: false,
  priority: 105, // 高于 moveToFolderTemplate (100) 和 organizeGeneralTemplate (90)
  enabled: true,
};

// =============================================================================
// 移动相关模板
// =============================================================================

/**
 * 移动到文件夹模板
 */
export const moveToFolderTemplate: TaskTemplate = {
  id: "move_to_folder",
  name: "移动到文件夹",
  taskType: "move",
  patterns: [
    /^(?:把这些?)?移(?:动)?到\s*(?<folder>[^\s文]+)(?:文件夹)?$/i,
    /^移到\s*(?<folder>[^\s]+)$/i,
    /^放到\s*(?<folder>[^\s文]+)(?:文件夹)?$/i,
  ],
  keywords: ["移动到", "移到", "放到"],
  goalTemplate: "将选中的书签移动到「{folder}」文件夹",
  reasoningTemplate: "用户希望将书签移动到指定文件夹，这是一个简单的移动操作",
  executionPlanTemplate: [
    {
      descriptionTemplate: "查找目标文件夹「{folder}」",
      action: "find_folder",
      paramsTemplate: { folderName: "{folder}" },
    },
    {
      descriptionTemplate: "移动选中的书签",
      action: "move_bookmarks",
      paramsTemplate: { targetFolder: "{folder}" },
    },
  ],
  riskLevel: "medium",
  baseConfidence: 0.9,
  requiresConfirmation: false,
  priority: 100,
  enabled: true,
};

// =============================================================================
// 导出相关模板
// =============================================================================

/**
 * 导出收藏模板
 */
export const exportGeneralTemplate: TaskTemplate = {
  id: "export_general",
  name: "导出收藏",
  taskType: "export",
  patterns: [/^导出(?:我的)?收藏$/i, /^导出(?:所有)?书签$/i, /^导出$/i],
  keywords: ["导出收藏", "导出书签", "导出"],
  excludeKeywords: ["csv", "json", "markdown", "md", "html", "obsidian"],
  goalTemplate: "将收藏导出为 Markdown 格式",
  reasoningTemplate: "用户希望导出收藏，默认使用 Markdown 格式，便于阅读和分享",
  executionPlanTemplate: [
    {
      descriptionTemplate: "获取收藏列表",
      action: "get_bookmarks",
    },
    {
      descriptionTemplate: "生成 Markdown 格式",
      action: "format_markdown",
    },
    {
      descriptionTemplate: "导出文件",
      action: "export_file",
      paramsTemplate: { format: "markdown" },
    },
  ],
  riskLevel: "low",
  baseConfidence: 0.8,
  requiresConfirmation: false,
  priority: 80,
  enabled: true,
};

/**
 * 导出为指定格式模板
 */
export const exportWithFormatTemplate: TaskTemplate = {
  id: "export_with_format",
  name: "导出指定格式",
  taskType: "export",
  patterns: [
    /^导出(?:为?|成)\s*(?<format>csv|json|markdown|md|html|obsidian)(?:格式)?$/i,
    /^导出\s*(?<format>csv|json|markdown|md|html|obsidian)\s*(?:格式)?$/i,
  ],
  keywords: [],
  goalTemplate: "将收藏导出为 {format} 格式",
  reasoningTemplate: "用户指定了导出格式 {format}，将按照指定格式生成导出文件",
  executionPlanTemplate: [
    {
      descriptionTemplate: "获取收藏列表",
      action: "get_bookmarks",
    },
    {
      descriptionTemplate: "生成 {format} 格式",
      action: "format_{format}",
    },
    {
      descriptionTemplate: "导出文件",
      action: "export_file",
      paramsTemplate: { format: "{format}" },
    },
  ],
  riskLevel: "low",
  baseConfidence: 0.9,
  requiresConfirmation: false,
  priority: 95,
  enabled: true,
};

// =============================================================================
// 查询统计模板
// =============================================================================

/**
 * 统计查询模板
 */
export const queryStatsTemplate: TaskTemplate = {
  id: "query_stats",
  name: "统计查询",
  taskType: "query",
  patterns: [
    /^我有多少(?:个)?收藏$/i,
    /^统计(?:一下)?(?:我的)?收藏$/i,
    /^收藏统计$/i,
  ],
  keywords: ["多少收藏", "统计一下", "收藏统计", "收藏数量"],
  goalTemplate: "统计用户的收藏情况",
  reasoningTemplate: "用户想要了解收藏的数量和分布情况，这是一个只读查询操作",
  executionPlanTemplate: [
    {
      descriptionTemplate: "获取收藏统计数据",
      action: "get_stats",
    },
    {
      descriptionTemplate: "格式化统计结果",
      action: "format_stats",
    },
  ],
  riskLevel: "low",
  baseConfidence: 0.9,
  requiresConfirmation: false,
  priority: 100,
  enabled: true,
};

// =============================================================================
// 删除相关模板
// =============================================================================

/**
 * 删除书签模板
 */
export const deleteBookmarksTemplate: TaskTemplate = {
  id: "delete_bookmarks",
  name: "删除书签",
  taskType: "delete",
  patterns: [
    /^删除(?:这些?)?(?:书签|收藏)$/i,
    /^删掉(?:这些?)?(?:书签|收藏)$/i,
    /^移除(?:这些?)?(?:书签|收藏)$/i,
  ],
  keywords: ["删除书签", "删掉书签", "删除收藏", "移除书签"],
  goalTemplate: "删除选中的书签",
  reasoningTemplate: "用户希望删除书签，这是不可逆操作，需要确认后执行",
  executionPlanTemplate: [
    {
      descriptionTemplate: "确认要删除的书签列表",
      action: "confirm_delete",
      requiresConfirmation: true,
    },
    {
      descriptionTemplate: "执行删除操作",
      action: "delete_bookmarks",
      requiresConfirmation: true,
    },
  ],
  riskLevel: "high",
  baseConfidence: 0.85,
  requiresConfirmation: true,
  confirmationReason: "删除操作不可撤销，请确认",
  priority: 100,
  enabled: true,
};

// =============================================================================
// 批量标签模板
// =============================================================================

/**
 * 批量添加标签模板
 */
export const batchAddTagsTemplate: TaskTemplate = {
  id: "batch_add_tags",
  name: "批量添加标签",
  taskType: "batch_tags",
  patterns: [
    /^(?:批量)?(?:给这些?)?(?:书签)?(?:加|添加|打)(?:上)?标签$/i,
    /^(?:添加|打)标签$/i,
  ],
  keywords: ["添加标签", "加标签", "打标签", "批量标签"],
  excludeKeywords: ["移除", "删除", "去掉"],
  goalTemplate: "为选中的书签添加标签",
  reasoningTemplate: "用户希望为书签添加标签，这是一个批量操作，可以撤销",
  executionPlanTemplate: [
    {
      descriptionTemplate: "获取选中的书签",
      action: "get_selected_bookmarks",
    },
    {
      descriptionTemplate: "添加标签",
      action: "batch_add_tags",
    },
  ],
  riskLevel: "medium",
  baseConfidence: 0.85,
  requiresConfirmation: false,
  priority: 90,
  enabled: true,
};

/**
 * 批量移除标签模板
 */
export const batchRemoveTagsTemplate: TaskTemplate = {
  id: "batch_remove_tags",
  name: "批量移除标签",
  taskType: "batch_tags",
  patterns: [/^(?:批量)?(?:移除|删除|去掉)(?:这些?)?(?:书签的)?标签$/i],
  keywords: ["移除标签", "删除标签", "去掉标签"],
  goalTemplate: "移除选中书签的标签",
  reasoningTemplate: "用户希望移除书签的标签，这是一个批量操作，可以撤销",
  executionPlanTemplate: [
    {
      descriptionTemplate: "获取选中的书签",
      action: "get_selected_bookmarks",
    },
    {
      descriptionTemplate: "移除标签",
      action: "batch_remove_tags",
    },
  ],
  riskLevel: "medium",
  baseConfidence: 0.85,
  requiresConfirmation: false,
  priority: 90,
  enabled: true,
};

// =============================================================================
// 复习回顾模板
// =============================================================================

/**
 * 知识复习模板
 */
export const reviewKnowledgeTemplate: TaskTemplate = {
  id: "review_knowledge",
  name: "知识复习",
  taskType: "review",
  patterns: [
    /^(?:帮我)?复习(?:一下)?(?:收藏|知识)$/i,
    /^(?:帮我)?回顾(?:一下)?(?:收藏|知识)$/i,
    /^知识复习$/i,
  ],
  keywords: ["复习收藏", "回顾收藏", "知识复习", "复习一下"],
  goalTemplate: "帮助用户复习近期收藏的知识内容",
  reasoningTemplate: "用户希望复习收藏的知识，将生成知识卡片和复习要点",
  executionPlanTemplate: [
    {
      descriptionTemplate: "获取近期收藏",
      action: "get_recent_bookmarks",
    },
    {
      descriptionTemplate: "分析内容要点",
      action: "analyze_key_points",
    },
    {
      descriptionTemplate: "生成复习卡片",
      action: "generate_review_cards",
    },
  ],
  riskLevel: "low",
  baseConfidence: 0.85,
  requiresConfirmation: false,
  priority: 85,
  enabled: true,
};

// =============================================================================
// 取消操作模板
// =============================================================================

/**
 * 取消操作模板
 *
 * 用户希望中止当前正在执行的操作
 */
export const cancelOperationTemplate: TaskTemplate = {
  id: "cancel_operation",
  name: "取消操作",
  taskType: "cancel",
  patterns: [
    /^取消(?:整理|操作|执行)?$/i,
    /^(?:不要|别)(?:整理|执行|继续)了?$/i,
    /^停(?:止|下来)?$/i,
    /^(?:算了|不用了)$/i,
  ],
  keywords: ["取消", "停止", "不要了", "算了", "不用了"],
  goalTemplate: "取消当前正在执行的操作",
  reasoningTemplate: "用户希望中止当前操作",
  executionPlanTemplate: [
    {
      descriptionTemplate: "中止当前操作",
      action: "cancel_current_operation",
    },
  ],
  riskLevel: "low",
  baseConfidence: 0.95,
  requiresConfirmation: false,
  priority: 200, // 最高优先级
  enabled: true,
};

// =============================================================================
// 默认模板集合
// =============================================================================

/**
 * 默认任务模板集合
 */
export const defaultTemplates: TaskTemplate[] = [
  // 取消操作（最高优先级）
  cancelOperationTemplate,
  // 搜索
  searchSimpleTemplate,
  // 整理到文件夹（优先于通用整理）
  organizeToFolderTemplate,
  // 整理
  organizeGeneralTemplate,
  organizeByTimeTemplate,
  // 移动
  moveToFolderTemplate,
  // 导出
  exportGeneralTemplate,
  exportWithFormatTemplate,
  // 查询
  queryStatsTemplate,
  // 删除
  deleteBookmarksTemplate,
  // 批量标签
  batchAddTagsTemplate,
  batchRemoveTagsTemplate,
  // 复习
  reviewKnowledgeTemplate,
];
