/**
 * 首页常量配置
 * 提取自 home-page-client.tsx，提高复用性
 */

// ==================== 平台配置 ====================

/** 平台筛选配置（内容平台 + 浏览器书签统一入口） */
export const HOME_PLATFORMS = [
  { id: "all", name: "全部", value: "" },
  { id: "wechat", name: "微信", value: "WECHAT_OFFICIAL_ACCOUNT" },
  { id: "xiaohongshu", name: "小红书", value: "XIAOHONGSHU" },
  { id: "bilibili", name: "B站", value: "BILIBILI" },
  { id: "browser", name: "浏览器书签", value: "browser" },
] as const;

export type HomePlatformId = (typeof HOME_PLATFORMS)[number]["id"];
export type HomePlatformValue = (typeof HOME_PLATFORMS)[number]["value"];

// ==================== 排序配置 ====================

/** 排序选项 */
export const SORT_OPTIONS = [
  { value: "created_desc", label: "最新收藏" },
  { value: "created_asc", label: "最早收藏" },
  { value: "title_asc", label: "标题 A-Z" },
  { value: "title_desc", label: "标题 Z-A" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

// ==================== 视图模式 ====================

/** 视图模式类型 */
export type ViewMode = "card" | "list" | "compact";

/** 布局模式类型（仅用于卡片视图） */
export type LayoutMode = "auto" | "row" | "column";

// ==================== 本地存储 Key ====================

/** 视图模式存储 key */
export const VIEW_MODE_STORAGE_KEY = "anykeep-view-mode";

/** 布局模式存储 key */
export const LAYOUT_MODE_STORAGE_KEY = "anykeep-layout-mode";

/** 翻转卡片开关存储 key */
export const FLIP_CARD_STORAGE_KEY = "anykeep-flip-card";

// ==================== 默认值 ====================

/** 默认视图模式 */
export const DEFAULT_VIEW_MODE: ViewMode = "card";

/** 默认布局模式 */
export const DEFAULT_LAYOUT_MODE: LayoutMode = "auto";

/** 默认排序方式 */
export const DEFAULT_SORT: SortValue = "created_desc";

// ==================== 分页配置 ====================

/**
 * 首页首次加载数量
 * 精确控制首屏渲染的卡片数量，减少首次加载时间
 */
export const INITIAL_LOAD_SIZE = 24;

/**
 * 滚动加载每批数量
 * 较小的批量可以提高响应速度，减少单次加载等待时间
 */
export const SCROLL_BATCH_SIZE = 12;

/**
 * 根据视图模式动态调整分页大小
 * - card: 卡片视图首屏约 4-8 张，16 条足够
 * - list: 列表视图首屏约 10-15 条，24 条合适
 * - compact: 紧凑视图首屏约 15-20 条，32 条合适
 */
export const PAGE_SIZE_BY_VIEW: Record<ViewMode, number> = {
  card: 16,
  list: 24,
  compact: 32,
} as const;

/** 默认分页大小（向后兼容，使用 INITIAL_LOAD_SIZE） */
export const DEFAULT_PAGE_SIZE = INITIAL_LOAD_SIZE;

/**
 * 获取视图模式对应的分页大小
 * @param viewMode - 视图模式
 * @returns 分页大小
 */
export function getPageSizeByView(viewMode: ViewMode | undefined): number {
  if (!viewMode || !(viewMode in PAGE_SIZE_BY_VIEW)) {
    return DEFAULT_PAGE_SIZE;
  }
  return PAGE_SIZE_BY_VIEW[viewMode];
}
