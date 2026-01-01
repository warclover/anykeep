/**
 * 智能过滤器提取器类型定义
 *
 * 从自然语言查询中提取结构化过滤条件
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

// =============================================================================
// 过滤器值类型
// =============================================================================

/**
 * 时间范围过滤
 */
export interface TimeRangeFilter {
  type: "time_range";
  start: Date;
  end: Date;
  /** 原始表达式，如 "最近7天" */
  expression: string;
}

/**
 * 平台过滤
 */
export interface PlatformFilter {
  type: "platform";
  /** 平台标识 */
  platform:
    | "wechat"
    | "bilibili"
    | "xiaohongshu"
    | "zhihu"
    | "juejin"
    | "csdn"
    | "browser"
    | "twitter"
    | "github";
  /** 原始表达式 */
  expression: string;
}

/**
 * 标签过滤
 */
export interface TagFilter {
  type: "tag";
  /** 标签名称列表 */
  tags: string[];
  /** 匹配模式：全部匹配 or 任意匹配 */
  matchMode: "all" | "any";
  /** 原始表达式 */
  expression: string;
}

/**
 * 文件夹过滤
 */
export interface FolderFilter {
  type: "folder";
  /** 文件夹名称（待解析为 ID） */
  folderName: string;
  /** 文件夹 ID（如果已解析） */
  folderId?: number;
  /** 是否包含子文件夹 */
  includeSubfolders: boolean;
  /** 原始表达式 */
  expression: string;
}

/**
 * 星标过滤
 */
export interface StarredFilter {
  type: "starred";
  /** 是否只看星标 */
  isStarred: boolean;
  /** 原始表达式 */
  expression: string;
}

/**
 * 已读状态过滤
 */
export interface ReadStatusFilter {
  type: "read_status";
  /** 已读状态：true=已读, false=未读 */
  isRead: boolean;
  /** 原始表达式 */
  expression: string;
}

/**
 * 内容类型过滤
 */
export interface ContentTypeFilter {
  type: "content_type";
  /** 内容类型：article, video, image, audio, document */
  contentType: "article" | "video" | "image" | "audio" | "document" | "code";
  /** 原始表达式 */
  expression: string;
}

/**
 * 排序偏好
 */
export interface SortPreference {
  type: "sort";
  /** 排序字段 */
  field: "time" | "relevance" | "title" | "visits";
  /** 排序方向 */
  direction: "asc" | "desc";
  /** 原始表达式 */
  expression: string;
}

/**
 * 数量限制
 */
export interface LimitFilter {
  type: "limit";
  /** 限制数量 */
  count: number;
  /** 原始表达式 */
  expression: string;
}

// =============================================================================
// 联合类型
// =============================================================================

/**
 * 所有支持的过滤器类型
 */
export type ExtractedFilter =
  | TimeRangeFilter
  | PlatformFilter
  | TagFilter
  | FolderFilter
  | StarredFilter
  | ReadStatusFilter
  | ContentTypeFilter
  | SortPreference
  | LimitFilter;

/**
 * 过滤器类型标识
 */
export type FilterType = ExtractedFilter["type"];

// =============================================================================
// 提取结果
// =============================================================================

/**
 * 过滤器提取结果
 */
export interface FilterExtractionResult {
  /** 是否成功提取 */
  success: boolean;
  /** 提取到的过滤器列表 */
  filters: ExtractedFilter[];
  /** 移除过滤表达式后的纯查询词 */
  cleanedQuery: string;
  /** 提取置信度 (0-1) */
  confidence: number;
  /** 提取来源：规则引擎 or LLM */
  source: "rule" | "llm" | "hybrid";
  /** 处理耗时（毫秒） */
  latencyMs: number;
  /** 调试信息 */
  debug?: {
    /** 匹配的规则 ID 列表 */
    matchedRules: string[];
    /** LLM 是否被调用 */
    llmInvoked: boolean;
    /** 原始查询 */
    originalQuery: string;
  };
}

// =============================================================================
// 规则定义
// =============================================================================

/**
 * 过滤器提取规则
 */
export interface FilterExtractionRule {
  /** 规则 ID */
  id: string;
  /** 规则描述 */
  description: string;
  /** 匹配的过滤器类型 */
  filterType: FilterType;
  /** 正则表达式模式 */
  pattern: RegExp;
  /** 从匹配结果提取过滤器 */
  extract: (match: RegExpMatchArray, query: string) => ExtractedFilter | null;
  /** 规则优先级（数值越大优先级越高） */
  priority: number;
  /** 是否从查询中移除匹配文本 */
  removeFromQuery: boolean;
}

// =============================================================================
// 配置
// =============================================================================

/**
 * FilterExtractor 配置
 */
export interface FilterExtractorConfig {
  /** 是否启用 LLM 降级（规则无法提取时） */
  enableLLMFallback: boolean;
  /** LLM 模型（降级时使用） */
  llmModel: string;
  /** LLM 调用超时（毫秒） */
  llmTimeoutMs: number;
  /** 最小查询长度 */
  minQueryLength: number;
  /** 是否启用调试信息 */
  debug: boolean;
  /** 最大过滤器数量 */
  maxFilters: number;
}

/**
 * 默认配置
 */
export const DEFAULT_FILTER_EXTRACTOR_CONFIG: FilterExtractorConfig = {
  enableLLMFallback: false, // 默认仅使用规则引擎
  llmModel: "deepseek-chat",
  llmTimeoutMs: 3000,
  minQueryLength: 2,
  debug: false,
  maxFilters: 10,
};

// =============================================================================
// 数据库查询参数
// =============================================================================

/**
 * 转换为数据库查询参数
 */
export interface DatabaseFilterParams {
  /** 时间范围 */
  timeRange?: {
    start: Date;
    end: Date;
  };
  /** 平台列表 */
  platforms?: string[];
  /** 标签（AND 匹配） */
  tagsAll?: string[];
  /** 标签（OR 匹配） */
  tagsAny?: string[];
  /** 文件夹 ID 列表 */
  folderIds?: number[];
  /** 是否星标 */
  isStarred?: boolean;
  /** 是否已读 */
  isRead?: boolean;
  /** 内容类型 */
  contentTypes?: string[];
  /** 排序 */
  orderBy?: {
    field: string;
    direction: "asc" | "desc";
  };
  /** 限制数量 */
  limit?: number;
}

/**
 * 将提取的过滤器转换为数据库参数
 */
export function filtersToDbParams(
  filters: ExtractedFilter[],
): DatabaseFilterParams {
  const params: DatabaseFilterParams = {};

  for (const filter of filters) {
    switch (filter.type) {
      case "time_range":
        params.timeRange = {
          start: filter.start,
          end: filter.end,
        };
        break;
      case "platform":
        params.platforms = params.platforms || [];
        params.platforms.push(filter.platform);
        break;
      case "tag":
        if (filter.matchMode === "all") {
          params.tagsAll = params.tagsAll || [];
          params.tagsAll.push(...filter.tags);
        } else {
          params.tagsAny = params.tagsAny || [];
          params.tagsAny.push(...filter.tags);
        }
        break;
      case "folder":
        if (filter.folderId) {
          params.folderIds = params.folderIds || [];
          params.folderIds.push(filter.folderId);
        }
        break;
      case "starred":
        params.isStarred = filter.isStarred;
        break;
      case "read_status":
        params.isRead = filter.isRead;
        break;
      case "content_type":
        params.contentTypes = params.contentTypes || [];
        params.contentTypes.push(filter.contentType);
        break;
      case "sort":
        params.orderBy = {
          field: filter.field,
          direction: filter.direction,
        };
        break;
      case "limit":
        params.limit = filter.count;
        break;
    }
  }

  return params;
}
