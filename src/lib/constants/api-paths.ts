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
 * ## 版本状态定义
 *
 * 每个路径的生命周期状态：
 *
 * | 状态         | 含义                                           | 新代码可用 |
 * |-------------|-----------------------------------------------|-----------|
 * | active      | 推荐使用，持续维护                              | ✅ 是     |
 * | legacy-only | 旧版独有功能，v1 暂未实现，保留使用              | ✅ 是     |
 * | deprecated  | 已有 v1/v2 替代，不应在新代码中使用              | ❌ 否     |
 * | redirect    | 已 308 重定向到新版，仅为兼容保留                | ❌ 否     |
 *
 * ## 书签 API 迁移指引
 *
 * - CRUD 操作：使用 `list`/`detail`/`batchDelete` 等（v1 路径，active）
 * - 专属功能：使用 `permanent`/`embeddings`/`fetchContent` 等（legacy-only，v1 暂未实现）
 * - legacy* 前缀路径：deprecated，请勿在新代码中使用
 *
 * ## 分类 API 迁移指引
 *
 * - 分类执行与规则：v2 为当前标准（active）
 * - v5 独占端点（entropy/shadow/metrics/rollout/t1-*）：独立功能模块，非旧版本，active
 * - v5 共有端点（classify/batch/feedback/rules）：已 308 重定向到 v2（redirect）
 *
 * @version 1.1.0
 * @since 2025-12-24
 * @updated 2026-03-07
 */

// ============================================
// Agent / AI 相关
// ============================================

export const API_AGENT = {
  /** 统一 AI 入口（推荐） */
  unified: "/api/agent/unified",
  /** 意图分析 */
  analysis: "/api/agent/analysis",
  /** 每日简报 */
  briefing: "/api/agent/briefing",
  /** 取消请求 */
  cancel: "/api/agent/cancel",
  /** 上下文信息 */
  context: "/api/agent/context",
  /** 纠正记录 */
  corrections: "/api/agent/corrections",
  /** 用户反馈 */
  feedback: "/api/agent/feedback",
  /** 意图纠正 */
  intentCorrection: "/api/agent/intent-correction",
  /** 重新生成 */
  regenerate: "/api/agent/regenerate",
  /** 规则列表 */
  rules: "/api/agent/rules",
  /** 会话管理 */
  session: "/api/agent/session",
  /** 使用统计 */
  stats: "/api/agent/stats",
  /** 撤销操作 */
  undo: "/api/agent/undo",
} as const;

export const API_AI = {
  /** AI 提供者列表 */
  providers: "/api/ai/providers",
  /** 快速操作 */
  quickActions: "/api/ai/quick-actions",
  /** 图像分析 */
  visionAnalyze: "/api/ai/vision-analyze",
  /** AI 反馈 */
  feedback: "/api/ai/feedback",
  /** AI 笔记 */
  notes: "/api/ai/notes",
  /** 学习纠正 */
  learningCorrection: "/api/ai/learning/correction",
} as const;

// ============================================
// TTS 语音服务
// ============================================

export const API_TTS = {
  /** 语音合成 */
  synthesize: "/api/tts",
} as const;

// ============================================
// 数据统计
// ============================================

export const API_ANALYTICS = {
  /** 统计数据 */
  stats: "/api/analytics/stats",
} as const;

// ============================================
// 书签管理 (v1 API 优先，旧版 API 保留用于独有功能)
// ============================================

export const API_BOOKMARKS = {
  // =====================================================
  // v1 API 路径（推荐使用，已被 hooks 调用）
  // =====================================================

  /** 书签列表/创建 (v1) */
  list: "/api/v1/bookmarks",
  /** 书签详情/更新/删除 (v1) */
  detail: (id: number) => `/api/v1/bookmarks/${id}`,
  /** 书签统计 (v1) */
  stats: "/api/v1/bookmarks/stats",
  /** 书签标签列表 (v1) */
  tags: "/api/v1/bookmarks/tags",
  /** 批量删除 (v1) */
  batchDelete: "/api/v1/bookmarks/batch/delete",
  /** 批量移动 (v1) */
  batchMove: "/api/v1/bookmarks/batch/move",
  /** 批量恢复 (v1) */
  batchRestore: "/api/v1/bookmarks/batch/restore",
  /** 批量标签 (v1) */
  batchTags: "/api/v1/bookmarks/batch/tags",

  // =====================================================
  // 旧版独有功能（legacy-only）
  // v1 暂未实现这些能力，保留使用，新代码可正常调用
  // =====================================================

  /** 永久删除（legacy-only: v1 未实现） */
  permanent: (id: number) => `/api/bookmarks/${id}/permanent`,
  /** 相关书签（legacy-only: v1 未实现） */
  related: (id: number) => `/api/bookmarks/${id}/related`,
  /** 单个书签恢复（legacy-only: 批量恢复使用 v1） */
  restoreSingle: (id: number) => `/api/bookmarks/${id}/restore`,
  /** 批量导入（legacy-only: v1 未实现） */
  batchImport: "/api/bookmarks/batch-import",
  /** 批量状态查询（legacy-only: v1 未实现） */
  batchStatus: "/api/bookmarks/batch-status",
  /** 向量嵌入（legacy-only: v1 未实现） */
  embeddings: "/api/bookmarks/embeddings",
  /** 抓取内容（legacy-only: v1 未实现） */
  fetchContent: "/api/bookmarks/fetch-content",
  /** 生成标签（legacy-only: v1 未实现） */
  generateTags: "/api/bookmarks/generate-tags",
  /** 元数据（legacy-only: v1 未实现） */
  metadata: "/api/bookmarks/metadata",
  /** 建议（legacy-only: v1 未实现） */
  suggestions: "/api/bookmarks/suggestions",
  /** 验证（legacy-only: v1 未实现） */
  validate: "/api/bookmarks/validate",

  // =====================================================
  // 废弃路径（保留用于向后兼容，不应在新代码中使用）
  // @deprecated
  // =====================================================

  /**
   * @deprecated 使用 list 代替
   * 旧版书签列表路径
   */
  legacyList: "/api/bookmarks",
  /**
   * @deprecated 使用 detail 代替
   * 旧版书签详情路径
   */
  legacyDetail: (id: number) => `/api/bookmarks/${id}`,
  /**
   * @deprecated 使用 batchDelete 代替
   * 旧版批量删除路径
   */
  legacyBatchDelete: "/api/bookmarks/batch-delete",
  /**
   * @deprecated 使用 batchMove 代替
   * 旧版批量移动路径
   */
  legacyBatchMove: "/api/bookmarks/batch-move",
  /**
   * @deprecated 使用 batchRestore 代替
   * 旧版批量恢复路径
   */
  legacyBatchRestore: "/api/bookmarks/batch-restore",
  /**
   * @deprecated 使用 batchTags 代替
   * 旧版批量标签路径
   */
  legacyBatchTags: "/api/bookmarks/batch-tags",
} as const;

// ============================================
// 批量分类
// ============================================

export const API_BATCH_CLASSIFICATION = {
  /** 启动批量分类 */
  start: "/api/batch-classification/start",
  /** 分类结果 */
  results: (batchId: string) => `/api/batch-classification/${batchId}/results`,
  /** 分类进度 */
  progress: (batchId: string) =>
    `/api/batch-classification/${batchId}/progress`,
  /** 确认分类 */
  confirm: (batchId: string) => `/api/batch-classification/${batchId}/confirm`,
  /** 撤销分类 */
  undo: (batchId: string) => `/api/batch-classification/${batchId}/undo`,
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

  /** 执行分类（redirect: v5 → 308 → v2） */
  classify: "/api/classification/v5/classify",
  /** 执行分类 - 旧版（redirect: → 308 → v2） */
  classifyLegacy: "/api/classification/classify",
  /**
   * @deprecated 使用 inbox POST/DELETE 代替
   * POST /api/classification/inbox - 应用建议
   * DELETE /api/classification/inbox - 拒绝建议
   */
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
  /** 文件夹画像列表 */
  foldersProfiles: "/api/classification/folders/profiles",
  /** 文件夹画像详情 */
  folderProfileDetail: (id: number) =>
    `/api/classification/folders/profiles/${id}`,
  /** 兴趣画像 */
  interestProfile: "/api/classification/interest-profile",
  /** 兴趣列表 */
  interests: "/api/classification/interests",
  /** 分类设置 */
  settings: "/api/classification/settings",
  /** 来源画像列表 */
  sourceProfiles: "/api/classification/source-profiles",
  /** 分类阶段 */
  stage: "/api/classification/stage",

  // =====================================================
  // v5 独占端点（独立功能模块，active）
  // =====================================================

  /** 熵分析 */
  entropyAnalysis: "/api/classification/v5/entropy/analysis",
  /** 分类指标 */
  metrics: "/api/classification/v5/metrics",
  /** 影子收件箱 */
  shadowInbox: "/api/classification/v5/shadow/inbox",
  /** 影子确认 */
  shadowConfirm: "/api/classification/v5/shadow/confirm",
  /** 影子拒绝 */
  shadowReject: "/api/classification/v5/shadow/reject",

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
// 对话管理
// ============================================

export const API_CONVERSATIONS = {
  /** 对话列表/创建 */
  list: "/api/conversations",
  /** 对话详情/删除 */
  detail: (id: string) => `/api/conversations/${id}`,
  /** 对话消息列表 */
  messages: (id: string) => `/api/conversations/${id}/messages`,
} as const;

// ============================================
// 文件夹分类
// ============================================

export const API_FOLDER_CATEGORIES = {
  /** 分类列表/创建 */
  list: "/api/folder-categories",
  /** 分类详情/更新/删除 */
  detail: (id: number) => `/api/folder-categories/${id}`,
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
  /** 文件夹统计（含最近书签） */
  withStats: "/api/folders/with-stats",
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
  // [已移除] graph - 知识图谱精简重构 2026-01-29
  // [已移除] graphStats - 知识图谱精简重构 2026-01-29
  /** 相关内容 */
  related: (bookmarkId: number) => `/api/knowledge-link/related/${bookmarkId}`,
} as const;

// ============================================
// 知识工坊
// ============================================

export const API_KNOWLEDGE_STUDIO = {
  // =====================================================
  // v1 端点
  // =====================================================

  /** 生成报告 (v1) */
  generate: "/api/knowledge-studio/generate",
  /** 报告列表 */
  reports: "/api/knowledge-studio/reports",
  /** 报告编辑 */
  reportEdit: (id: string) => `/api/knowledge-studio/reports/${id}/edit`,
  /** 配额查询 */
  quota: "/api/knowledge-studio/quota",
  /** 素材管理 */
  materials: "/api/knowledge-studio/materials",
  /** 使用分析 */
  analytics: "/api/knowledge-studio/analytics",

  // =====================================================
  // v2 端点
  // =====================================================

  /** 浓缩提炼 (v2) */
  v2Condense: "/api/knowledge-studio/v2/condense",
  /** 生成报告 (v2) */
  v2Generate: "/api/knowledge-studio/v2/generate",
  /** 迭代优化 (v2) */
  v2Iterate: "/api/knowledge-studio/v2/iterate",
  /** 大纲生成 (v2) */
  v2Outline: "/api/knowledge-studio/v2/outline",
  /** 语音合成 (v2) */
  v2Tts: "/api/knowledge-studio/v2/tts",
  /** 风格适配 (v2) */
  v2AdaptStyle: "/api/knowledge-studio/v2/adapt-style",
  /** 使用量记录 (v2) */
  v2UsageRecord: "/api/knowledge-studio/v2/usage/record",
  /** 蓝图列表 (v2) */
  v2Blueprints: "/api/knowledge-studio/v2/blueprints",
  /** 蓝图推荐 (v2) */
  v2RecommendBlueprints: "/api/knowledge-studio/v2/recommendations/blueprints",
  /** 素材推荐 (v2) */
  v2RecommendMaterials: "/api/knowledge-studio/v2/recommendations/materials",

  // =====================================================
  // 账单
  // =====================================================

  /** 账单列表 */
  billingBills: "/api/knowledge-studio/billing/bills",
  /** 用量统计 */
  billingUsage: "/api/knowledge-studio/billing/usage",
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
// 通知中心（V2 重构后）
// ============================================

export const API_NOTIFICATIONS = {
  /** 通知列表（直接查询 Supabase） */
  list: "/api/notifications",
  /** 通知详情 */
  detail: (id: string) => `/api/notifications/${id}`,
  /** 批量已读 */
  batchRead: "/api/notifications/batch-read",
  /** 未读数量 */
  unreadCount: "/api/notifications/unread-count",
} as const;

/**
 * @deprecated 使用 API_NOTIFICATIONS 代替
 * 旧消息 API 路径（保留用于向后兼容）
 */
export const API_MESSAGES = {
  /** @deprecated 使用 API_NOTIFICATIONS.list */
  list: "/api/notifications",
  /** @deprecated 使用 API_NOTIFICATIONS.detail */
  detail: (id: string) => `/api/notifications/${id}`,
  /** @deprecated 使用 API_NOTIFICATIONS.batchRead */
  batchRead: "/api/notifications/batch-read",
  /** @deprecated 使用 API_NOTIFICATIONS.unreadCount */
  unreadCount: "/api/notifications/unread-count",
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
// 主题合成
// ============================================

export const API_SYNTHESIS = {
  /** 合成列表/创建 */
  list: "/api/synthesis",
  /** 合成详情 */
  detail: (id: string) => `/api/synthesis/${id}`,
  /** 生成合成 */
  generate: "/api/synthesis/generate",
  /** 预览 */
  preview: "/api/synthesis/preview",
  /** 问答 */
  qa: "/api/synthesis/qa",
  /** 取消生成 */
  cancel: (id: string) => `/api/synthesis/${id}/cancel`,
  /** 导出 */
  export: (id: string) => `/api/synthesis/${id}/export`,
  /** 高亮列表 */
  highlights: (id: string) => `/api/synthesis/${id}/highlights`,
  /** 高亮详情 */
  highlightDetail: (id: string, highlightId: string) =>
    `/api/synthesis/${id}/highlights/${highlightId}`,
  /** 重新生成 */
  regenerate: (id: string) => `/api/synthesis/${id}/regenerate`,

  // =====================================================
  // 推荐
  // =====================================================

  /** 推荐列表 */
  recommend: "/api/synthesis/recommend",
  /** 推荐已展示 */
  recommendShown: "/api/synthesis/recommend/shown",
  /** 忽略推荐 */
  recommendDismiss: "/api/synthesis/recommend/dismiss",
  /** 推荐偏好 */
  recommendPreferences: "/api/synthesis/recommend/preferences",
} as const;

// ============================================
// 标签
// ============================================

export const API_TAGS = {
  /** 标签列表 */
  list: "/api/tags",
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
  /** 引导设置 */
  onboarding: "/api/user/onboarding",
  /** AI 人设 */
  persona: "/api/user/persona",
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
  analytics: API_ANALYTICS,
  batchClassification: API_BATCH_CLASSIFICATION,
  bookmarks: API_BOOKMARKS,
  browserBookmark: API_BROWSER_BOOKMARK,
  classification: API_CLASSIFICATION,
  confirmations: API_CONFIRMATIONS,
  conversations: API_CONVERSATIONS,
  folderCategories: API_FOLDER_CATEGORIES,
  folders: API_FOLDERS,
  folderEvolution: API_FOLDER_EVOLUTION,
  internal: API_INTERNAL,
  knowledgeLink: API_KNOWLEDGE_LINK,
  knowledgeStudio: API_KNOWLEDGE_STUDIO,
  learning: API_LEARNING,
  mdCollections: API_MD_COLLECTIONS,
  messages: API_MESSAGES,
  notifications: API_NOTIFICATIONS,
  misc: API_MISC,
  search: API_SEARCH,
  settings: API_SETTINGS,
  smartLists: API_SMART_LISTS,
  snapshots: API_SNAPSHOTS,
  summary: API_SUMMARY,
  synthesis: API_SYNTHESIS,
  tags: API_TAGS,
  tts: API_TTS,
  user: API_USER,
  wechatArticle: API_WECHAT_ARTICLE,
} as const;

export default API_PATHS;
