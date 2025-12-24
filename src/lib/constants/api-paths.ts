/**
 * API 路径常量
 *
 * 统一管理所有 API 路径，便于：
 * - 路径变更时集中修改
 * - IDE 自动补全和类型检查
 * - 避免硬编码字符串
 * - 支持渐进式 API 迁移
 *
 * Phase 0.4 实现：
 * - 按模块分组
 * - 支持动态参数
 * - 包含 internal API 路径
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

// ============================================
// Agent / AI 相关
// ============================================

export const API_AGENT = {
  /** 统一 AI 入口（推荐） */
  unified: "/api/agent/unified",
  /** AI 聊天 */
  chat: "/api/agent/chat",
  /**
   * 确认操作
   * @deprecated 2025-12-24 - 请使用 ConfirmationService 代替
   * @see {@link @/lib/ai-skills/effects/services/confirmation.service}
   * @sunset 2025-06-01
   */
  confirm: "/api/agent/confirm",
  /** 使用统计 */
  stats: "/api/agent/stats",
} as const;

export const API_AI = {
  /** AI 提供者列表 */
  providers: "/api/ai/providers",
  /** 快速操作 */
  quickActions: "/api/ai/quick-actions",
  /** 图像分析 */
  visionAnalyze: "/api/ai/vision-analyze",
} as const;

// ============================================
// 书签管理
// ============================================

export const API_BOOKMARKS = {
  /** 书签列表/创建 */
  list: "/api/bookmarks",
  /** 书签详情 */
  detail: (id: number) => `/api/bookmarks/${id}`,
  /** 永久删除 */
  permanent: (id: number) => `/api/bookmarks/${id}/permanent`,
  /** 相关书签 */
  related: (id: number) => `/api/bookmarks/${id}/related`,
  /** 恢复 */
  restore: (id: number) => `/api/bookmarks/${id}/restore`,
  /** 批量删除 */
  batchDelete: "/api/bookmarks/batch-delete",
  /** 批量导入 */
  batchImport: "/api/bookmarks/batch-import",
  /** 批量移动 */
  batchMove: "/api/bookmarks/batch-move",
  /** 批量恢复 */
  batchRestore: "/api/bookmarks/batch-restore",
  /** 批量状态 */
  batchStatus: "/api/bookmarks/batch-status",
  /** 批量标签 */
  batchTags: "/api/bookmarks/batch-tags",
  /** 向量嵌入 */
  embeddings: "/api/bookmarks/embeddings",
  /** 生成标签 */
  generateTags: "/api/bookmarks/generate-tags",
  /** 元数据 */
  metadata: "/api/bookmarks/metadata",
  /** 建议 */
  suggestions: "/api/bookmarks/suggestions",
  /** 验证 */
  validate: "/api/bookmarks/validate",
} as const;

// ============================================
// 浏览器书签导入
// ============================================

export const API_BROWSER_BOOKMARK = {
  /** 导出 */
  export: "/api/browser-bookmark/export",
  /** 获取元数据 */
  fetchMetadata: "/api/browser-bookmark/fetch-metadata",
  /** 导入历史 */
  history: "/api/browser-bookmark/history",
  /** 验证 */
  validate: "/api/browser-bookmark/validate",
} as const;

// ============================================
// 分类系统
// ============================================

export const API_CLASSIFICATION = {
  /** 分类原因 */
  reason: (bookmarkId: number) => `/api/classification/${bookmarkId}/reason`,

  // =====================================================
  // 合并后的主要端点 (Phase 1.1)
  // =====================================================

  /** 分析统计（合并后主端点，支持 type 参数） */
  analytics: "/api/classification/analytics",
  /** 分析统计 - 概览 */
  analyticsOverview: "/api/classification/analytics?type=overview",
  /** 分析统计 - 偏好 */
  analyticsPreferences: "/api/classification/analytics?type=preferences",
  /** 分析统计 - 来源 */
  analyticsSources: "/api/classification/analytics?type=sources",
  /** 分析统计 - 健康 */
  analyticsHealth: "/api/classification/analytics?type=health",
  /** 分析统计 - 趋势 */
  analyticsTrends: "/api/classification/analytics?type=trends",
  /** 分析统计 - 周期统计（原 /statistics） */
  analyticsStatistics: "/api/classification/analytics?type=statistics",
  /** 分析统计 - 历史（原 /history） */
  analyticsHistory: "/api/classification/analytics?type=history",
  /** 分析统计 - A/B测试（原 /ab-test） */
  analyticsAbtest: "/api/classification/analytics?type=abtest",

  /** 调试信息（合并后主端点，支持 type 参数） */
  debug: "/api/classification/debug",
  /** 调试 - 健康检查 */
  debugHealth: "/api/classification/debug?type=health",
  /** 调试 - 集成测试（原 /test） */
  debugTest: "/api/classification/debug?type=test",
  /** 调试 - 追踪（原 /trace） */
  debugTrace: "/api/classification/debug?type=trace",

  /** 收件箱（合并后主端点，支持 type 参数） */
  inbox: "/api/classification/inbox",
  /** 收件箱 - 分析（默认） */
  inboxAnalyze: "/api/classification/inbox?type=analyze",
  /** 收件箱 - 聚类建议（原 /cluster-suggestions） */
  inboxSuggestions: "/api/classification/inbox?type=suggestions",
  /** 收件箱 - 聚类统计（原 /cluster-stats） */
  inboxStats: "/api/classification/inbox?type=stats",

  // =====================================================
  // 其他端点
  // =====================================================

  /** 执行分类 */
  classify: "/api/classification/classify",
  /** 聚类确认 */
  clusterConfirm: "/api/classification/cluster-confirm",
  /** 确认列表 */
  confirmations: "/api/classification/confirmations",
  /** 确认详情 */
  confirmationDetail: (id: string) => `/api/classification/confirmations/${id}`,
  /** 批量确认 */
  confirmationsBatch: "/api/classification/confirmations/batch",
  /** 反馈 */
  feedback: "/api/classification/feedback",
  /** 文件夹健康度 */
  folderHealth: "/api/classification/folder-health",
  /** 文件夹健康度摘要 */
  folderHealthSummary: "/api/classification/folder-health/summary",
  /** 文件夹画像列表 */
  foldersProfiles: "/api/classification/folders/profiles",
  /** 文件夹画像详情 */
  folderProfileDetail: (id: number) =>
    `/api/classification/folders/profiles/${id}`,
  /** 文件夹画像摘要 */
  folderProfilesSummary: "/api/classification/folders/profiles/summary",
  /** 兴趣画像 */
  interestProfile: "/api/classification/interest-profile",
  /** 兴趣分析 */
  interestProfileAnalyze: "/api/classification/interest-profile/analyze",
  /** 兴趣列表 */
  interests: "/api/classification/interests",
  /** 自定义兴趣 */
  interestsCustom: "/api/classification/interests/custom",
  /** 分类设置 */
  settings: "/api/classification/settings",
  /** 来源画像列表 */
  sourceProfiles: "/api/classification/source-profiles",
  /** 来源画像详情 */
  sourceProfileDetail: (id: string) =>
    `/api/classification/source-profiles/${id}`,
  /** 分类阶段 */
  stage: "/api/classification/stage",

  // =====================================================
  // 已废弃路径（保留用于向后兼容，通过 rewrite 重定向）
  // @deprecated 请使用合并后的端点
  // =====================================================

  /**
   * @deprecated 使用 analyticsAbtest 代替
   * 重定向到 /api/classification/analytics?type=abtest
   */
  abTest: "/api/classification/ab-test",
  /**
   * @deprecated 使用 inboxStats 代替
   * 重定向到 /api/classification/inbox?type=stats
   */
  clusterStats: "/api/classification/cluster-stats",
  /**
   * @deprecated 使用 inboxSuggestions 代替
   * 重定向到 /api/classification/inbox?type=suggestions
   */
  clusterSuggestions: "/api/classification/cluster-suggestions",
  /**
   * @deprecated 使用 analyticsHistory 代替
   * 重定向到 /api/classification/analytics?type=history
   */
  history: "/api/classification/history",
  /**
   * @deprecated 使用 analyticsStatistics 代替
   * 重定向到 /api/classification/analytics?type=statistics
   */
  statistics: "/api/classification/statistics",
  /**
   * @deprecated 使用 debugTest 代替
   * 重定向到 /api/classification/debug?type=test
   */
  test: "/api/classification/test",
  /**
   * @deprecated 使用 debugTrace 代替
   * 重定向到 /api/classification/debug?type=trace
   */
  trace: "/api/classification/trace",
} as const;

// ============================================
// 确认系统
// ============================================

export const API_CONFIRMATIONS = {
  /** 确认列表 */
  list: "/api/confirmations",
  /** 确认详情 */
  detail: (id: string) => `/api/confirmations/${id}`,
} as const;

// ============================================
// 文件夹管理
// ============================================

export const API_FOLDERS = {
  /** 文件夹列表/创建 */
  list: "/api/folders",
  /** 文件夹详情 */
  detail: (id: number) => `/api/folders/${id}`,
  /** 归档 */
  archive: (id: number) => `/api/folders/${id}/archive`,
  /** 文件夹书签 */
  bookmarks: (id: number) => `/api/folders/${id}/bookmarks`,
  /** 锁定 */
  lock: (id: number) => `/api/folders/${id}/lock`,
  /** 合并 */
  merge: (id: number) => `/api/folders/${id}/merge`,
  /** 批量移动组 */
  moveGroup: (id: number) => `/api/folders/${id}/move-group`,
  /** 批量创建 */
  batchCreate: "/api/folders/batch-create",
  /** 批量锁定状态 */
  batchLockStatus: "/api/folders/batch-lock-status",
  /** 文件夹关联 */
  connections: "/api/folders/connections",
  /** 修复嵌入 */
  fixEmbeddings: "/api/folders/fix-embeddings",
  /** 收件箱 */
  inbox: "/api/folders/inbox",
  /** 重排序 */
  reorder: "/api/folders/reorder",
  /** 建议 */
  suggestions: "/api/folders/suggestions",
} as const;

// ============================================
// 文件夹演化
// ============================================

export const API_FOLDER_EVOLUTION = {
  /** 确认合并 */
  confirmMerge: "/api/folder-evolution/confirm-merge",
  /** 确认拆分 */
  confirmSplit: "/api/folder-evolution/confirm-split",
  /** 演化历史 */
  history: "/api/folder-evolution/history",
  /** 合并建议 */
  mergeSuggestions: "/api/folder-evolution/merge-suggestions",
  /** 重命名 */
  rename: "/api/folder-evolution/rename",
  /** 报告 */
  reports: "/api/folder-evolution/reports",
  /** 快照详情 */
  snapshot: (id: string) => `/api/folder-evolution/snapshot/${id}`,
  /** 拆分建议 */
  splitSuggestions: "/api/folder-evolution/split-suggestions",
  /** 撤销 */
  undo: (id: string) => `/api/folder-evolution/undo/${id}`,
} as const;

// ============================================
// 知识链接
// ============================================

export const API_KNOWLEDGE_LINK = {
  /** 知识图谱 */
  graph: "/api/knowledge-link/graph",
  /** 图谱统计 */
  graphStats: "/api/knowledge-link/graph/stats",
  /** 相关内容 */
  related: (bookmarkId: number) => `/api/knowledge-link/related/${bookmarkId}`,
} as const;

// ============================================
// Markdown 收藏
// ============================================

export const API_MD_COLLECTIONS = {
  /** 列表 */
  list: "/api/md-collections",
  /** 详情 */
  detail: (id: string) => `/api/md-collections/${id}`,
  /** 处理 */
  process: (id: string) => `/api/md-collections/${id}/process`,
  /** 批量状态 */
  batchStatus: "/api/md-collections/batch-status",
  /** 重复检查 */
  checkDuplicate: "/api/md-collections/check-duplicate",
  /** 搜索 */
  search: "/api/md-collections/search",
  /** 上传 */
  upload: "/api/md-collections/upload",
} as const;

// ============================================
// 消息中心
// ============================================

export const API_MESSAGES = {
  /** 消息列表 */
  list: "/api/messages",
  /** 消息详情 */
  detail: (id: string) => `/api/messages/${id}`,
  /** 批量已读 */
  batchRead: "/api/messages/batch-read",
  /** 未读数量 */
  unreadCount: "/api/messages/unread-count",
} as const;

// ============================================
// 搜索
// ============================================

export const API_SEARCH = {
  /** 搜索 */
  search: "/api/search",
} as const;

// ============================================
// 设置
// ============================================

export const API_SETTINGS = {
  /** AI 文件夹设置 */
  aiFolder: "/api/settings/ai-folder",
  /** 通知设置 */
  notifications: "/api/settings/notifications",
  /** 用户资料 */
  profile: "/api/settings/profile",
  /** 信任模式 */
  trustMode: "/api/settings/trust-mode",
  /** 使用标签 */
  usageTags: "/api/settings/usage-tags",
} as const;

// ============================================
// 智能列表
// ============================================

export const API_SMART_LISTS = {
  /** 列表 */
  list: "/api/smart-lists",
  /** 详情 */
  detail: (id: string) => `/api/smart-lists/${id}`,
  /** 初始化预设 */
  initPresets: "/api/smart-lists/init-presets",
  /** 预览 */
  preview: "/api/smart-lists/preview",
  /** 重排序 */
  reorder: "/api/smart-lists/reorder",
} as const;

// ============================================
// 快照
// ============================================

export const API_SNAPSHOTS = {
  /** 列表 */
  list: "/api/snapshots",
  /** 详情 */
  detail: (id: string) => `/api/snapshots/${id}`,
  /** 内容 */
  content: (id: string) => `/api/snapshots/${id}/content`,
  /** 批量 */
  batch: "/api/snapshots/batch",
  /** 处理 */
  process: "/api/snapshots/process",
  /** 配额 */
  quota: "/api/snapshots/quota",
} as const;

// ============================================
// 摘要
// ============================================

export const API_SUMMARY = {
  /** 书签摘要 */
  byBookmark: (bookmarkId: number) => `/api/summary/${bookmarkId}`,
  /** 批量摘要 */
  batch: "/api/summary/batch",
  /** 摘要反馈 */
  feedback: "/api/summary/feedback",
  /** 生成摘要 */
  generate: "/api/summary/generate",
  /** 健康检查 */
  health: "/api/summary/health",
  /** 重新生成 */
  regenerate: "/api/summary/regenerate",
  /** 统计 */
  stats: "/api/summary/stats",
  /** 提供者统计 */
  statsProviders: "/api/summary/stats/providers",
} as const;

// ============================================
// 标签
// ============================================

export const API_TAGS = {
  /** 相关标签 */
  related: (tag: string) => `/api/tags/${encodeURIComponent(tag)}/related`,
  /** 标签图谱 */
  graph: "/api/tags/graph",
  /** 同义词 */
  synonyms: "/api/tags/synonyms",
} as const;

// ============================================
// 用户
// ============================================

export const API_USER = {
  /** 删除账号 */
  delete: "/api/user/delete",
  /** 导出数据 */
  export: "/api/user/export",
  /** 用户设置 */
  settings: "/api/user/settings",
  /** 摘要模式 */
  summaryMode: "/api/user/summary-mode",
  /** 信任模式 */
  trustMode: "/api/user/trust-mode",
  /** 信任模式统计 */
  trustModeStats: "/api/user/trust-mode/stats",
} as const;

// ============================================
// 微信文章
// ============================================

export const API_WECHAT_ARTICLE = {
  /** 详情 */
  detail: (id: string) => `/api/wechat-article/${id}`,
  /** 导出 */
  export: (id: string) => `/api/wechat-article/${id}/export`,
  /** 重新抓取 */
  refetch: (id: string) => `/api/wechat-article/${id}/refetch`,
  /** 创建 */
  create: "/api/wechat-article/create",
} as const;

// ============================================
// 其他 API
// ============================================

export const API_MISC = {
  /** 认证登录 */
  authLogin: "/api/auth/login",
  /** 向量迁移 */
  embeddingMigrate: "/api/embedding/migrate",
  /** 图片代理 */
  imageProxy: "/api/image-proxy",
  /** 初始化 */
  init: "/api/init",
  /** 图书馆分析 */
  librarianAnalysis: "/api/librarian/analysis",
  /** 图书馆巡检 */
  librarianPatrol: "/api/librarian/patrol",
  /** LLM 使用量 */
  llmUsage: "/api/llm-usage",
  /** 指标 */
  metrics: "/api/metrics",
  /** 重分类 */
  reclassify: "/api/reclassify",
  /** 重分类检查 */
  reclassifyCheck: "/api/reclassify/check",
  /** 重分类建议 */
  reclassifySuggestions: "/api/reclassify/suggestions",
  /** 分享目标 */
  shareTarget: "/api/share-target",
  /** 来源列表 */
  sources: "/api/sources",
  /** 清空回收站 */
  trashEmpty: "/api/trash/empty",
  /** 上传 */
  upload: "/api/upload",
} as const;

// ============================================
// 管理员 API
// ============================================

export const API_ADMIN = {
  /** 分类配置 */
  classificationConfig: "/api/admin/classification-config",
  /** 向量 A/B 测试 */
  embeddingAbTest: "/api/admin/embedding-ab-test",
} as const;

// ============================================
// 内部 API（Cron / Dev / Debug / Maintenance）
// ============================================

export const API_INTERNAL = {
  cron: {
    /** 分类优化 */
    classificationOptimize: "/api/internal/cron/classification-optimize",
    /** 清理快照 */
    cleanupSnapshots: "/api/internal/cron/cleanup-snapshots",
    /** 生成月度报告 */
    generateMonthlyReports: "/api/internal/cron/generate-monthly-reports",
    /** 多向量迁移 */
    multiVectorMigration: "/api/internal/cron/multi-vector-migration",
    /** 处理作业队列 */
    processJobQueue: "/api/internal/cron/process-job-queue",
    /** 画像更新 */
    profileUpdates: "/api/internal/cron/profile-updates",
    /** 智能排序 */
    smartSorting: "/api/internal/cron/smart-sorting",
    /** 更新文件夹画像 */
    updateFolderProfiles: "/api/internal/cron/update-folder-profiles",
  },
  debug: {
    /** AI 摘要调试 */
    aiSummary: "/api/internal/debug/ai-summary",
  },
  dev: {
    /** 处理快照 */
    processSnapshots: "/api/internal/dev/process-snapshots",
    /** 重处理快照 */
    reprocessSnapshot: "/api/internal/dev/reprocess-snapshot",
    /** 快照调试 */
    snapshotsDebug: "/api/internal/dev/snapshots-debug",
    /** 测试微信解析 */
    testWechatParse: "/api/internal/dev/test-wechat-parse",
  },
  maintenance: {
    /** 维护检查 */
    check: "/api/internal/maintenance/check",
    /** 触发维护 */
    trigger: "/api/internal/maintenance/trigger",
  },
} as const;

// ============================================
// 学习系统
// ============================================

export const API_LEARNING = {
  /** 负反馈 */
  negative: "/api/learning/negative",
} as const;

// ============================================
// 统一导出
// ============================================

/**
 * 所有 API 路径
 */
export const API_PATHS = {
  agent: API_AGENT,
  ai: API_AI,
  admin: API_ADMIN,
  bookmarks: API_BOOKMARKS,
  browserBookmark: API_BROWSER_BOOKMARK,
  classification: API_CLASSIFICATION,
  confirmations: API_CONFIRMATIONS,
  folders: API_FOLDERS,
  folderEvolution: API_FOLDER_EVOLUTION,
  internal: API_INTERNAL,
  knowledgeLink: API_KNOWLEDGE_LINK,
  learning: API_LEARNING,
  mdCollections: API_MD_COLLECTIONS,
  messages: API_MESSAGES,
  misc: API_MISC,
  search: API_SEARCH,
  settings: API_SETTINGS,
  smartLists: API_SMART_LISTS,
  snapshots: API_SNAPSHOTS,
  summary: API_SUMMARY,
  tags: API_TAGS,
  user: API_USER,
  wechatArticle: API_WECHAT_ARTICLE,
} as const;

export default API_PATHS;
