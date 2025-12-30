/**
 * 主动简报模块类型定义
 *
 * @version 1.0.0
 * @since 2025-12-30
 * @description Phase 0 - 主动简报基础设施
 */

// =============================================================================
// 配置类型
// =============================================================================

/**
 * 主动简报配置
 */
export interface ProactiveBriefingConfig {
  /** 最小离线时长（毫秒），低于此值不生成简报，默认 4 小时 */
  minOfflineDuration: number;
  /** 最大洞察数量，默认 5 */
  maxInsights: number;
  /** 最大建议操作数量，默认 3 */
  maxSuggestions: number;
  /** 是否启用 LLM 生成摘要，默认 true */
  enableLLMSummary: boolean;
  /** 摘要最大长度，默认 200 */
  summaryMaxLength: number;
}

// =============================================================================
// 核心数据类型
// =============================================================================

/**
 * 主动简报数据
 */
export interface ProactiveBriefing {
  /** 是否启用简报 */
  enabled: boolean;
  /** 上次访问时间 (ISO 字符串) */
  lastVisit: string;
  /** 离线天数 */
  daysSinceLastVisit: number;
  /** 离线期间新增收藏数 */
  newCollectionsCount: number;
  /** 主题变化摘要 */
  topicChangeSummary?: string;
  /** 待推送的洞察列表 */
  pendingInsights: ProactiveInsight[];
  /** 建议的操作 */
  suggestedActions: SuggestedAction[];
  /** 生成时间 (ISO 字符串) */
  generatedAt: string;
}

/**
 * 洞察类型
 */
export type InsightType =
  | "topic_emergence" // 新主题涌现
  | "pattern_detected" // 模式检测
  | "recommendation" // 推荐内容
  | "knowledge_gap" // 知识盲区
  | "content_update" // 内容更新
  | "link_health"; // 链接健康

/**
 * 单条洞察
 */
export interface ProactiveInsight {
  /** 洞察 ID */
  id: string;
  /** 洞察类型 */
  type: InsightType;
  /** 标题 */
  title: string;
  /** 摘要内容 */
  summary: string;
  /** 相关书签 ID 列表 */
  relatedBookmarkIds: number[];
  /** 优先级 (1-10, 10 最高) */
  priority: number;
  /** 创建时间 (ISO 字符串) */
  createdAt: string;
  /** 是否已读 */
  isRead: boolean;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 操作类型
 */
export type ActionType =
  | "organize_topic" // 整理主题
  | "review_unread" // 复习未读
  | "cleanup_duplicates" // 清理重复
  | "tag_untagged" // 标记未标签
  | "archive_old" // 归档旧内容
  | "start_learning"; // 开始学习

/**
 * 建议操作
 */
export interface SuggestedAction {
  /** 操作 ID */
  id: string;
  /** 操作类型 */
  type: ActionType;
  /** 显示文本 */
  label: string;
  /** 操作描述 */
  description: string;
  /** 预估影响范围 */
  affectedCount?: number;
  /** 一键执行的参数 */
  executeParams?: {
    skillId?: string;
    bookmarkIds?: number[];
    folderId?: number;
    [key: string]: unknown;
  };
}

// =============================================================================
// 离线变化数据类型
// =============================================================================

/**
 * 离线期间变化数据
 */
export interface OfflineChanges {
  /** 新增书签数 */
  newBookmarksCount: number;
  /** 新增书签列表 */
  newBookmarks: Array<{
    id: number;
    title: string;
    platform: string;
    tags: string[];
    created_at: string;
  }>;
  /** 主题分布 */
  topicDistribution: Array<{ tag: string; count: number }>;
  /** 未标签数量 */
  untaggedCount: number;
  /** 待复习数量 */
  pendingReviewsCount: number;
  /** 统计起始时间 */
  since: Date;
}

// =============================================================================
// 查询选项类型
// =============================================================================

/**
 * 获取洞察选项
 */
export interface GetInsightsOptions {
  /** 是否只获取未读 */
  unreadOnly?: boolean;
  /** 限制数量 */
  limit?: number;
  /** 偏移量 */
  offset?: number;
  /** 类型过滤 */
  types?: InsightType[];
}

// =============================================================================
// 生成器接口
// =============================================================================

/**
 * 洞察生成器接口
 */
export interface InsightGenerator {
  /** 生成器名称 */
  name: string;
  /** 生成洞察 */
  generate(
    userId: string,
    changes: OfflineChanges,
  ): Promise<ProactiveInsight[]>;
}

// =============================================================================
// API 响应类型
// =============================================================================

/**
 * 简报 API 响应
 */
export interface BriefingApiResponse {
  /** 简报数据 */
  briefing: ProactiveBriefing | null;
  /** 未读洞察数量 */
  unreadCount: number;
  /** 生成耗时（毫秒） */
  generationTimeMs?: number;
}

/**
 * 洞察列表 API 响应
 */
export interface InsightsApiResponse {
  /** 洞察列表 */
  insights: ProactiveInsight[];
  /** 总数 */
  total: number;
  /** 是否有更多 */
  hasMore: boolean;
}

// =============================================================================
// 数据库类型（与 Supabase 表结构对应）
// =============================================================================

/**
 * proactive_insights 表行类型
 */
export interface ProactiveInsightRow {
  id: string;
  user_id: string;
  type: InsightType;
  title: string;
  summary: string;
  related_bookmark_ids: number[];
  priority: number;
  is_read: boolean;
  is_dismissed: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  expires_at: string;
  updated_at: string;
}

/**
 * get_offline_changes RPC 返回类型
 */
export interface OfflineChangesRpcResult {
  new_bookmarks_count: number;
  untagged_count: number;
  platforms: string[];
  top_tags: Array<{ tag: string; count: number }>;
}
