/**
 * 工具描述模板与标准
 *
 * 为 AI 模型提供高质量的工具描述，提升工具选择准确性
 *
 * 模板结构：
 * 1. 一句话核心功能
 * 2. 使用场景（3-5个示例）
 * 3. 与相关工具的区别
 * 4. 参数说明
 * 5. 注意事项/边界情况
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

// ============================================
// 工具分类映射
// ============================================

/**
 * 工具分类与对应的工具列表
 */
export const TOOL_CATEGORIES = {
  query: [
    "list_recent",
    "count_total",
    "list_by_folder",
    "list_by_platform",
    "count_by_folder",
    "count_by_platform",
    "get_stats",
  ],
  folder: [
    "list_folders",
    "create_folder",
    "delete_folder",
    "rename_folder",
    "get_folder_detail",
    "get_folder_bookmarks",
    "move_bookmark",
    "move_bookmarks_batch",
    "move_folder_to_group",
    "merge_folders",
    "split_folder",
    "toggle_folder_archive",
    "toggle_folder_lock",
    "auto_classify_inbox",
    "reorder_folder",
    "delete_folder_bookmarks",
  ],
  bookmark: [
    "create_bookmark",
    "delete_bookmark",
    "update_bookmark",
    "toggle_bookmark_read",
    "toggle_bookmark_starred",
    "batch_delete_bookmarks",
    "create_snapshot",
    "read_bookmark",
  ],
  search: ["search", "semantic_search"],
  action: ["batch_tags", "move_bookmarks"],
  export: ["export_bookmarks", "list_export_formats", "preview_export"],
  settings: [
    "get_user_settings",
    "update_trust_mode",
    "get_classification_settings",
    "update_classification_settings",
    "get_user_interests",
    "update_user_interests",
  ],
  smart_list: [
    "create_smart_list",
    "delete_smart_list",
    "list_smart_lists",
    "update_smart_list",
    "toggle_smart_list_pin",
    "get_smart_list_items",
    "get_smart_list_count",
  ],
  md_collection: [
    "list_md_collections",
    "get_md_collection",
    "search_md_collections",
    "update_md_collection",
    "delete_md_collection",
    "toggle_md_read",
    "toggle_md_starred",
    "get_md_stats",
  ],
  import: ["import_bookmarks", "import_browser_bookmarks"],
  message: ["list_messages", "summarize_unread_messages", "batch_mark_read"],
  snapshot: ["compare_snapshots"],
} as const;

// ============================================
// 工具间关系映射
// ============================================

/**
 * 相似工具对比说明
 */
export const TOOL_COMPARISONS: Record<
  string,
  { similar: string[]; differences: string }
> = {
  // Query 类工具对比
  list_recent: {
    similar: ["list_by_folder", "list_by_platform", "search"],
    differences: `
• list_recent: 按时间倒序获取最新书签，无需参数，速度最快
• list_by_folder: 获取特定文件夹内的书签，需要 folder_id
• list_by_platform: 按平台筛选（微信/B站/知乎等）
• search: 需要搜索关键词，支持语义搜索`,
  },
  count_total: {
    similar: ["count_by_folder", "count_by_platform", "get_stats"],
    differences: `
• count_total: 仅返回总数，最轻量
• count_by_folder: 按文件夹分组统计
• count_by_platform: 按平台分组统计
• get_stats: 完整统计（趋势、标签、平台分布）`,
  },
  get_stats: {
    similar: ["count_total", "count_by_folder", "count_by_platform"],
    differences: `
• get_stats: 完整统计报告（趋势、标签云、平台分布）
• count_*: 仅统计数量，更轻量
优先使用 count_* 做简单统计，get_stats 用于详细分析`,
  },

  // Folder 类工具对比
  list_folders: {
    similar: ["get_folder_detail", "get_folder_bookmarks"],
    differences: `
• list_folders: 获取文件夹列表（名称、数量）
• get_folder_detail: 获取单个文件夹的详细信息
• get_folder_bookmarks: 获取文件夹内的书签列表`,
  },
  move_bookmark: {
    similar: ["move_bookmarks_batch", "move_bookmarks"],
    differences: `
• move_bookmark: 移动单个书签到新文件夹
• move_bookmarks_batch: 批量移动多个书签（同文件夹内）
• move_bookmarks: 批量移动书签（action 类，需确认）`,
  },
  merge_folders: {
    similar: ["split_folder", "move_bookmarks_batch"],
    differences: `
• merge_folders: 将多个文件夹合并为一个
• split_folder: 将一个文件夹拆分为多个
• move_bookmarks_batch: 仅移动书签，不操作文件夹`,
  },

  // Search 类工具对比
  search: {
    similar: ["semantic_search", "list_recent"],
    differences: `
• search: 关键词搜索，精确匹配标题/描述/标签
• semantic_search: 语义搜索，支持自然语言查询
• list_recent: 无需搜索词，按时间排序`,
  },
  semantic_search: {
    similar: ["search"],
    differences: `
• semantic_search: 理解用户意图，支持模糊查询
• search: 精确关键词匹配，速度更快
用户不确定关键词时优先使用 semantic_search`,
  },

  // Bookmark 类工具对比
  toggle_bookmark_read: {
    similar: ["toggle_bookmark_starred", "update_bookmark"],
    differences: `
• toggle_bookmark_read: 仅切换已读状态
• toggle_bookmark_starred: 仅切换星标状态
• update_bookmark: 修改任意字段（标题、标签等）`,
  },
  delete_bookmark: {
    similar: ["batch_delete_bookmarks"],
    differences: `
• delete_bookmark: 删除单个书签
• batch_delete_bookmarks: 批量删除多个书签（需确认）`,
  },

  // Message 类工具对比
  list_messages: {
    similar: ["summarize_unread_messages"],
    differences: `
• list_messages: 获取消息列表（支持状态/级别筛选、分页）
• summarize_unread_messages: 生成未读消息智能摘要（统计、分组、建议）
查看具体消息用 list_messages，快速了解概况用 summarize_unread_messages`,
  },
  summarize_unread_messages: {
    similar: ["list_messages"],
    differences: `
• summarize_unread_messages: 生成摘要报告（按类型/级别统计、趋势、建议）
• list_messages: 获取消息详情列表
用户问"有什么消息"优先使用 summarize_unread_messages`,
  },
  batch_mark_read: {
    similar: ["list_messages"],
    differences: `
• batch_mark_read: 批量标记消息为已读（支持按 ID/类型/级别/时间筛选）
• list_messages: 仅查询消息，不修改状态
用户说"清理消息"或"标记已读"时使用 batch_mark_read`,
  },
};

// ============================================
// 边界情况处理说明
// ============================================

/**
 * 常见边界情况处理
 */
export const BOUNDARY_CASES = {
  emptyResult: "如果结果为空，说明用户暂无相关数据，可建议用户添加收藏",
  maxLimit: "超过最大限制会自动截断，无需担心参数过大",
  notFound: "如果指定 ID 不存在，返回 NOT_FOUND 错误",
  unauthorized: "如果数据不属于当前用户，返回 UNAUTHORIZED 错误",
  duplicate: "如果 URL 已存在，返回 DUPLICATE_URL 错误",
  confirmation: "高风险操作需要用户确认后才会执行",
} as const;

// ============================================
// 描述生成辅助函数
// ============================================

/**
 * 生成工具描述模板
 */
export function buildToolDescription(config: {
  /** 核心功能描述（一句话） */
  core: string;
  /** 使用场景示例 */
  scenarios: string[];
  /** 工具名称（用于查找对比） */
  toolName?: string;
  /** 注意事项 */
  notes?: string[];
  /** 边界情况 */
  boundaries?: Array<keyof typeof BOUNDARY_CASES>;
}): string {
  const parts: string[] = [config.core];

  // 使用场景
  if (config.scenarios.length > 0) {
    parts.push("");
    parts.push("【使用场景】");
    config.scenarios.forEach((s) => parts.push(`• ${s}`));
  }

  // 工具对比
  if (config.toolName && TOOL_COMPARISONS[config.toolName]) {
    const comparison = TOOL_COMPARISONS[config.toolName];
    parts.push("");
    parts.push("【与相关工具区别】");
    parts.push(comparison.differences.trim());
  }

  // 注意事项
  if (config.notes && config.notes.length > 0) {
    parts.push("");
    parts.push("【注意事项】");
    config.notes.forEach((n) => parts.push(`• ${n}`));
  }

  // 边界情况
  if (config.boundaries && config.boundaries.length > 0) {
    parts.push("");
    parts.push("【边界情况】");
    config.boundaries.forEach((b) => parts.push(`• ${BOUNDARY_CASES[b]}`));
  }

  return parts.join("\n");
}

// ============================================
// 预定义的增强描述
// ============================================

/**
 * Query 类工具增强描述
 */
export const QUERY_TOOL_DESCRIPTIONS = {
  list_recent: buildToolDescription({
    core: "获取最近收藏的书签（按创建时间倒序）。",
    toolName: "list_recent",
    scenarios: [
      '"最近收藏了什么"',
      '"看看我的收藏"',
      '"最近添加的书签"',
      '"显示最新10条收藏"',
    ],
    notes: [
      "默认返回 10 条，最多 20 条",
      "不包含已删除的书签",
      "不包含浏览器导入的书签",
    ],
    boundaries: ["emptyResult", "maxLimit"],
  }),

  count_total: buildToolDescription({
    core: "统计用户的书签总数（最轻量的统计方式）。",
    toolName: "count_total",
    scenarios: ['"我一共收藏了多少"', '"我的收藏数量"', '"总共有多少书签"'],
    notes: ["不包含已删除和浏览器书签", "仅返回数字，响应最快"],
    boundaries: ["emptyResult"],
  }),

  list_by_folder: buildToolDescription({
    core: "获取指定文件夹内的所有书签。",
    scenarios: [
      '"工作文件夹里有什么"',
      '"显示学习文件夹的内容"',
      '"查看XX文件夹的书签"',
    ],
    notes: [
      "需要提供 folder_id 参数",
      "支持分页（limit + offset）",
      "可按创建时间/标题排序",
    ],
    boundaries: ["emptyResult", "notFound"],
  }),

  list_by_platform: buildToolDescription({
    core: "按来源平台筛选书签（微信/B站/知乎/小红书等）。",
    scenarios: [
      '"我的微信收藏"',
      '"B站收藏的视频"',
      '"知乎文章有哪些"',
      '"看看从小红书收藏的"',
    ],
    notes: [
      "支持平台：wechat/bilibili/zhihu/xiaohongshu/douyin/weibo/web/other",
      "默认返回 20 条，最多 50 条",
    ],
    boundaries: ["emptyResult", "maxLimit"],
  }),

  count_by_folder: buildToolDescription({
    core: "按文件夹分组统计书签数量。",
    scenarios: [
      '"每个文件夹有多少书签"',
      '"文件夹书签分布"',
      '"哪个文件夹收藏最多"',
    ],
    notes: ["返回所有非空文件夹的统计", "包含文件夹名称和书签数"],
    boundaries: ["emptyResult"],
  }),

  count_by_platform: buildToolDescription({
    core: "按来源平台统计书签数量。",
    scenarios: ['"各平台收藏数量"', '"微信收藏了多少"', '"平台分布统计"'],
    notes: ["返回各平台的书签数量和占比", "自动按数量降序排列"],
    boundaries: ["emptyResult"],
  }),

  get_stats: buildToolDescription({
    core: "获取完整的收藏统计报告（总览、趋势、标签云、平台分布）。",
    toolName: "get_stats",
    scenarios: [
      '"我的收藏情况"',
      '"最近收藏趋势如何"',
      '"收藏统计分析"',
      '"给我一份收藏报告"',
    ],
    notes: [
      "可通过参数选择包含哪些统计（节省 token）",
      "趋势数据包含最近 30 天每日统计",
      "标签云默认返回 Top 20",
    ],
    boundaries: ["emptyResult"],
  }),
};

/**
 * Folder 类工具增强描述
 */
export const FOLDER_TOOL_DESCRIPTIONS = {
  list_folders: buildToolDescription({
    core: "获取用户的所有文件夹列表（名称、分组、书签数量）。",
    toolName: "list_folders",
    scenarios: [
      '"我有哪些文件夹"',
      '"查看我的收藏夹"',
      '"列出所有文件夹"',
      '"工作相关的文件夹有哪些"',
    ],
    notes: [
      "默认不包含已归档和系统文件夹",
      "可按分组筛选（work/study/life/entertainment/other）",
      "返回每个文件夹的书签数量",
    ],
    boundaries: ["emptyResult"],
  }),

  create_folder: buildToolDescription({
    core: "创建新的文件夹。",
    scenarios: [
      '"创建一个工作文件夹"',
      '"新建学习收藏夹"',
      '"帮我建一个叫XX的文件夹"',
    ],
    notes: [
      "文件夹名称不能重复",
      "可指定分组（work/study/life/entertainment/other）",
      "可指定父文件夹实现层级结构",
    ],
    boundaries: ["duplicate"],
  }),

  delete_folder: buildToolDescription({
    core: "删除指定的文件夹（书签会移到未分类）。",
    scenarios: ['"删除这个文件夹"', '"把XX文件夹删掉"', '"移除不用的文件夹"'],
    notes: [
      "文件夹内的书签不会删除，会移到未分类",
      "系统文件夹（如收件箱）不能删除",
      "此操作不可撤销",
    ],
    boundaries: ["notFound", "unauthorized"],
  }),

  rename_folder: buildToolDescription({
    core: "重命名文件夹。",
    scenarios: [
      '"把这个文件夹改名为XX"',
      '"重命名文件夹"',
      '"文件夹名字改成XX"',
    ],
    notes: ["新名称不能与现有文件夹重复", "系统文件夹不能重命名"],
    boundaries: ["notFound", "duplicate"],
  }),

  get_folder_detail: buildToolDescription({
    core: "获取单个文件夹的详细信息。",
    toolName: "list_folders",
    scenarios: [
      '"这个文件夹的详情"',
      '"XX文件夹有多少书签"',
      '"查看文件夹信息"',
    ],
    notes: ["返回文件夹的完整信息", "包含书签数量、创建时间等"],
    boundaries: ["notFound"],
  }),

  get_folder_bookmarks: buildToolDescription({
    core: "获取文件夹内的书签列表。",
    scenarios: [
      '"这个文件夹里有什么"',
      '"显示XX文件夹的书签"',
      '"查看文件夹内容"',
    ],
    notes: ["支持分页和排序", "返回书签的完整信息"],
    boundaries: ["notFound", "emptyResult"],
  }),

  move_bookmark: buildToolDescription({
    core: "将单个书签移动到指定文件夹。",
    toolName: "move_bookmark",
    scenarios: [
      '"把这个书签移到XX文件夹"',
      '"移动书签到工作文件夹"',
      '"将书签归类到XX"',
    ],
    notes: ["目标文件夹必须存在", "书签只能属于一个文件夹"],
    boundaries: ["notFound"],
  }),

  move_bookmarks_batch: buildToolDescription({
    core: "批量移动多个书签到指定文件夹。",
    toolName: "move_bookmark",
    scenarios: [
      '"把这些书签都移到XX文件夹"',
      '"批量移动书签"',
      '"将选中的书签归类"',
    ],
    notes: ["单次最多移动 100 个书签", "所有书签必须属于当前用户"],
    boundaries: ["notFound", "maxLimit"],
  }),

  move_folder_to_group: buildToolDescription({
    core: "将文件夹移动到指定分组。",
    scenarios: [
      '"把这个文件夹移到工作分组"',
      '"将文件夹归类到学习"',
      '"调整文件夹分组"',
    ],
    notes: [
      "支持分组：work/study/life/entertainment/other",
      "系统文件夹不能移动",
    ],
    boundaries: ["notFound"],
  }),

  merge_folders: buildToolDescription({
    core: "将多个文件夹合并为一个。",
    toolName: "merge_folders",
    scenarios: [
      '"把这几个文件夹合并"',
      '"合并重复的文件夹"',
      '"将XX和YY合并成一个"',
    ],
    notes: [
      "需要指定目标文件夹和源文件夹",
      "源文件夹的书签会移到目标文件夹",
      "源文件夹会被删除",
      "此操作需要确认",
    ],
    boundaries: ["notFound", "confirmation"],
  }),

  split_folder: buildToolDescription({
    core: "将一个文件夹拆分为多个。",
    toolName: "merge_folders",
    scenarios: [
      '"把这个文件夹拆分"',
      '"按标签拆分文件夹"',
      '"将大文件夹拆成小的"',
    ],
    notes: ["可按标签、平台等规则拆分", "原文件夹保留", "此操作需要确认"],
    boundaries: ["notFound", "confirmation"],
  }),

  toggle_folder_archive: buildToolDescription({
    core: "切换文件夹的归档状态。",
    scenarios: ['"归档这个文件夹"', '"取消归档"', '"把文件夹存档"'],
    notes: ["归档后文件夹不会在主列表显示", "可随时取消归档"],
    boundaries: ["notFound"],
  }),

  toggle_folder_lock: buildToolDescription({
    core: "切换文件夹的锁定状态。",
    scenarios: ['"锁定这个文件夹"', '"解锁文件夹"', '"保护文件夹不被修改"'],
    notes: ["锁定后文件夹内的书签不能被移动或删除", "可随时解锁"],
    boundaries: ["notFound"],
  }),

  auto_classify_inbox: buildToolDescription({
    core: "自动分类收件箱中的书签到对应文件夹。",
    scenarios: ['"整理收件箱"', '"自动分类未分类的书签"', '"帮我整理书签"'],
    notes: [
      "基于 AI 分析书签内容进行分类",
      "会创建建议的新文件夹",
      "此操作需要确认",
    ],
    boundaries: ["emptyResult", "confirmation"],
  }),

  reorder_folder: buildToolDescription({
    core: "调整文件夹的排序位置。",
    scenarios: [
      '"把这个文件夹排到前面"',
      '"调整文件夹顺序"',
      '"将文件夹移到第一位"',
    ],
    notes: ["影响文件夹在列表中的显示顺序", "不影响文件夹内容"],
    boundaries: ["notFound"],
  }),

  delete_folder_bookmarks: buildToolDescription({
    core: "删除文件夹内的所有书签（但保留文件夹）。",
    scenarios: [
      '"清空这个文件夹"',
      '"删除文件夹里的所有书签"',
      '"清理文件夹内容"',
    ],
    notes: ["文件夹本身不会删除", "书签会被永久删除", "此操作需要确认"],
    boundaries: ["notFound", "confirmation"],
  }),
};

/**
 * Bookmark 类工具增强描述
 */
export const BOOKMARK_TOOL_DESCRIPTIONS = {
  create_bookmark: buildToolDescription({
    core: "创建新的书签收藏。",
    scenarios: [
      '"收藏这个链接"',
      '"添加一个书签"',
      '"保存这个网页"',
      '"帮我收藏XX"',
    ],
    notes: [
      "自动检测平台（微信/B站/知乎等）",
      "可指定标签和文件夹",
      "URL 不能重复",
    ],
    boundaries: ["duplicate"],
  }),

  delete_bookmark: buildToolDescription({
    core: "删除单个书签。",
    toolName: "delete_bookmark",
    scenarios: ['"删除这个书签"', '"移除这条收藏"', '"把这个书签删掉"'],
    notes: ["删除后无法恢复", "只能删除自己的书签"],
    boundaries: ["notFound", "unauthorized"],
  }),

  update_bookmark: buildToolDescription({
    core: "更新书签的信息（标题、标签、描述等）。",
    toolName: "toggle_bookmark_read",
    scenarios: [
      '"修改书签标题"',
      '"给书签添加标签"',
      '"更新书签描述"',
      '"编辑这个收藏"',
    ],
    notes: ["可修改：标题、描述、标签、评分、星标等", "URL 不能修改"],
    boundaries: ["notFound"],
  }),

  toggle_bookmark_read: buildToolDescription({
    core: "切换书签的已读/未读状态。",
    toolName: "toggle_bookmark_read",
    scenarios: ['"标记为已读"', '"这个书签我看过了"', '"标记未读"'],
    notes: ["仅切换已读状态，不修改其他字段"],
    boundaries: ["notFound"],
  }),

  toggle_bookmark_starred: buildToolDescription({
    core: "切换书签的星标状态（收藏/取消收藏）。",
    toolName: "toggle_bookmark_read",
    scenarios: ['"给这个书签加星"', '"取消星标"', '"标记为重要"'],
    notes: ["星标书签会在列表中优先显示"],
    boundaries: ["notFound"],
  }),

  batch_delete_bookmarks: buildToolDescription({
    core: "批量删除多个书签。",
    toolName: "delete_bookmark",
    scenarios: ['"删除这些书签"', '"批量移除选中的收藏"', '"清理这些书签"'],
    notes: ["单次最多删除 100 个", "此操作不可撤销", "需要用户确认"],
    boundaries: ["notFound", "maxLimit", "confirmation"],
  }),

  create_snapshot: buildToolDescription({
    core: "为书签创建网页快照（保存网页内容）。",
    scenarios: ['"保存网页快照"', '"备份这个页面"', '"创建离线版本"'],
    notes: ["异步执行，可能需要几秒钟", "快照保存在云端"],
    boundaries: ["notFound"],
  }),

  read_bookmark: buildToolDescription({
    core: "获取单个书签的完整信息。",
    scenarios: ['"查看这个书签的详情"', '"这个书签是什么"', '"显示书签信息"'],
    notes: ["返回书签的所有字段", "包含快照信息（如有）"],
    boundaries: ["notFound"],
  }),
};

/**
 * Search 类工具增强描述
 */
export const SEARCH_TOOL_DESCRIPTIONS = {
  search: buildToolDescription({
    core: "关键词搜索书签（精确匹配标题、描述、标签）。",
    toolName: "search",
    scenarios: [
      '"搜索关于React的收藏"',
      '"找一下AI相关的书签"',
      '"搜XX关键词"',
    ],
    notes: [
      "精确匹配，需要关键词出现在标题/描述/标签中",
      "支持多关键词（空格分隔，AND 逻辑）",
      "默认返回 10 条结果",
    ],
    boundaries: ["emptyResult"],
  }),

  semantic_search: buildToolDescription({
    core: "语义搜索书签（理解用户意图，支持自然语言查询）。",
    toolName: "semantic_search",
    scenarios: [
      '"帮我找关于前端性能优化的文章"',
      '"有没有讲解设计模式的内容"',
      '"找一些学习编程的资源"',
    ],
    notes: [
      "基于向量相似度，无需精确关键词",
      "支持自然语言描述",
      "可设置相似度阈值（0-1）",
      "速度比关键词搜索稍慢",
    ],
    boundaries: ["emptyResult"],
  }),
};

/**
 * Action 类工具增强描述
 */
export const ACTION_TOOL_DESCRIPTIONS = {
  batch_tags: buildToolDescription({
    core: "批量为书签添加或移除标签。",
    scenarios: [
      '"给这些书签加上AI标签"',
      '"批量添加标签"',
      '"移除这些书签的XX标签"',
    ],
    notes: [
      "支持 add（添加）和 remove（移除）两种操作",
      "单次最多操作 200 个书签",
      "单次最多 20 个标签",
      "此操作需要确认",
    ],
    boundaries: ["notFound", "maxLimit", "confirmation"],
  }),

  move_bookmarks: buildToolDescription({
    core: "批量移动书签到指定文件夹（高风险操作）。",
    scenarios: ['"把这些书签都移到XX文件夹"', '"批量整理书签到新文件夹"'],
    notes: ["单次最多移动 100 个书签", "目标文件夹必须存在", "此操作需要确认"],
    boundaries: ["notFound", "maxLimit", "confirmation"],
  }),
};

/**
 * Export 类工具增强描述
 */
export const EXPORT_TOOL_DESCRIPTIONS = {
  export_bookmarks: buildToolDescription({
    core: "导出书签数据（支持多种格式）。",
    scenarios: ['"导出我的书签"', '"备份收藏数据"', '"下载书签为CSV"'],
    notes: [
      "支持格式：CSV、JSON、Markdown、HTML、Obsidian",
      "可选择导出字段",
      "大量数据会分块处理",
    ],
    boundaries: ["emptyResult"],
  }),

  list_export_formats: buildToolDescription({
    core: "获取支持的导出格式列表。",
    scenarios: ['"有哪些导出格式"', '"可以导出为什么格式"'],
    notes: ["返回每种格式的详细说明和适用场景"],
  }),

  preview_export: buildToolDescription({
    core: "预览导出内容（不实际下载）。",
    scenarios: ['"预览导出效果"', '"看看导出是什么样的"'],
    notes: ["返回前几条数据的预览", "用于确认格式是否符合需求"],
  }),
};

/**
 * Settings 类工具增强描述
 */
export const SETTINGS_TOOL_DESCRIPTIONS = {
  get_user_settings: buildToolDescription({
    core: "获取用户的所有设置（信任模式、分类设置等）。",
    scenarios: ['"查看我的设置"', '"当前是什么模式"', '"显示AI设置"'],
    notes: ["包含信任模式、自动分类、文件夹管理等设置"],
  }),

  update_trust_mode: buildToolDescription({
    core: "更新 AI 信任模式。",
    scenarios: ['"切换到全自动模式"', '"设置为半自动"', '"改为手动模式"'],
    notes: [
      "full_auto: AI 全权处理所有分类",
      "semi_auto: 高置信度自动，低置信度需确认",
      "manual: 仅整理到待整理，不自动分类",
    ],
  }),

  get_classification_settings: buildToolDescription({
    core: "获取自动分类相关设置。",
    scenarios: ['"分类设置是什么"', '"自动分类怎么配置的"'],
    notes: ["包含自动分类开关、置信度阈值等"],
  }),

  update_classification_settings: buildToolDescription({
    core: "更新自动分类设置。",
    scenarios: ['"开启自动分类"', '"调整分类置信度"', '"关闭自动分类"'],
    notes: ["可配置：自动分类开关、置信度阈值、低置信度处理方式"],
  }),

  get_user_interests: buildToolDescription({
    core: "获取用户的兴趣标签。",
    scenarios: ['"我的兴趣标签是什么"', '"查看兴趣设置"'],
    notes: ["兴趣标签用于 AI 个性化推荐"],
  }),

  update_user_interests: buildToolDescription({
    core: "更新用户的兴趣标签。",
    scenarios: ['"添加技术兴趣"', '"更新我的兴趣"', '"设置兴趣标签"'],
    notes: ["影响 AI 的推荐和分类倾向"],
  }),
};

/**
 * SmartList 类工具增强描述
 */
export const SMART_LIST_TOOL_DESCRIPTIONS = {
  list_smart_lists: buildToolDescription({
    core: "获取所有智能列表。",
    scenarios: ['"我有哪些智能列表"', '"查看智能筛选"'],
    notes: ["智能列表是基于规则的动态筛选"],
  }),

  create_smart_list: buildToolDescription({
    core: "创建智能列表（基于规则的动态筛选）。",
    scenarios: [
      '"创建一个筛选最近7天的智能列表"',
      '"建一个只显示星标的列表"',
      '"创建未读书签列表"',
    ],
    notes: [
      "支持的筛选条件：时间范围、平台、标签、星标、已读状态",
      "智能列表内容随书签变化自动更新",
    ],
  }),

  delete_smart_list: buildToolDescription({
    core: "删除智能列表。",
    scenarios: ['"删除这个智能列表"', '"移除XX筛选"'],
    notes: ["只删除列表本身，不影响书签"],
    boundaries: ["notFound"],
  }),

  update_smart_list: buildToolDescription({
    core: "更新智能列表的名称或筛选规则。",
    scenarios: ['"修改智能列表规则"', '"更新筛选条件"'],
    notes: ["可修改名称和筛选条件"],
    boundaries: ["notFound"],
  }),

  toggle_smart_list_pin: buildToolDescription({
    core: "切换智能列表的置顶状态。",
    scenarios: ['"置顶这个智能列表"', '"取消置顶"'],
    notes: ["置顶的列表会显示在列表最前面"],
    boundaries: ["notFound"],
  }),

  get_smart_list_items: buildToolDescription({
    core: "获取智能列表中的书签。",
    scenarios: ['"显示这个智能列表的内容"', '"查看智能列表里有什么"'],
    notes: ["根据智能列表的规则动态查询书签"],
    boundaries: ["notFound", "emptyResult"],
  }),

  get_smart_list_count: buildToolDescription({
    core: "获取智能列表中的书签数量。",
    scenarios: ['"这个智能列表有多少书签"', '"统计智能列表数量"'],
    notes: ["仅返回数量，不返回书签详情"],
    boundaries: ["notFound"],
  }),
};

/**
 * MDCollection 类工具增强描述
 */
export const MD_COLLECTION_TOOL_DESCRIPTIONS = {
  list_md_collections: buildToolDescription({
    core: "获取所有 Markdown 收藏。",
    scenarios: ['"我的MD收藏有哪些"', '"查看笔记收藏"'],
    notes: ["MD 收藏是富文本内容，与普通书签分开存储"],
  }),

  get_md_collection: buildToolDescription({
    core: "获取单个 MD 收藏的详情。",
    scenarios: ['"查看这个笔记"', '"显示MD内容"'],
    boundaries: ["notFound"],
  }),

  search_md_collections: buildToolDescription({
    core: "搜索 Markdown 收藏内容。",
    scenarios: ['"搜索笔记里关于XX的内容"', '"在MD收藏中找XX"'],
    boundaries: ["emptyResult"],
  }),

  update_md_collection: buildToolDescription({
    core: "更新 MD 收藏的内容。",
    scenarios: ['"修改这个笔记"', '"更新MD内容"'],
    boundaries: ["notFound"],
  }),

  delete_md_collection: buildToolDescription({
    core: "删除 MD 收藏。",
    scenarios: ['"删除这个笔记"', '"移除MD收藏"'],
    boundaries: ["notFound"],
  }),

  toggle_md_read: buildToolDescription({
    core: "切换 MD 收藏的已读状态。",
    scenarios: ['"标记笔记已读"', '"这个笔记看过了"'],
    boundaries: ["notFound"],
  }),

  toggle_md_starred: buildToolDescription({
    core: "切换 MD 收藏的星标状态。",
    scenarios: ['"给笔记加星"', '"取消笔记星标"'],
    boundaries: ["notFound"],
  }),

  get_md_stats: buildToolDescription({
    core: "获取 MD 收藏的统计信息。",
    scenarios: ['"笔记统计"', '"MD收藏有多少"'],
  }),
};

/**
 * Import 类工具增强描述
 */
export const IMPORT_TOOL_DESCRIPTIONS = {
  import_bookmarks: buildToolDescription({
    core: "导入书签数据。",
    scenarios: ['"导入书签"', '"从文件导入收藏"'],
    notes: ["支持 JSON、CSV 格式", "会自动检测重复"],
  }),

  import_browser_bookmarks: buildToolDescription({
    core: "导入浏览器书签（Chrome/Edge/Firefox/Safari）。",
    scenarios: ['"导入Chrome书签"', '"从浏览器导入收藏"'],
    notes: [
      "支持 Netscape Bookmark HTML 格式",
      "会保留文件夹结构",
      "自动检测重复 URL",
    ],
  }),
};

/**
 * Snapshot 类工具增强描述
 */
export const SNAPSHOT_TOOL_DESCRIPTIONS = {
  compare_snapshots: buildToolDescription({
    core: "对比两个快照版本的内容差异，识别页面变更。",
    scenarios: [
      '"这个页面最近有什么变化"',
      '"对比快照和上一版本"',
      '"查看页面内容更新了什么"',
      '"这篇文章有没有修改"',
    ],
    notes: [
      "默认与监控基线对比（如果存在）",
      "可指定特定的历史版本号进行对比",
      "返回详细的差异统计和变更摘要",
      "相似度低于 80% 视为显著变更",
    ],
    boundaries: ["notFound"],
  }),
};

// ============================================
// 合并所有描述
// ============================================

/**
 * 所有工具的增强描述
 */
export const ALL_TOOL_DESCRIPTIONS = {
  ...QUERY_TOOL_DESCRIPTIONS,
  ...FOLDER_TOOL_DESCRIPTIONS,
  ...BOOKMARK_TOOL_DESCRIPTIONS,
  ...SEARCH_TOOL_DESCRIPTIONS,
  ...ACTION_TOOL_DESCRIPTIONS,
  ...EXPORT_TOOL_DESCRIPTIONS,
  ...SETTINGS_TOOL_DESCRIPTIONS,
  ...SMART_LIST_TOOL_DESCRIPTIONS,
  ...MD_COLLECTION_TOOL_DESCRIPTIONS,
  ...IMPORT_TOOL_DESCRIPTIONS,
  ...SNAPSHOT_TOOL_DESCRIPTIONS,
} as const;

/**
 * 获取工具的增强描述
 */
export function getEnhancedDescription(toolName: string): string | undefined {
  return ALL_TOOL_DESCRIPTIONS[toolName as keyof typeof ALL_TOOL_DESCRIPTIONS];
}
