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
