/**
 * V4.2.16: 首页组件类型契约
 *
 * Phase 0.1 - 类型契约优先重构策略
 * 在重构之前定义所有接口，确保类型安全
 *
 * 设计原则：
 * 1. 单一数据源 - 所有类型定义集中在此文件
 * 2. 向后兼容 - 保留现有类型的重导出
 * 3. 渐进增强 - 新类型与旧代码并存
 */

import type { Bookmark, Folder } from "@/types/supabase";

// ============================================================================
// 重导出现有类型（保持向后兼容）
// ============================================================================

export type {
  ViewMode,
  LayoutMode,
  SortValue,
  HomePlatformId,
  HomePlatformValue,
} from "./constants";

// ============================================================================
// 书签相关类型
// ============================================================================

/**
 * 带文件夹信息的书签类型
 * 用于列表展示时显示文件夹名称
 */
export type BookmarkWithFolder = Bookmark & {
  folders?: Pick<Folder, "name"> | null;
};

/**
 * 只读书签数组（用于 Context 传递，防止意外修改）
 */
export type ReadonlyBookmarks = readonly BookmarkWithFolder[];

// ============================================================================
// 筛选和排序状态
// ============================================================================

/**
 * 平台筛选状态
 */
export interface PlatformFilterState {
  /** 当前平台筛选值 */
  platform: string;
  /** 是否为浏览器书签平台 */
  isBrowserPlatform: boolean;
}

/**
 * 文件夹筛选状态
 */
export interface FolderFilterState {
  /** 当前文件夹 ID 或特殊标识 */
  folderId: string;
  /** 是否为回收站 */
  isTrashFolder: boolean;
  /** 是否为无效书签文件夹 */
  isInvalidFolder: boolean;
  /** 是否为高价值书签文件夹 */
  isHighValueFolder: boolean;
}

/**
 * 排序状态
 */
export interface SortState {
  /** 当前排序方式 */
  sortValue: string;
}

/**
 * 用途标签筛选状态
 */
export interface UsageTagFilterState {
  /** 当前选中的用途标签列表 */
  selectedTags: string[];
}

// ============================================================================
// 视图模式状态（已有 hook: use-home-view-mode.ts）
// ============================================================================

/**
 * 视图模式状态
 * @see use-home-view-mode.ts
 */
export interface ViewModeState {
  /** 当前视图模式 (card/list/compact) */
  viewMode: "card" | "list" | "compact";
  /** 当前布局模式 (auto/row/column)，仅用于卡片视图 */
  layoutMode: "auto" | "row" | "column";
  /** 是否启用翻转卡片 */
  enableFlipCard: boolean;
  /** 有效视图模式（考虑平台限制后的实际模式） */
  effectiveViewMode: "card" | "list" | "compact";
}

/**
 * 视图模式操作
 * @see use-home-view-mode.ts
 */
export interface ViewModeActions {
  setViewMode: (mode: "card" | "list" | "compact") => void;
  setLayoutMode: (mode: "auto" | "row" | "column") => void;
  setEnableFlipCard: (enabled: boolean) => void;
}

// ============================================================================
// 数据加载状态
// ============================================================================

/**
 * 数据加载状态
 */
export interface DataLoadingState {
  /** 是否正在加载更多 */
  isLoadingMore: boolean;
  /** 是否有更多数据 */
  hasMore: boolean;
  /** 当前页码 */
  currentPage: number;
  /** 每页数量 */
  pageSize: number;
  /** 总数量 */
  totalCount: number;
}

/**
 * 数据加载操作
 */
export interface DataLoadingActions {
  /** 加载更多 */
  loadMore: () => Promise<void>;
  /** 重置分页 */
  resetPagination: () => void;
  /** 刷新数据 */
  refresh: () => Promise<void>;
}

// ============================================================================
// 选择模式状态（已有 hook: use-selection-mode.ts）
// ============================================================================

/**
 * 选择模式状态
 * @see use-selection-mode.ts
 */
export interface SelectionModeState {
  /** 是否处于选择模式 */
  isSelectionMode: boolean;
  /** 已选中的书签 ID 集合 */
  selectedIds: Set<string>;
  /** 选中数量 */
  selectedCount: number;
}

/**
 * 选择模式操作
 * @see use-selection-mode.ts
 */
export interface SelectionModeActions {
  /** 进入选择模式 */
  enterSelectionMode: () => void;
  /** 退出选择模式 */
  exitSelectionMode: () => void;
  /** 切换单个书签选中状态 */
  toggleSelection: (id: string) => void;
  /** 全选/取消全选 */
  toggleSelectAll: (bookmarkIds: string[]) => void;
  /** 清空选中 */
  clearSelection: () => void;
}

// ============================================================================
// 对话框状态（已有 hook: use-dialogs.ts）
// ============================================================================

/**
 * 对话框类型枚举
 */
export type DialogType =
  | "create"
  | "batchImport"
  | "batchMove"
  | "export"
  | "browserImport"
  | "usageTagFilter";

/**
 * 对话框状态
 * @see use-dialogs.ts
 */
export interface DialogState {
  /** 当前打开的对话框 */
  openDialog: DialogType | null;
}

/**
 * 对话框操作
 * @see use-dialogs.ts
 */
export interface DialogActions {
  /** 打开指定对话框 */
  openDialog: (type: DialogType) => void;
  /** 关闭当前对话框 */
  closeDialog: () => void;
}

// ============================================================================
// 首页聚合状态（Context 使用）
// ============================================================================

/**
 * 首页完整状态
 * 用于 HomePageContext.Provider 的 value
 */
export interface HomePageState {
  // 数据
  bookmarks: ReadonlyBookmarks;
  isLoading: boolean;
  error: string | null;

  // 筛选状态
  platform: PlatformFilterState;
  folder: FolderFilterState;
  sort: SortState;
  usageTags: UsageTagFilterState;

  // 视图状态
  view: ViewModeState;

  // 分页状态
  pagination: DataLoadingState;

  // 选择模式
  selection: SelectionModeState;

  // 对话框
  dialog: DialogState;

  // 智能列表
  smartListId: number | null;
}

/**
 * 首页操作集合
 */
export interface HomePageActions {
  // 筛选操作
  setPlatform: (platform: string) => void;
  setFolder: (folderId: string) => void;
  setSort: (sort: string) => void;
  setUsageTags: (tags: string[]) => void;

  // 视图操作
  view: ViewModeActions;

  // 分页操作
  pagination: DataLoadingActions;

  // 选择模式操作
  selection: SelectionModeActions;

  // 对话框操作
  dialog: DialogActions;

  // 书签操作
  refreshBookmarks: () => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  batchDeleteBookmarks: (ids: string[]) => Promise<void>;
  moveBookmarks: (ids: string[], folderId: string) => Promise<void>;
}

/**
 * 首页 Context 类型
 */
export interface HomePageContextType {
  state: HomePageState;
  actions: HomePageActions;
}

// ============================================================================
// 组件 Props 接口
// ============================================================================

/**
 * HomePageClient 组件 Props
 */
export interface HomePageClientProps {
  /** 服务端传递的初始数据（可选，用于 SSR 场景） */
  initialBookmarks?: BookmarkWithFolder[];
  /** 服务端错误信息 */
  error?: string;
  /** 客户端导航传入的文件夹参数 */
  urlFolder?: string;
  /** 客户端导航传入的平台参数 */
  urlPlatform?: string;
  /** 智能列表 ID */
  smartListId?: number | null;
}

/**
 * 工具栏组件 Props
 */
export interface HomeToolbarProps {
  /** 当前视图模式 */
  viewMode: "card" | "list" | "compact";
  /** 设置视图模式 */
  onViewModeChange: (mode: "card" | "list" | "compact") => void;
  /** 当前布局模式 */
  layoutMode: "auto" | "row" | "column";
  /** 设置布局模式 */
  onLayoutModeChange: (mode: "auto" | "row" | "column") => void;
  /** 当前排序方式 */
  sortValue: string;
  /** 设置排序方式 */
  onSortChange: (sort: string) => void;
  /** 是否处于选择模式 */
  isSelectionMode: boolean;
  /** 切换选择模式 */
  onToggleSelectionMode: () => void;
  /** 选中数量 */
  selectedCount: number;
  /** 是否为浏览器书签平台（禁用某些功能） */
  isBrowserPlatform: boolean;
  /** 是否为回收站 */
  isTrashFolder: boolean;
  /** 打开对话框 */
  onOpenDialog: (type: DialogType) => void;
}

/**
 * 书签网格/列表组件 Props
 */
export interface HomeBookmarkGridProps {
  /** 书签列表 */
  bookmarks: ReadonlyBookmarks;
  /** 视图模式 */
  viewMode: "card" | "list" | "compact";
  /** 布局模式 */
  layoutMode: "auto" | "row" | "column";
  /** 是否启用翻转卡片 */
  enableFlipCard: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否正在加载更多 */
  isLoadingMore: boolean;
  /** 是否有更多数据 */
  hasMore: boolean;
  /** 加载更多回调 */
  onLoadMore: () => void;
  /** 是否处于选择模式 */
  isSelectionMode: boolean;
  /** 已选中的 ID */
  selectedIds: Set<string>;
  /** 切换选中 */
  onToggleSelection: (id: string) => void;
  /** 书签点击回调 */
  onBookmarkClick?: (bookmark: BookmarkWithFolder) => void;
  /** 是否为浏览器书签平台（使用虚拟滚动） */
  isBrowserPlatform: boolean;
  /** 是否为回收站 */
  isTrashFolder: boolean;
}

/**
 * 对话框容器组件 Props
 */
export interface HomeDialogsProps {
  /** 当前打开的对话框 */
  openDialog: DialogType | null;
  /** 关闭对话框 */
  onCloseDialog: () => void;
  /** 创建成功回调 */
  onCreateSuccess?: () => void;
  /** 导入成功回调 */
  onImportSuccess?: () => void;
  /** 移动成功回调 */
  onMoveSuccess?: () => void;
  /** 当前文件夹 ID（用于批量移动） */
  currentFolderId?: string;
  /** 选中的书签 ID 列表（用于批量操作） */
  selectedIds?: string[];
}

/**
 * 空状态组件 Props
 */
export interface HomeEmptyStateProps {
  /** 当前平台 */
  platform: string;
  /** 是否为浏览器书签平台 */
  isBrowserPlatform: boolean;
  /** 是否为回收站 */
  isTrashFolder: boolean;
  /** 打开导入对话框 */
  onOpenImport?: () => void;
  /** 打开创建对话框 */
  onOpenCreate?: () => void;
}

// ============================================================================
// Hook 返回类型
// ============================================================================

/**
 * useHomeBookmarks Hook 返回类型
 */
export interface UseHomeBookmarksReturn {
  /** 书签列表 */
  bookmarks: ReadonlyBookmarks;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否正在验证（SWR 后台刷新） */
  isValidating: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 是否有更多数据 */
  hasMore: boolean;
  /** 总数量 */
  totalCount: number;
  /** 加载更多 */
  loadMore: () => Promise<void>;
  /** 刷新数据 */
  refresh: () => Promise<void>;
  /** 手动设置书签（乐观更新） */
  mutate: (data?: BookmarkWithFolder[]) => Promise<void>;
}

/**
 * useHomePlatform Hook 返回类型
 */
export interface UseHomePlatformReturn {
  /** 当前平台值 */
  platform: string;
  /** 设置平台 */
  setPlatform: (platform: string) => void;
  /** 是否为浏览器书签平台 */
  isBrowserPlatform: boolean;
}

/**
 * useHomeSort Hook 返回类型
 */
export interface UseHomeSortReturn {
  /** 当前排序值 */
  sortValue: string;
  /** 设置排序 */
  setSortValue: (sort: string) => void;
}

/**
 * useHomeViewMode Hook 返回类型（已存在，此处仅作文档）
 * @see use-home-view-mode.ts
 */
export interface UseHomeViewModeReturn extends ViewModeState, ViewModeActions {}

// ============================================================================
// 事件类型（用于 Event Bridge 过渡期）
// ============================================================================

/**
 * 自定义事件名称常量
 * 用于 window.dispatchEvent / window.addEventListener
 */
export const HOME_PAGE_EVENTS = {
  VIEW_MODE_CHANGE: "viewModeChange",
  LAYOUT_MODE_CHANGE: "layoutModeChange",
  FLIP_CARD_CHANGE: "flipCardChange",
  PLATFORM_CHANGE: "platformChange",
  OPEN_DIALOG: "openDialog",
  TOGGLE_SELECTION_MODE: "toggleSelectionMode",
  USAGE_TAG_FILTER_CHANGE: "usageTagFilterChange",
  BOOKMARK_CREATED: "bookmarkCreated",
} as const;

export type HomePageEventName =
  (typeof HOME_PAGE_EVENTS)[keyof typeof HOME_PAGE_EVENTS];

/**
 * 自定义事件 payload 类型映射
 */
export interface HomePageEventPayloads {
  [HOME_PAGE_EVENTS.VIEW_MODE_CHANGE]: "card" | "list" | "compact";
  [HOME_PAGE_EVENTS.LAYOUT_MODE_CHANGE]: "auto" | "row" | "column";
  [HOME_PAGE_EVENTS.FLIP_CARD_CHANGE]: boolean;
  [HOME_PAGE_EVENTS.PLATFORM_CHANGE]: string;
  [HOME_PAGE_EVENTS.OPEN_DIALOG]: DialogType;
  [HOME_PAGE_EVENTS.TOGGLE_SELECTION_MODE]: boolean;
  [HOME_PAGE_EVENTS.USAGE_TAG_FILTER_CHANGE]: string[];
  [HOME_PAGE_EVENTS.BOOKMARK_CREATED]: { id: string };
}

/**
 * 类型安全的事件派发函数类型
 */
export type DispatchHomePageEvent = <T extends HomePageEventName>(
  eventName: T,
  payload: HomePageEventPayloads[T],
) => void;
