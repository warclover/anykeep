/**
 * 智能过滤器提取规则集
 *
 * 基于正则表达式的规则引擎，从自然语言中提取过滤条件
 *
 * @version 1.0.0
 * @since 2026-01-02
 */

import type {
  FilterExtractionRule,
  TimeRangeFilter,
  PlatformFilter,
  TagFilter,
  FolderFilter,
  StarredFilter,
  ReadStatusFilter,
  ContentTypeFilter,
  SortPreference,
  LimitFilter,
} from "./filter-extractor.types";

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 计算相对日期
 */
function getRelativeDate(
  amount: number,
  unit: "day" | "week" | "month" | "year",
  direction: "past" | "future" = "past",
): Date {
  const date = new Date();
  const multiplier = direction === "past" ? -1 : 1;

  switch (unit) {
    case "day":
      date.setDate(date.getDate() + amount * multiplier);
      break;
    case "week":
      date.setDate(date.getDate() + amount * 7 * multiplier);
      break;
    case "month":
      date.setMonth(date.getMonth() + amount * multiplier);
      break;
    case "year":
      date.setFullYear(date.getFullYear() + amount * multiplier);
      break;
  }

  return date;
}

/**
 * 获取今天的开始时间
 */
function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 获取今天的结束时间
 */
function getEndOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * 获取本周开始（周一）
 */
function getStartOfWeek(): Date {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return getStartOfDay(date);
}

/**
 * 获取本月开始
 */
function getStartOfMonth(): Date {
  const date = new Date();
  date.setDate(1);
  return getStartOfDay(date);
}

/**
 * 获取本年开始
 */
function getStartOfYear(): Date {
  const date = new Date();
  date.setMonth(0, 1);
  return getStartOfDay(date);
}

// =============================================================================
// 时间范围规则
// =============================================================================

const timeRangeRules: FilterExtractionRule[] = [
  // 今天
  {
    id: "time-today",
    description: "今天",
    filterType: "time_range",
    pattern: /今天|今日|当天/,
    extract: (match): TimeRangeFilter => ({
      type: "time_range",
      start: getStartOfDay(),
      end: getEndOfDay(),
      expression: match[0],
    }),
    priority: 90,
    removeFromQuery: true,
  },
  // 昨天
  {
    id: "time-yesterday",
    description: "昨天",
    filterType: "time_range",
    pattern: /昨天|昨日/,
    extract: (match): TimeRangeFilter => {
      const yesterday = getRelativeDate(1, "day");
      return {
        type: "time_range",
        start: getStartOfDay(yesterday),
        end: getEndOfDay(yesterday),
        expression: match[0],
      };
    },
    priority: 90,
    removeFromQuery: true,
  },
  // 前天
  {
    id: "time-day-before-yesterday",
    description: "前天",
    filterType: "time_range",
    pattern: /前天/,
    extract: (match): TimeRangeFilter => {
      const dayBefore = getRelativeDate(2, "day");
      return {
        type: "time_range",
        start: getStartOfDay(dayBefore),
        end: getEndOfDay(dayBefore),
        expression: match[0],
      };
    },
    priority: 90,
    removeFromQuery: true,
  },
  // 最近 N 天
  {
    id: "time-recent-days",
    description: "最近N天",
    filterType: "time_range",
    pattern: /最近(\d+)天|近(\d+)天|这(\d+)天/,
    extract: (match): TimeRangeFilter => {
      const days = parseInt(match[1] || match[2] || match[3], 10);
      return {
        type: "time_range",
        start: getStartOfDay(getRelativeDate(days, "day")),
        end: getEndOfDay(),
        expression: match[0],
      };
    },
    priority: 85,
    removeFromQuery: true,
  },
  // 最近（默认7天）
  {
    id: "time-recent-default",
    description: "最近（默认7天）",
    filterType: "time_range",
    pattern: /最近的?|近期|这几天/,
    extract: (match): TimeRangeFilter => ({
      type: "time_range",
      start: getStartOfDay(getRelativeDate(7, "day")),
      end: getEndOfDay(),
      expression: match[0],
    }),
    priority: 70,
    removeFromQuery: true,
  },
  // 本周/这周
  {
    id: "time-this-week",
    description: "本周",
    filterType: "time_range",
    pattern: /本周|这周|这个星期|这个礼拜/,
    extract: (match): TimeRangeFilter => ({
      type: "time_range",
      start: getStartOfWeek(),
      end: getEndOfDay(),
      expression: match[0],
    }),
    priority: 85,
    removeFromQuery: true,
  },
  // 上周
  {
    id: "time-last-week",
    description: "上周",
    filterType: "time_range",
    pattern: /上周|上个星期|上个礼拜/,
    extract: (match): TimeRangeFilter => {
      const lastWeekStart = getRelativeDate(1, "week");
      const thisWeekStart = getStartOfWeek();
      thisWeekStart.setDate(thisWeekStart.getDate() - 1);
      return {
        type: "time_range",
        start: getStartOfDay(lastWeekStart),
        end: getEndOfDay(thisWeekStart),
        expression: match[0],
      };
    },
    priority: 85,
    removeFromQuery: true,
  },
  // 最近 N 周
  {
    id: "time-recent-weeks",
    description: "最近N周",
    filterType: "time_range",
    pattern: /最近(\d+)周|近(\d+)周/,
    extract: (match): TimeRangeFilter => {
      const weeks = parseInt(match[1] || match[2], 10);
      return {
        type: "time_range",
        start: getStartOfDay(getRelativeDate(weeks, "week")),
        end: getEndOfDay(),
        expression: match[0],
      };
    },
    priority: 85,
    removeFromQuery: true,
  },
  // 本月/这个月
  {
    id: "time-this-month",
    description: "本月",
    filterType: "time_range",
    pattern: /本月|这个月|这月/,
    extract: (match): TimeRangeFilter => ({
      type: "time_range",
      start: getStartOfMonth(),
      end: getEndOfDay(),
      expression: match[0],
    }),
    priority: 85,
    removeFromQuery: true,
  },
  // 上个月
  {
    id: "time-last-month",
    description: "上个月",
    filterType: "time_range",
    pattern: /上个月|上月/,
    extract: (match): TimeRangeFilter => {
      const lastMonth = getRelativeDate(1, "month");
      const thisMonthStart = getStartOfMonth();
      thisMonthStart.setDate(thisMonthStart.getDate() - 1);
      return {
        type: "time_range",
        start: getStartOfDay(
          new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
        ),
        end: getEndOfDay(thisMonthStart),
        expression: match[0],
      };
    },
    priority: 85,
    removeFromQuery: true,
  },
  // 最近 N 个月
  {
    id: "time-recent-months",
    description: "最近N个月",
    filterType: "time_range",
    pattern: /最近(\d+)个?月|近(\d+)个?月/,
    extract: (match): TimeRangeFilter => {
      const months = parseInt(match[1] || match[2], 10);
      return {
        type: "time_range",
        start: getStartOfDay(getRelativeDate(months, "month")),
        end: getEndOfDay(),
        expression: match[0],
      };
    },
    priority: 85,
    removeFromQuery: true,
  },
  // 今年
  {
    id: "time-this-year",
    description: "今年",
    filterType: "time_range",
    pattern: /今年/,
    extract: (match): TimeRangeFilter => ({
      type: "time_range",
      start: getStartOfYear(),
      end: getEndOfDay(),
      expression: match[0],
    }),
    priority: 85,
    removeFromQuery: true,
  },
  // 去年
  {
    id: "time-last-year",
    description: "去年",
    filterType: "time_range",
    pattern: /去年/,
    extract: (match): TimeRangeFilter => {
      const lastYear = new Date().getFullYear() - 1;
      return {
        type: "time_range",
        start: new Date(lastYear, 0, 1),
        end: new Date(lastYear, 11, 31, 23, 59, 59, 999),
        expression: match[0],
      };
    },
    priority: 85,
    removeFromQuery: true,
  },
  // N天前
  {
    id: "time-days-ago",
    description: "N天前",
    filterType: "time_range",
    pattern: /(\d+)天前/,
    extract: (match): TimeRangeFilter => {
      const days = parseInt(match[1], 10);
      const targetDate = getRelativeDate(days, "day");
      return {
        type: "time_range",
        start: getStartOfDay(targetDate),
        end: getEndOfDay(targetDate),
        expression: match[0],
      };
    },
    priority: 80,
    removeFromQuery: true,
  },
];

// =============================================================================
// 平台规则
// =============================================================================

const platformRules: FilterExtractionRule[] = [
  {
    id: "platform-wechat",
    description: "微信公众号",
    filterType: "platform",
    pattern: /微信的?|公众号的?|wx的?/i,
    extract: (match): PlatformFilter => ({
      type: "platform",
      platform: "wechat",
      expression: match[0],
    }),
    priority: 80,
    removeFromQuery: true,
  },
  {
    id: "platform-bilibili",
    description: "B站",
    filterType: "platform",
    pattern: /b站的?|bilibili的?|哔哩哔哩的?/i,
    extract: (match): PlatformFilter => ({
      type: "platform",
      platform: "bilibili",
      expression: match[0],
    }),
    priority: 80,
    removeFromQuery: true,
  },
  {
    id: "platform-xiaohongshu",
    description: "小红书",
    filterType: "platform",
    pattern: /小红书的?|红书的?|xhs的?/i,
    extract: (match): PlatformFilter => ({
      type: "platform",
      platform: "xiaohongshu",
      expression: match[0],
    }),
    priority: 80,
    removeFromQuery: true,
  },
  {
    id: "platform-zhihu",
    description: "知乎",
    filterType: "platform",
    pattern: /知乎的?/,
    extract: (match): PlatformFilter => ({
      type: "platform",
      platform: "zhihu",
      expression: match[0],
    }),
    priority: 80,
    removeFromQuery: true,
  },
  {
    id: "platform-juejin",
    description: "掘金",
    filterType: "platform",
    pattern: /掘金的?/,
    extract: (match): PlatformFilter => ({
      type: "platform",
      platform: "juejin",
      expression: match[0],
    }),
    priority: 80,
    removeFromQuery: true,
  },
  {
    id: "platform-csdn",
    description: "CSDN",
    filterType: "platform",
    pattern: /csdn的?/i,
    extract: (match): PlatformFilter => ({
      type: "platform",
      platform: "csdn",
      expression: match[0],
    }),
    priority: 80,
    removeFromQuery: true,
  },
  {
    id: "platform-browser",
    description: "浏览器书签",
    filterType: "platform",
    pattern: /浏览器书签?的?|导入的书签/,
    extract: (match): PlatformFilter => ({
      type: "platform",
      platform: "browser",
      expression: match[0],
    }),
    priority: 80,
    removeFromQuery: true,
  },
  {
    id: "platform-github",
    description: "GitHub",
    filterType: "platform",
    pattern: /github的?|gh的?/i,
    extract: (match): PlatformFilter => ({
      type: "platform",
      platform: "github",
      expression: match[0],
    }),
    priority: 80,
    removeFromQuery: true,
  },
  {
    id: "platform-twitter",
    description: "Twitter/X",
    filterType: "platform",
    pattern: /twitter的?|推特的?|x的?/i,
    extract: (match): PlatformFilter => ({
      type: "platform",
      platform: "twitter",
      expression: match[0],
    }),
    priority: 80,
    removeFromQuery: true,
  },
];

// =============================================================================
// 标签规则
// =============================================================================

const tagRules: FilterExtractionRule[] = [
  // 标签为 xxx / 带有 xxx 标签
  {
    id: "tag-explicit",
    description: "显式标签引用",
    filterType: "tag",
    pattern:
      /标签[为是]?\s*[「"']?([^「"'」]+?)[」"']?(?:的|$)|带有?\s*[「"']?([^「"'」]+?)[」"']?\s*标签/,
    extract: (match): TagFilter | null => {
      const tagStr = (match[1] || match[2] || "").trim();
      if (!tagStr) return null;
      // 支持逗号、顿号分隔的多标签
      const tags = tagStr
        .split(/[,，、]/)
        .map((t) => t.trim())
        .filter(Boolean);
      return {
        type: "tag",
        tags,
        matchMode: "all",
        expression: match[0],
      };
    },
    priority: 90,
    removeFromQuery: true,
  },
  // xxx 相关的
  {
    id: "tag-related",
    description: "相关主题（推断为标签）",
    filterType: "tag",
    pattern: /([A-Za-z0-9\u4e00-\u9fa5]+?)(?:相关|有关|关于)的?/,
    extract: (match): TagFilter | null => {
      const tag = match[1]?.trim();
      // 过滤掉过短或停用词
      if (!tag || tag.length < 2) return null;
      if (/^(这个|那个|什么|哪个|所有)$/.test(tag)) return null;
      return {
        type: "tag",
        tags: [tag],
        matchMode: "any",
        expression: match[0],
      };
    },
    priority: 75,
    removeFromQuery: true,
  },
  // 关于 xxx 的
  {
    id: "tag-about",
    description: "关于某主题",
    filterType: "tag",
    pattern: /关于\s*[「"']?([^「"'」的]+?)[」"']?\s*的/,
    extract: (match): TagFilter | null => {
      const tag = match[1]?.trim();
      if (!tag || tag.length < 2) return null;
      return {
        type: "tag",
        tags: [tag],
        matchMode: "any",
        expression: match[0],
      };
    },
    priority: 75,
    removeFromQuery: true,
  },
];

// =============================================================================
// 文件夹规则
// =============================================================================

const folderRules: FilterExtractionRule[] = [
  // xxx 文件夹里的
  {
    id: "folder-in",
    description: "在文件夹中",
    filterType: "folder",
    pattern:
      /[在从]?\s*[「"']?([^「"'」]+?)[」"']?\s*(?:文件夹|目录|分类)(?:里|中|下)?的?/,
    extract: (match): FolderFilter | null => {
      const folderName = match[1]?.trim();
      if (!folderName || folderName.length < 1) return null;
      // 排除常见的非文件夹名称
      if (/^(这个|那个|某个|哪个|所有|全部)$/.test(folderName)) return null;
      return {
        type: "folder",
        folderName,
        includeSubfolders: true,
        expression: match[0],
      };
    },
    priority: 85,
    removeFromQuery: true,
  },
  // 工作/学习/生活 等常见文件夹名（无需"文件夹"后缀）
  {
    id: "folder-common",
    description: "常见文件夹名",
    filterType: "folder",
    pattern:
      /(工作|学习|生活|技术|设计|产品|读书|旅行|健康|财务|项目)(?:相关)?的/,
    extract: (match): FolderFilter => ({
      type: "folder",
      folderName: match[1],
      includeSubfolders: true,
      expression: match[0],
    }),
    priority: 70,
    removeFromQuery: true,
  },
];

// =============================================================================
// 星标/收藏规则
// =============================================================================

const starredRules: FilterExtractionRule[] = [
  {
    id: "starred-true",
    description: "星标/收藏",
    filterType: "starred",
    pattern: /星标的?|加星的?|收藏的|标记的|重要的/,
    extract: (match): StarredFilter => ({
      type: "starred",
      isStarred: true,
      expression: match[0],
    }),
    priority: 80,
    removeFromQuery: true,
  },
  {
    id: "starred-false",
    description: "非星标",
    filterType: "starred",
    pattern: /非?星标的|未?收藏的|普通的/,
    extract: (match): StarredFilter => ({
      type: "starred",
      isStarred: false,
      expression: match[0],
    }),
    priority: 80,
    removeFromQuery: true,
  },
];

// =============================================================================
// 已读状态规则
// =============================================================================

const readStatusRules: FilterExtractionRule[] = [
  {
    id: "read-false",
    description: "未读",
    filterType: "read_status",
    pattern: /未读的?|没读的?|没看的?|还没看的?|待读的?|待看的?/,
    extract: (match): ReadStatusFilter => ({
      type: "read_status",
      isRead: false,
      expression: match[0],
    }),
    priority: 85,
    removeFromQuery: true,
  },
  {
    id: "read-true",
    description: "已读",
    filterType: "read_status",
    pattern: /已读的?|看过的?|读过的?/,
    extract: (match): ReadStatusFilter => ({
      type: "read_status",
      isRead: true,
      expression: match[0],
    }),
    priority: 85,
    removeFromQuery: true,
  },
];

// =============================================================================
// 内容类型规则
// =============================================================================

const contentTypeRules: FilterExtractionRule[] = [
  {
    id: "content-article",
    description: "文章",
    filterType: "content_type",
    pattern: /文章|博客|帖子|推文/,
    extract: (match): ContentTypeFilter => ({
      type: "content_type",
      contentType: "article",
      expression: match[0],
    }),
    priority: 70,
    removeFromQuery: false, // 保留在查询中，可能是用户想搜的内容
  },
  {
    id: "content-video",
    description: "视频",
    filterType: "content_type",
    pattern: /视频|影片|短视频/,
    extract: (match): ContentTypeFilter => ({
      type: "content_type",
      contentType: "video",
      expression: match[0],
    }),
    priority: 70,
    removeFromQuery: false,
  },
  {
    id: "content-code",
    description: "代码",
    filterType: "content_type",
    pattern: /代码|仓库|repo|源码/i,
    extract: (match): ContentTypeFilter => ({
      type: "content_type",
      contentType: "code",
      expression: match[0],
    }),
    priority: 70,
    removeFromQuery: false,
  },
  {
    id: "content-document",
    description: "文档",
    filterType: "content_type",
    pattern: /文档|pdf|doc|教程/i,
    extract: (match): ContentTypeFilter => ({
      type: "content_type",
      contentType: "document",
      expression: match[0],
    }),
    priority: 70,
    removeFromQuery: false,
  },
];

// =============================================================================
// 排序规则
// =============================================================================

const sortRules: FilterExtractionRule[] = [
  {
    id: "sort-time-desc",
    description: "最新的",
    filterType: "sort",
    pattern: /最新的?|按时间倒序|时间降序|新到旧/,
    extract: (match): SortPreference => ({
      type: "sort",
      field: "time",
      direction: "desc",
      expression: match[0],
    }),
    priority: 75,
    removeFromQuery: true,
  },
  {
    id: "sort-time-asc",
    description: "最早的",
    filterType: "sort",
    pattern: /最早的?|按时间正序|时间升序|旧到新|最老的/,
    extract: (match): SortPreference => ({
      type: "sort",
      field: "time",
      direction: "asc",
      expression: match[0],
    }),
    priority: 75,
    removeFromQuery: true,
  },
  {
    id: "sort-relevance",
    description: "最相关的",
    filterType: "sort",
    pattern: /最相关的?|相关度|按相关性/,
    extract: (match): SortPreference => ({
      type: "sort",
      field: "relevance",
      direction: "desc",
      expression: match[0],
    }),
    priority: 75,
    removeFromQuery: true,
  },
  {
    id: "sort-visits",
    description: "访问最多的",
    filterType: "sort",
    pattern: /访问最多的?|最常看的?|最热门的?|浏览最多的?/,
    extract: (match): SortPreference => ({
      type: "sort",
      field: "visits",
      direction: "desc",
      expression: match[0],
    }),
    priority: 75,
    removeFromQuery: true,
  },
];

// =============================================================================
// 数量限制规则
// =============================================================================

const limitRules: FilterExtractionRule[] = [
  {
    id: "limit-top-n",
    description: "前N条",
    filterType: "limit",
    pattern: /前(\d+)条?|top\s*(\d+)|(\d+)条/i,
    extract: (match): LimitFilter | null => {
      const count = parseInt(match[1] || match[2] || match[3], 10);
      if (isNaN(count) || count < 1 || count > 100) return null;
      return {
        type: "limit",
        count,
        expression: match[0],
      };
    },
    priority: 70,
    removeFromQuery: true,
  },
  {
    id: "limit-few",
    description: "几条",
    filterType: "limit",
    pattern: /几条|一些|少量/,
    extract: (match): LimitFilter => ({
      type: "limit",
      count: 5,
      expression: match[0],
    }),
    priority: 60,
    removeFromQuery: true,
  },
];

// =============================================================================
// 导出所有规则
// =============================================================================

/**
 * 所有过滤器提取规则（按优先级排序）
 */
export const FILTER_EXTRACTION_RULES: FilterExtractionRule[] = [
  ...timeRangeRules,
  ...platformRules,
  ...tagRules,
  ...folderRules,
  ...starredRules,
  ...readStatusRules,
  ...contentTypeRules,
  ...sortRules,
  ...limitRules,
].sort((a, b) => b.priority - a.priority);

/**
 * 按类型分组的规则
 */
export const RULES_BY_TYPE = {
  time_range: timeRangeRules,
  platform: platformRules,
  tag: tagRules,
  folder: folderRules,
  starred: starredRules,
  read_status: readStatusRules,
  content_type: contentTypeRules,
  sort: sortRules,
  limit: limitRules,
};
