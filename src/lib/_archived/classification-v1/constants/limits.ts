/**
 * Classification system limits and thresholds
 */

/**
 * Classification weight configuration
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
 * Classification thresholds
 * V3.4 修正：调整阈值为正确值
 * - ≥80%: 自动归类（高置信度）
 * - 60-79%: 保存建议（中等置信度，需用户确认）
 * - <60%: 放入待整理（低置信度）
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
 * Folder limits
 */
export const FOLDER_LIMITS = {
  /** Maximum folders per user */
  MAX_FOLDERS: 16,
  /** Maximum auto-created folders per day */
  MAX_AUTO_CREATE_PER_DAY: 8,
  /** Initial folder creation minimum */
  INITIAL_MIN: 3,
  /** Initial folder creation maximum */
  INITIAL_MAX: 7,
  /** Merge suggestion similarity threshold (80%) */
  MERGE_SIMILARITY_THRESHOLD: 0.8,
  /** Split suggestion size threshold (bookmarks count) */
  SPLIT_SIZE_THRESHOLD: 100,
  /** Split suggestion diversity threshold - below this is too diverse */
  SPLIT_DIVERSITY_THRESHOLD: 0.5,
  /** Maximum merge suggestions to return */
  MAX_MERGE_SUGGESTIONS: 5,
  /** Maximum split suggestions to return */
  MAX_SPLIT_SUGGESTIONS: 3,
} as const;

/**
 * 近期文件夹防重复创建配置
 *
 * 用户短时间内收藏同主题内容时，避免因名称表述不同而创建多个文件夹。
 * 对"近期"创建的文件夹使用比全局更宽松的相似度阈值。
 */
export const RECENT_FOLDER_DEDUP = {
  /**
   * 近期文件夹时间窗口（小时）
   * 在此窗口内创建的文件夹，视为"近期"，使用更宽松的相似度阈值
   */
  WINDOW_HOURS: 24,
  /**
   * 近期文件夹名称相似度阈值
   * 低于全局 0.8，对「一人公司」「个人创业」等字面略有差异的名称也能触发合并
   */
  NAME_SIMILARITY_THRESHOLD: 0.65,
  /**
   * 近期文件夹语义相似度阈值（余弦相似度，用于 embedding 比对）
   * 当 name_embedding 可用时启用；否则降级到名称相似度
   */
  SEMANTIC_SIMILARITY_THRESHOLD: 0.72,
  /**
   * 近期文件夹注入 AI Prompt 的最大数量
   * 避免 Prompt 过长
   */
  MAX_PROMPT_FOLDERS: 8,
} as const;

/**
 * Inbox organization triggers
 */
export const INBOX_ORGANIZE_TRIGGERS = {
  /** Trigger when inbox reaches this count */
  COUNT_THRESHOLD: 10,
  /** Trigger after this many days since last organize */
  DAYS_SINCE_LAST_ORGANIZE: 7,
  /** Minimum cluster size for suggestion */
  MIN_CLUSTER_SIZE: 5,
  /** Cluster similarity threshold (70%) */
  CLUSTER_SIMILARITY: 0.7,
  /** Minimum similarity to match existing folder */
  FOLDER_MATCH_THRESHOLD: 0.6,
} as const;

/**
 * Custom interest limits
 */
export const CUSTOM_INTEREST_LIMITS = {
  /** Maximum custom interests per user */
  MAX_CUSTOM_INTERESTS: 5,
  /** Maximum name length */
  MAX_NAME_LENGTH: 20,
  /** Maximum keywords per interest */
  MAX_KEYWORDS: 10,
  /** Maximum suggested folders per interest */
  MAX_SUGGESTED_FOLDERS: 3,
} as const;

/**
 * User lifecycle thresholds
 */
export const USER_LIFECYCLE_THRESHOLDS = {
  /** Threshold for cold start phase (0-20 bookmarks) */
  COLD_START_MAX: 20,
  /** Threshold for growing phase (21-100 bookmarks) */
  GROWING_MAX: 100,
} as const;

/**
 * Profile update schedule
 */
export const PROFILE_UPDATE_SCHEDULE = {
  /** Folder profile update interval (daily) */
  FOLDER_PROFILE_UPDATE_HOURS: 24,
  /** Health check interval (weekly) */
  HEALTH_CHECK_DAYS: 7,
  /** Suggestion expiry days */
  SUGGESTION_EXPIRY_DAYS: 7,
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

/**
 * V4.2.5: AI 服务配置常量
 */
export const AI_SERVICE_CONFIG = {
  /** DeepSeek API 超时 (毫秒) */
  DEEPSEEK_TIMEOUT_MS: 30000,
  /** 最大重试次数 */
  MAX_RETRIES: 2,
  /** 初始重试延迟 (毫秒) */
  RETRY_DELAY_MS: 1000,
  /** 重试延迟倍数 */
  RETRY_MULTIPLIER: 2,
  /** 最大重试延迟 (毫秒) */
  MAX_RETRY_DELAY_MS: 5000,
  /** 温度参数（输出稳定性）*/
  TEMPERATURE: 0.3,
  /** 最大 token 数 */
  MAX_TOKENS: 200,
} as const;
