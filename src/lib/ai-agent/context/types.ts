/**
 * 动态上下文类型定义
 *
 * 为 AI Agent 提供每次对话的动态上下文数据
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

// =============================================================================
// 时间上下文
// =============================================================================

/**
 * 时间段类型
 */
export type TimePeriod = "morning" | "afternoon" | "evening" | "night";

/**
 * 时间上下文
 */
export interface TimeContext {
  /** 格式化的当前时间，如 "2025-12-26 周四 14:30" */
  current: string;
  /** 时间段 */
  period: TimePeriod;
  /** 是否周末 */
  isWeekend: boolean;
}

// =============================================================================
// 统计数据上下文
// =============================================================================

/**
 * 平台统计
 */
export interface PlatformStats {
  /** 平台名称（中文） */
  name: string;
  /** 平台代码 */
  code: string;
  /** 收藏数量 */
  count: number;
}

/**
 * 文件夹统计
 */
export interface FolderStats {
  /** 文件夹名称 */
  name: string;
  /** 文件夹 ID */
  id: number;
  /** 书签数量 */
  count: number;
}

/**
 * 用户数据统计
 */
export interface StatsContext {
  /** 总收藏数 */
  totalBookmarks: number;
  /** 最近 7 天新增数 */
  recentWeekCount: number;
  /** 最常用平台 */
  topPlatform: PlatformStats;
  /** 常用文件夹 Top 3 */
  topFolders: FolderStats[];
}

// =============================================================================
// 用户偏好上下文
// =============================================================================

/**
 * 响应风格类型
 */
export type ResponseStyle = "concise" | "detailed" | "auto";

/**
 * 用户偏好
 */
export interface PreferencesContext {
  /** 响应风格 */
  responseStyle: ResponseStyle;
  /** 常用标签 Top 5 */
  frequentTags: string[];
}

// =============================================================================
// 最近活动上下文
// =============================================================================

/**
 * 最近保存的书签
 */
export interface LastSavedBookmark {
  /** 标题 */
  title: string;
  /** 平台（中文） */
  platform: string;
  /** 相对时间，如 "2小时前" */
  time: string;
}

/**
 * 最近搜索
 */
export interface LastSearch {
  /** 搜索关键词 */
  query: string;
  /** 相对时间 */
  time: string;
}

/**
 * 最近活动上下文
 */
export interface RecentActivityContext {
  /** 最近保存的书签 */
  lastSaved?: LastSavedBookmark;
  /** 最近搜索 */
  lastSearch?: LastSearch;
}

// =============================================================================
// 会话上下文
// =============================================================================

/**
 * 当前文件夹信息
 */
export interface CurrentFolder {
  /** 文件夹 ID */
  id: number;
  /** 文件夹名称 */
  name: string;
}

/**
 * 会话上下文
 */
export interface SessionContext {
  /** 用户选中的书签 ID 列表 */
  selectedBookmarkIds?: number[];
  /** 当前浏览的文件夹 */
  currentFolder?: CurrentFolder;
}

// =============================================================================
// 情景记忆上下文
// =============================================================================

/**
 * 简化的会话摘要（用于 Prompt 注入）
 */
export interface RecentSummaryContext {
  /** 摘要内容 */
  summary: string;
  /** 主要意图 */
  intents: string[];
  /** 时间描述（如 "2小时前"） */
  timeAgo: string;
}

/**
 * 用户偏好分析（来自交互日志）
 */
export interface PreferencesAnalysisContext {
  /** 正面反馈率 */
  positiveRate: number;
  /** 最常用操作类型 */
  commonActions: string[];
  /** 总交互次数 */
  totalInteractions: number;
}

/**
 * 情景记忆上下文 - 跨会话记忆
 */
export interface EpisodicMemoryContext {
  /** 最近会话摘要 */
  recentSummaries: RecentSummaryContext[];
  /** 未完成的意图 */
  pendingIntents: string[];
  /** 用户偏好（来自交互日志分析） */
  preferences: PreferencesAnalysisContext | null;
}

// =============================================================================
// 动态上下文（完整）
// =============================================================================

/**
 * 动态上下文 - 每次对话开始时由代码层组装
 */
export interface DynamicContext {
  /** 时间信息 */
  time: TimeContext;
  /** 用户数据概况（带缓存，5分钟刷新） */
  stats: StatsContext;
  /** 用户偏好（从 Profile 读取） */
  preferences: PreferencesContext;
  /** 最近活动 */
  recentActivity: RecentActivityContext;
  /** 当前会话上下文 */
  session: SessionContext;
  /** 情景记忆（跨会话，可选） */
  episodicMemory?: EpisodicMemoryContext;
}

// =============================================================================
// 构建器选项
// =============================================================================

/**
 * 动态上下文构建选项
 */
export interface DynamicContextBuildOptions {
  /** 是否跳过统计数据（加速响应） */
  skipStats?: boolean;
  /** 是否跳过最近活动 */
  skipRecentActivity?: boolean;
  /** 会话上下文 */
  session?: Partial<SessionContext>;
}

/**
 * 缓存条目
 */
export interface CacheEntry<T> {
  /** 缓存的数据 */
  data: T;
  /** 过期时间戳 */
  expiry: number;
}
