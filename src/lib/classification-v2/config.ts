/**
 * Classification V2 - 统一配置
 *
 * 所有阈值、权重、模型参数集中于此。
 * 调参 = 改这一个文件。
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

// ============================================================================
// 主配置
// ============================================================================

export const CLASSIFICATION_CONFIG = {
  // --- 分层提前终止阈值 ---
  earlyExit: {
    /** instant tier 后：规则/标签高置信度命中时提前终止 */
    afterInstant: 0.9,
    /** fast tier 后：向量+历史融合足够时提前终止 */
    afterFast: 0.75,
  },

  // --- 最终行动阈值 ---
  action: {
    /** 高于此值 → action: 'classify'（自动分类） */
    autoClassify: 0.85,
    /** 高于此值 → action: 'suggest'（生成建议） */
    suggest: 0.6,
    // 低于 suggest → action: 'inbox'（待整理）
  },

  // --- Scorer 默认权重 ---
  scorerWeights: {
    rule: 0.15,
    aiTag: 0.15,
    vector: 0.35,
    history: 0.15,
    llm: 0.2,
  } as Record<string, number>,

  // --- 向量搜索 ---
  vector: {
    /** 向量维度 */
    dimension: 1024,
    /** 搜索返回上限 */
    searchLimit: 10,
    /** 最低相似度阈值 */
    similarityThreshold: 0.3,
    /** 内容向量权重（与行为向量相对） */
    contentWeight: 0.7,
    /** 行为向量权重 */
    behaviorWeight: 0.3,
    /** 候选文件夹聚合：最少几条相似书签才有效 */
    minMatchesForHighConfidence: 3,
  },

  // --- AI 标签匹配置信度 ---
  aiTag: {
    /** 精确匹配（标准化后完全相同） */
    exactMatch: 0.98,
    /** 别名匹配 */
    aliasMatch: 0.95,
    /** 部分匹配（子串关系） */
    partialMatch: 0.6,
    /** 核心标签匹配（前 5 标签，≥2 命中） */
    coreTagMatch: 0.92,
    /** 核心标签匹配（1 命中） */
    coreTagSingle: 0.87,
    /** 相关标签匹配（≥3 命中） */
    relatedTagMatch: 0.85,
    /** 部分匹配最小标签长度 */
    minTagLength: 3,
    /** 部分匹配最小长度比 */
    minLengthRatio: 0.5,
  },

  // --- 历史匹配 ---
  history: {
    /** 查询最近多少条分类记录 */
    lookbackCount: 50,
    /** 最小匹配次数才产生有效分数 */
    minMatchCount: 2,
  },

  // --- LLM 调用 ---
  llm: {
    /** 快速模型（T0 级别） */
    model: "deepseek-chat",
    /** 深度模型（T1 级别，当前合并到同一次调用） */
    deepModel: "deepseek-chat",
    /** LLM 一次考虑的最大候选文件夹数 */
    maxCandidates: 10,
    /** 输入截断：标题 */
    titleMaxLen: 200,
    /** 输入截断：摘要 */
    summaryMaxLen: 300,
    /** 输入截断：标签数量 */
    maxTags: 10,
    /** 温度 */
    temperature: 0.3,
    /** 最大 token 数 */
    maxTokens: 200,
    /** 超时 (ms) */
    timeoutMs: 30_000,
    /** 重试次数 */
    maxRetries: 2,
    /** 初始重试延迟 (ms) */
    retryDelayMs: 1_000,
  },

  // --- 文件夹命名 ---
  folderNaming: {
    /** 最佳长度：2-4 个中文字 */
    optimalLength: { min: 2, max: 4 },
    /** 最大长度 */
    maxLength: 8,
    /** 近期文件夹查重窗口 (ms) */
    recentWindowMs: 24 * 60 * 60 * 1000,
    /** 近期文件夹最大数量（注入 prompt） */
    recentLimit: 8,
    /** 近期文件夹名称相似度阈值 */
    recentNameSimilarity: 0.65,
    /** 近期文件夹语义相似度阈值 */
    recentSemanticSimilarity: 0.72,
  },

  // --- 批量分类 ---
  batch: {
    /** 并发数 */
    concurrency: 5,
    /** 每块大小 */
    chunkSize: 20,
  },

  // --- 缓存 ---
  cache: {
    /** 缓存过期时间 (ms) */
    ttlMs: 5 * 60 * 1000,
    /** 最大缓存条目 */
    maxEntries: 500,
  },

  // --- 用户生命周期 ---
  userLifecycle: {
    /** 冷启动阶段上限（书签数） */
    coldStartMax: 20,
    /** 成长阶段上限 */
    growingMax: 100,
  },

  // --- 文件夹限制 ---
  folder: {
    /** 最大文件夹数 */
    maxFolders: 16,
    /** 每日最大自动创建数 */
    maxAutoCreatePerDay: 8,
  },

  // --- 收件箱整理 ---
  inboxOrganize: {
    /** 触发整理的收件箱数量 */
    countThreshold: 10,
    /** 最小聚类大小 */
    minClusterSize: 5,
    /** 聚类相似度阈值 */
    clusterSimilarity: 0.7,
    /** 匹配现有文件夹的最低相似度 */
    folderMatchThreshold: 0.6,
  },

  // --- 排序 ---
  ranker: {
    /** 返回 Top-K 候选 */
    topK: 3,
  },

  // --- 反馈学习 ---
  feedback: {
    /** 权重调整学习率 */
    learningRate: 0.05,
    /** 最小权重（防止某个 Scorer 被完全忽略） */
    minWeight: 0.05,
    /** 最大权重 */
    maxWeight: 0.6,
  },
} as const;

// ============================================================================
// 分类状态（与数据库字段对齐）
// ============================================================================

export const CLASSIFICATION_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  CLASSIFIED: "classified",
  SUGGESTED: "suggested",
  INBOX: "inbox",
  FAILED: "failed",
} as const;

export type ClassificationStatus =
  (typeof CLASSIFICATION_STATUS)[keyof typeof CLASSIFICATION_STATUS];
