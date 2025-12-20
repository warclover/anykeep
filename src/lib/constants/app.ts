/**
 * 应用级别的常量配置
 * 统一管理所有魔法数字和配置值
 */

/**
 * 数据查询相关常量
 */
export const QUERY_LIMITS = {
  /** 首页收藏列表每页数量 */
  HOME_BOOKMARKS_PER_PAGE: 50,
  /** 搜索结果每页数量 */
  SEARCH_RESULTS_PER_PAGE: 50,
  /** 收藏夹页面最近收藏数量 */
  RECENT_BOOKMARKS_COUNT: 5,
} as const;

/**
 * 统计分析相关常量
 */
export const ANALYTICS = {
  /** 趋势图显示天数 */
  TREND_DAYS: 30,
  /** 热门标签显示数量 */
  TOP_TAGS_COUNT: 10,
  /** 统计图表默认高度（像素） */
  CHART_HEIGHT: 300,
  /** 柱状图默认高度（像素） */
  BAR_CHART_HEIGHT: 400,
} as const;

/**
 * 验证相关常量
 */
export const VALIDATION = {
  /** 搜索关键词最小长度 */
  SEARCH_QUERY_MIN_LENGTH: 1,
  /** 搜索关键词最大长度 */
  SEARCH_QUERY_MAX_LENGTH: 200,
  /** 文件夹名称最小长度 */
  FOLDER_NAME_MIN_LENGTH: 1,
  /** 文件夹名称最大长度 */
  FOLDER_NAME_MAX_LENGTH: 50,
  /** 收藏标题最大长度 */
  BOOKMARK_TITLE_MAX_LENGTH: 500,
  /** 摘要最大长度 */
  SUMMARY_MAX_LENGTH: 2000,
} as const;

/**
 * UI 相关常量
 */
export const UI = {
  /** 空状态提示文本 */
  EMPTY_STATE_TITLE: "暂无内容",
  /** 加载提示文本 */
  LOADING_TEXT: "加载中...",
  /** 保存提示文本 */
  SAVING_TEXT: "保存中...",
} as const;

/**
 * 存储键名常量
 */
export const STORAGE_KEYS = {
  /** 搜索历史 localStorage 键 */
  SEARCH_HISTORY: "anykeep_search_history",
  /** 用户偏好设置 */
  USER_PREFERENCES: "anykeep_user_preferences",
} as const;

/**
 * 浏览器书签平台标识
 * 用于区分内容收藏和浏览器导入书签
 */
export const BROWSER_PLATFORMS = [
  "BROWSER_CHROME",
  "BROWSER_EDGE",
  "BROWSER_FIREFOX",
  "BROWSER_SAFARI",
] as const;

export type BrowserPlatform = (typeof BROWSER_PLATFORMS)[number];

/**
 * 侧边栏导航图标颜色配置（柔和糖果风格）
 * 浅色模式和深色模式分别定义
 */
export const NAV_ICON_COLORS = {
  home: {
    light: "text-blue-400",
    dark: "dark:text-blue-300",
  },
  search: {
    light: "text-cyan-400",
    dark: "dark:text-cyan-300",
  },
  folders: {
    light: "text-violet-400",
    dark: "dark:text-violet-300",
  },
  messages: {
    light: "text-pink-400",
    dark: "dark:text-pink-300",
  },
  analytics: {
    light: "text-rose-400",
    dark: "dark:text-rose-300",
  },
  batch: {
    light: "text-purple-400",
    dark: "dark:text-purple-300",
  },
  export: {
    light: "text-teal-400",
    dark: "dark:text-teal-300",
  },
  settings: {
    light: "text-gray-400",
    dark: "dark:text-gray-400",
  },
} as const;

/**
 * 侧边栏激活态样式配置
 */
export const NAV_ACTIVE_STYLES = {
  /** 默认激活态（品牌色） */
  default: {
    light: "bg-blue-50 text-blue-700 border-l-2 border-blue-400",
    dark: "dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-400",
  },
} as const;
