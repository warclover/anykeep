/**
 * MD 阅读器增强 - 类型定义
 * Spec: md-reader-upgrade
 */

// ============================================
// 主题系统类型 (REQ-1)
// ============================================

/**
 * 主题 ID
 */
export type ThemeId = "light" | "dark" | "sepia" | "paper";

/**
 * 主题颜色配置
 */
export interface ThemeColors {
  /** 背景色 */
  background: string;
  /** 前景色（文字） */
  foreground: string;
  /** 强调色 */
  accent: string;
  /** 次要背景色 */
  muted: string;
  /** 边框色 */
  border: string;
}

/**
 * 阅读器主题配置
 */
export interface ReaderTheme {
  /** 主题 ID */
  id: ThemeId;
  /** 主题名称（显示用） */
  name: string;
  /** 颜色配置 */
  colors: ThemeColors;
}

/**
 * 主题 Context 值类型
 */
export interface ReaderThemeContextValue {
  /** 当前主题 */
  theme: ReaderTheme;
  /** 切换主题 */
  setTheme: (id: ThemeId) => void;
  /** 所有可用主题 */
  themes: ReaderTheme[];
}

// ============================================
// 排版类型 (REQ-2)
// ============================================

/**
 * 字体大小预设
 */
export type FontSizePreset = "small" | "medium" | "large";

/**
 * 排版配置
 */
export interface TypographyConfig {
  /** 行高 */
  lineHeight: number;
  /** 段落间距 */
  paragraphSpacing: string;
  /** 最大内容宽度 */
  maxWidth: string;
  /** 字体大小（rem） */
  fontSize: number;
}

/**
 * 字体大小配置
 */
export interface FontSizeConfig {
  id: FontSizePreset;
  label: string;
  fontSize: number;
}

// ============================================
// 目录同步类型 (REQ-3)
// ============================================

/**
 * 目录项
 */
export interface TOCItem {
  /** 标题元素 ID */
  id: string;
  /** 标题文本 */
  text: string;
  /** 标题级别 (1-4) */
  level: number;
}

/**
 * useTOCSync Hook 选项
 */
export interface UseTOCSyncOptions {
  /** 内容容器 Ref */
  containerRef: React.RefObject<HTMLElement>;
  /** 目录项列表 */
  tocItems: TOCItem[];
}

/**
 * useTOCSync Hook 返回值
 */
export interface UseTOCSyncResult {
  /** 当前活动章节 ID */
  activeId: string | null;
  /** 滚动到指定标题 */
  scrollToHeading: (id: string) => void;
}

// ============================================
// 阅读进度类型 (REQ-4, REQ-5)
// ============================================

/**
 * 阅读位置存储结构
 */
export interface ReadingPosition {
  /** 滚动位置 */
  scrollTop: number;
  /** 阅读进度百分比 (0-100) */
  progress: number;
  /** 保存时间戳 */
  timestamp: number;
}

/**
 * useReadingPosition Hook 选项
 */
export interface UseReadingPositionOptions {
  /** 文档 ID */
  collectionId: number;
  /** 内容容器 Ref */
  contentRef: React.RefObject<HTMLElement>;
  /** 预估阅读时间（分钟） */
  readingTimeMinutes: number;
  /** 可选的滚动容器 Ref（默认使用 window） */
  scrollContainerRef?: React.RefObject<HTMLElement>;
}

/**
 * useReadingPosition Hook 返回值
 */
export interface UseReadingPositionResult {
  /** 当前进度百分比 (0-100) */
  progress: number;
  /** 剩余阅读时间（分钟） */
  remainingMinutes: number;
  /** 保存的阅读位置（如果存在） */
  savedPosition: ReadingPosition | null;
  /** 保存当前位置 */
  savePosition: () => void;
  /** 恢复到保存的位置 */
  restorePosition: () => void;
  /** 清除保存的位置 */
  clearPosition: () => void;
}

// ============================================
// 专注模式类型 (REQ-6)
// ============================================

/**
 * useFocusMode Hook 返回值
 */
export interface UseFocusModeResult {
  /** 是否处于专注模式 */
  isFocusMode: boolean;
  /** 切换专注模式 */
  toggleFocusMode: () => void;
  /** 退出专注模式 */
  exitFocusMode: () => void;
  /** 工具栏是否可见 */
  isToolbarVisible: boolean;
  /** 显示工具栏 */
  showToolbar: () => void;
}

/**
 * 专注模式 Context 值类型
 */
export type FocusModeContextValue = UseFocusModeResult;

// ============================================
// 图片查看类型 (REQ-7)
// ============================================

/**
 * 图片信息
 */
export interface ImageInfo {
  /** 图片 URL */
  src: string;
  /** 图片 alt 文本 */
  alt?: string;
}

/**
 * ImageLightbox 组件 Props
 */
export interface ImageLightboxProps {
  /** 图片列表 */
  images: ImageInfo[];
  /** 初始显示的图片索引 */
  initialIndex?: number;
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

// ============================================
// 代码块增强类型 (REQ-8)
// ============================================

/**
 * CodeBlockEnhanced 组件 Props
 */
export interface CodeBlockEnhancedProps {
  /** 代码内容 */
  code: string;
  /** 编程语言 */
  language: string;
  /** 折叠阈值行数（默认 20） */
  maxCollapsedLines?: number;
}

// ============================================
// 键盘导航类型 (REQ-9)
// ============================================

/**
 * 键盘快捷键定义
 */
export interface KeyboardShortcut {
  /** 按键（如 'j', 'Escape'） */
  key: string;
  /** 描述 */
  description: string;
  /** 执行动作 */
  action: () => void;
  /** 是否需要按住修饰键 */
  modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
}

/**
 * useKeyboardNav Hook 选项
 */
export interface UseKeyboardNavOptions {
  /** 快捷键列表 */
  shortcuts: KeyboardShortcut[];
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

// ============================================
// 文字高亮类型 (REQ-10)
// ============================================

/**
 * 高亮颜色
 */
export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";

/**
 * 高亮颜色配置
 */
export interface HighlightColorConfig {
  /** 颜色 ID */
  id: HighlightColor;
  /** 背景色 */
  bg: string;
  /** 显示标签 */
  label: string;
}

/**
 * 文字高亮记录（数据库实体）
 */
export interface TextHighlight {
  /** UUID */
  id: string;
  /** 所属文档 ID */
  collection_id: number;
  /** 用户 ID */
  user_id: string;

  // 定位信息
  /** 起始字符偏移 */
  start_offset: number;
  /** 结束字符偏移 */
  end_offset: number;
  /** 锚定文本（用于内容变更后重新定位） */
  anchor_text: string;

  // 样式
  /** 高亮颜色 */
  color: HighlightColor;

  // 时间戳
  created_at: string;
  updated_at: string;
}

/**
 * 创建高亮请求
 */
export interface CreateHighlightRequest {
  start_offset: number;
  end_offset: number;
  anchor_text: string;
  color: HighlightColor;
}

/**
 * 更新高亮请求
 */
export interface UpdateHighlightRequest {
  color: HighlightColor;
}

/**
 * useHighlights Hook 选项
 */
export interface UseHighlightsOptions {
  /** 文档 ID */
  collectionId: number;
  /** 内容容器 Ref */
  contentRef: React.RefObject<HTMLElement>;
}

/**
 * useHighlights Hook 返回值
 */
export interface UseHighlightsResult {
  /** 高亮列表 */
  highlights: TextHighlight[];
  /** 是否加载中 */
  isLoading: boolean;
  /** 创建高亮 */
  createHighlight: (range: Range, color: HighlightColor) => Promise<void>;
  /** 更新高亮颜色 */
  updateHighlight: (id: string, color: HighlightColor) => Promise<void>;
  /** 删除高亮 */
  deleteHighlight: (id: string) => Promise<void>;
  /** 当前选中的 Range */
  selectedRange: Range | null;
  /** 清除选择 */
  clearSelection: () => void;
}

/**
 * 高亮工具栏位置
 */
export interface HighlightToolbarPosition {
  x: number;
  y: number;
}

/**
 * HighlightToolbar 组件 Props
 */
export interface HighlightToolbarProps {
  /** 工具栏位置 */
  position: HighlightToolbarPosition | null;
  /** 选择颜色回调 */
  onColorSelect: (color: HighlightColor) => void;
  /** 关闭回调 */
  onClose: () => void;
  /** 现有颜色（编辑模式） */
  existingColor?: HighlightColor;
  /** 删除回调（编辑模式） */
  onDelete?: () => void;
}

/**
 * 高亮 Context 值类型
 */
export interface HighlightContextValue extends UseHighlightsResult {
  /** 工具栏位置 */
  toolbarPosition: HighlightToolbarPosition | null;
  /** 设置工具栏位置 */
  setToolbarPosition: (position: HighlightToolbarPosition | null) => void;
  /** 当前编辑的高亮 ID */
  editingHighlightId: string | null;
  /** 设置编辑的高亮 */
  setEditingHighlight: (id: string | null) => void;
}

// ============================================
// 阅读器状态类型
// ============================================

/**
 * 阅读器偏好设置
 */
export interface ReaderPreferences {
  /** 主题 ID */
  themeId: ThemeId;
  /** 字体大小 */
  fontSize: FontSizePreset;
  /** 目录宽度（像素） */
  tocWidth: number;
  /** 是否显示目录 */
  showToc: boolean;
}

/**
 * 阅读器状态
 */
export interface ReadingState {
  /** 当前进度 */
  progress: number;
  /** 剩余时间（分钟） */
  remainingMinutes: number;
  /** 是否完成 */
  isCompleted: boolean;
  /** 是否专注模式 */
  isFocusMode: boolean;
}

// ============================================
// 组件通用类型
// ============================================

/**
 * 带 className 的组件基础 Props
 */
export interface WithClassName {
  className?: string;
}

/**
 * 带 children 的组件基础 Props
 */
export interface WithChildren {
  children: React.ReactNode;
}
