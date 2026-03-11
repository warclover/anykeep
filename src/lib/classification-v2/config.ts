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

// ============================================================================
// V1 兼容常量（供 UI 展示使用）
// ============================================================================

/**
 * Classification weight configuration (V1 格式)
 *
 * 用于配置历史页面展示。
 * V2 系统内部使用 CLASSIFICATION_CONFIG.scorerWeights。
 */
export const CLASSIFICATION_WEIGHTS = {
  /** Vector matching weight (40%) */
  VECTOR: 0.4,
  /** History matching weight (30%) */
  HISTORY: 0.3,
  /** AI recommendation weight (30%) */
  AI: 0.3,
} as const;

/**
 * Classification thresholds (V1 格式)
 *
 * 用于配置历史页面展示。
 * V2 系统内部使用 CLASSIFICATION_CONFIG.action。
 */
export const CLASSIFICATION_THRESHOLDS = {
  /** Low confidence threshold - below this goes to inbox */
  LOW_CONFIDENCE: 60,
  /** Medium confidence threshold - save as suggestion for user review */
  MEDIUM_CONFIDENCE: 60,
  /** High confidence threshold - above this is auto-classified */
  HIGH_CONFIDENCE: 80,
  /** Vector similarity threshold for folder matching */
  VECTOR_SIMILARITY: 0.5,
  /** History matching count */
  HISTORY_MATCH_COUNT: 10,
} as const;

/**
 * V4.2.5: Matcher strategy constants
 * 集中管理各匹配器的配置参数
 */
export const MATCHER_STRATEGY_CONFIG = {
  /** k-NN 直接匹配器 */
  KNN_DIRECT: {
    /** 相似度阈值 (0-1)，高于此值直接采用 */
    SIMILARITY_THRESHOLD: 0.9,
    /** 最大返回结果数 */
    MAX_RESULTS: 5,
    /** 候选书签数量限制 */
    CANDIDATE_LIMIT: 20,
  },
  /** 通用分类匹配器 */
  UNIVERSAL: {
    /** 最小匹配分数 (0-100) */
    MIN_MATCH_SCORE: 50,
    /** 匹配器权重 (0-1) */
    WEIGHT: 0.2,
    /** 分数累加衰减系数 */
    SCORE_DECAY: 0.3,
    /** 模糊匹配分数衰减 */
    FUZZY_SCORE_DECAY: 0.9,
  },
  /** 标签匹配器 */
  TAG: {
    /** 最小匹配分数 (0-100) */
    MIN_MATCH_SCORE: 50,
    /** 匹配器权重 (0-1) */
    WEIGHT: 0.3,
    /** 最大比较书签数 */
    MAX_BOOKMARKS_TO_COMPARE: 50,
    /** 书签数量奖励上限 */
    BOOKMARK_BONUS_CAP: 0.2,
    /** 每个书签奖励系数 */
    BOOKMARK_BONUS_RATE: 0.05,
  },
  /** 指纹匹配器 */
  FINGERPRINT: {
    /** 最小匹配分数 (0-100) */
    MIN_MATCH_SCORE: 40,
    /** 匹配器权重 (0-1) */
    WEIGHT: 0.25,
    /** 缓存时间 (毫秒) */
    CACHE_TIME_MS: 5 * 60 * 1000,
    /** 最大缓存用户数 */
    MAX_CACHE_USERS: 100,
    /** 查询书签限制 */
    QUERY_LIMIT: 100,
    /** 部分匹配权重衰减 */
    PARTIAL_MATCH_DECAY: 0.7,
    /** 匹配率权重 */
    MATCH_RATIO_WEIGHT: 0.6,
    /** 权重率权重 */
    WEIGHT_RATIO_WEIGHT: 0.4,
  },
  /** 查询扩展匹配器 */
  QUERY_EXPANSION: {
    /** 最小匹配分数 (0-100) */
    MIN_MATCH_SCORE: 40,
    /** 匹配器权重 (0-1) */
    WEIGHT: 0.25,
    /** 最大扩展关键词数 */
    MAX_EXPANDED_KEYWORDS: 10,
    /** 向量召回权重 */
    VECTOR_WEIGHT: 0.4,
    /** 关键词召回权重 */
    KEYWORD_WEIGHT: 0.35,
    /** 标签召回权重 */
    TAG_WEIGHT: 0.25,
    /** 相似度阈值 */
    SIMILARITY_THRESHOLD: 0.5,
  },
} as const;
