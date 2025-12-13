/**
 * 智能列表类型定义
 * @module types/smart-list
 * @version 10.0.0
 * @description 智能列表功能的 TypeScript 类型定义，对标 Cubox + AnyKeep 特色维度
 */

// ==================== 筛选条件类型 ====================

/**
 * 时间范围筛选配置
 */
export interface DateRangeFilter {
  /** 时间范围类型 */
  type: "relative" | "absolute";
  /** 相对时间值（如：7 天、1 个月） */
  value?: number;
  /** 相对时间单位 */
  unit?: "day" | "week" | "month" | "year";
  /** 绝对时间起始（ISO 8601 格式） */
  from?: string;
  /** 绝对时间结束（ISO 8601 格式） */
  to?: string;
}

/**
 * 评级范围筛选配置
 */
export interface RatingFilter {
  /** 最低评级 (0-5) */
  min?: number;
  /** 最高评级 (0-5) */
  max?: number;
}

/**
 * AnyKeep 智能列表完整版筛选条件
 * 对标 Cubox + AnyKeep 特色维度
 * 所有条件之间为 AND 关系
 */
export interface SmartListFilters {
  // ==================== 来源维度 ====================

  /**
   * 平台筛选
   * 支持单选或多选
   * 枚举值: WECHAT_OFFICIAL_ACCOUNT | BILIBILI | XIAOHONGSHU | UNKNOWN
   *        | BROWSER_CHROME | BROWSER_EDGE | BROWSER_FIREFOX | BROWSER_SAFARI
   * 特殊值: "browser" = 所有浏览器平台
   */
  platform?: string | string[];

  /**
   * 排除的平台
   * 用于「全部」视图排除浏览器书签
   */
  excludePlatforms?: string[];

  /**
   * 文件夹筛选
   * number = 真实文件夹 ID
   * 'uncategorized' = 未分类内容
   */
  folderId?: number | "uncategorized";

  /**
   * 是否包含子文件夹
   * 默认 false，仅筛选当前文件夹
   */
  includeSubfolders?: boolean;

  /**
   * 来源名称筛选
   * 公众号名、UP主名、作者名等
   * 支持模糊匹配
   */
  sourceName?: string;

  // ==================== 标签维度 ====================

  /**
   * 用途标签筛选 (AnyKeep 独家)
   * 预设: 下次分享用 | 值得复读 | 优质经验 | 值得关注 | 推荐关注 | 待阅读
   * 支持自定义标签
   * 多选时为 OR 关系（包含任意一个即匹配）
   */
  usageTags?: string[];

  /**
   * AI 标签筛选
   * AI 自动生成的分类标签
   * 多选时为 OR 关系
   */
  aiTags?: string[];

  /**
   * 用户标签筛选
   * 用户手动添加的普通标签
   * 多选时为 OR 关系
   */
  userTags?: string[];

  // ==================== 时间维度 ====================

  /**
   * 收藏时间范围
   * 基于 created_at 字段
   */
  dateRange?: DateRangeFilter;

  /**
   * 发布时间范围
   * 基于 publish_time 字段（原文发布时间）
   */
  publishTimeRange?: DateRangeFilter;

  // ==================== 状态维度 ====================

  /**
   * 阅读状态
   * true = 已读, false = 未读, undefined = 不筛选
   */
  isRead?: boolean;

  /**
   * 星标状态
   * true = 已星标, false = 未星标
   */
  isStarred?: boolean;

  /**
   * 有效性状态
   * true = 仅显示失效, false = 仅显示有效
   */
  isInvalid?: boolean;

  /**
   * 处理状态
   * PROCESSING | COMPLETED | FAILED
   */
  status?: "PROCESSING" | "COMPLETED" | "FAILED";

  // ==================== 质量维度 ====================

  /**
   * 评级范围
   * 1-5 星评级
   */
  rating?: RatingFilter;

  /**
   * 高价值快捷筛选
   * true = rating === 5
   */
  isHighValue?: boolean;

  /**
   * 分类置信度范围 (AnyKeep 独家)
   * 高: ≥80, 中: 60-79, 低: <60
   */
  confidenceLevel?: "high" | "medium" | "low";

  // ==================== 内容维度 ====================

  /**
   * 内容类型筛选
   * 原始类型: ARTICLE | VIDEO | IMAGE | UNKNOWN
   * AI 检测类型: article | tutorial | video | tool
   */
  contentType?: string[];

  /**
   * 关键词搜索
   * 匹配标题和描述
   */
  keyword?: string;

  /**
   * 导入来源
   * browser_chrome | browser_edge | api | share_sheet | manual 等
   */
  importSource?: string | string[];
}

// ==================== 智能列表模型类型 ====================

/**
 * 智能列表颜色主题
 */
export type SmartListColor =
  | "default"
  | "blue"
  | "green"
  | "orange"
  | "purple"
  | "red"
  | "cyan"
  | "pink"
  | "amber"
  | "emerald";

/**
 * 智能列表排序方式
 */
export type SmartListSortBy =
  | "created_desc"
  | "created_asc"
  | "title_asc"
  | "title_desc"
  | "rating_desc"
  | "publish_time_desc";

/**
 * 智能列表视图模式
 */
export type SmartListViewMode = "inherit" | "card" | "list" | "compact";

/**
 * 智能列表完整模型（数据库行）
 */
export interface SmartList {
  id: number;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: SmartListColor;
  filters: SmartListFilters;
  sort_by: SmartListSortBy;
  view_mode: SmartListViewMode;
  sort_order: number;
  is_pinned: boolean;
  is_preset: boolean;
  bookmark_count: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * 智能列表（前端驼峰命名格式）
 */
export interface SmartListClient {
  id: number;
  userId: string;
  name: string;
  description: string | null;
  icon: string;
  color: SmartListColor;
  filters: SmartListFilters;
  sortBy: SmartListSortBy;
  viewMode: SmartListViewMode;
  sortOrder: number;
  isPinned: boolean;
  isPreset: boolean;
  bookmarkCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建智能列表请求
 */
export interface CreateSmartListRequest {
  name: string;
  description?: string;
  icon?: string;
  color?: SmartListColor;
  filters: SmartListFilters;
  sortBy?: SmartListSortBy;
  viewMode?: SmartListViewMode;
}

/**
 * 更新智能列表请求
 */
export interface UpdateSmartListRequest {
  name?: string;
  description?: string | null;
  icon?: string;
  color?: SmartListColor;
  filters?: SmartListFilters;
  sortBy?: SmartListSortBy;
  viewMode?: SmartListViewMode;
  isPinned?: boolean;
}

/**
 * 智能列表排序请求
 */
export interface ReorderSmartListsRequest {
  /** 智能列表 ID 数组，按新顺序排列 */
  ids: number[];
}

/**
 * 预设智能列表模板
 */
export interface PresetSmartList {
  name: string;
  description: string;
  icon: string;
  color: SmartListColor;
  filters: SmartListFilters;
  sortBy: SmartListSortBy;
  sortOrder: number;
}

// ==================== API 响应类型 ====================

/**
 * 智能列表列表响应
 */
export interface SmartListsResponse {
  success: boolean;
  data: {
    smartLists: SmartListClient[];
  };
}

/**
 * 单个智能列表响应
 */
export interface SmartListResponse {
  success: boolean;
  data: SmartListClient;
}

/**
 * 智能列表预览响应
 */
export interface SmartListPreviewResponse {
  success: boolean;
  data: {
    count: number;
    estimatedCount?: number;
  };
}

// ==================== 工具函数类型 ====================

/**
 * 将数据库行格式转换为前端驼峰格式
 */
export function toSmartListClient(row: SmartList): SmartListClient {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    filters: row.filters,
    sortBy: row.sort_by,
    viewMode: row.view_mode,
    sortOrder: row.sort_order,
    isPinned: row.is_pinned,
    isPreset: row.is_preset,
    bookmarkCount: row.bookmark_count,
    lastAccessedAt: row.last_accessed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 将筛选条件转换为 API 查询参数
 */
export function filtersToQueryParams(
  filters: SmartListFilters,
): Record<string, string> {
  const params: Record<string, string> = {};

  // 平台
  if (filters.platform) {
    params.platform = Array.isArray(filters.platform)
      ? filters.platform.join(",")
      : filters.platform;
  }

  // 文件夹
  if (filters.folderId !== undefined) {
    params.folderId =
      filters.folderId === "uncategorized"
        ? "uncategorized"
        : String(filters.folderId);
  }

  // 用途标签
  if (filters.usageTags && filters.usageTags.length > 0) {
    params.usageTags = filters.usageTags.join(",");
  }

  // 时间范围
  if (filters.dateRange) {
    if (filters.dateRange.type === "relative" && filters.dateRange.value) {
      const now = new Date();
      const from = new Date(now);
      const unit = filters.dateRange.unit || "day";
      const value = filters.dateRange.value;

      switch (unit) {
        case "day":
          from.setDate(from.getDate() - value);
          break;
        case "week":
          from.setDate(from.getDate() - value * 7);
          break;
        case "month":
          from.setMonth(from.getMonth() - value);
          break;
        case "year":
          from.setFullYear(from.getFullYear() - value);
          break;
      }

      params.dateFrom = from.toISOString();
      params.dateTo = now.toISOString();
    } else if (filters.dateRange.type === "absolute") {
      if (filters.dateRange.from) {
        params.dateFrom = filters.dateRange.from;
      }
      if (filters.dateRange.to) {
        params.dateTo = filters.dateRange.to;
      }
    }
  }

  // 阅读状态
  if (filters.isRead !== undefined) {
    params.isRead = String(filters.isRead);
  }

  // 星标状态
  if (filters.isStarred !== undefined) {
    params.isStarred = String(filters.isStarred);
  }

  // 高价值
  if (filters.isHighValue) {
    params.isHighValue = "true";
  }

  // 评级范围
  if (filters.rating) {
    if (filters.rating.min !== undefined) {
      params.ratingMin = String(filters.rating.min);
    }
    if (filters.rating.max !== undefined) {
      params.ratingMax = String(filters.rating.max);
    }
  }

  // 关键词
  if (filters.keyword) {
    params.keyword = filters.keyword;
  }

  return params;
}
