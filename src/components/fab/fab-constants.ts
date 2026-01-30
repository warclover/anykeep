/**
 * FAB 悬浮操作菜单常量定义
 *
 * @version 1.0.0
 * @since 2026-01-30
 */

// ============================================
// 路径排除配置
// ============================================

/** 不显示 FAB 菜单的页面路径 */
export const FAB_EXCLUDED_PATHS = [
  "/home",
  "/login",
  "/register",
  "/onboarding",
];

// ============================================
// UI 文案
// ============================================

export const FAB_LABELS = {
  /** 主按钮 */
  MAIN_BUTTON: {
    TITLE: "操作菜单",
    ARIA_EXPAND: "展开操作菜单",
    ARIA_COLLAPSE: "收起操作菜单",
  },
  /** 快速收藏 */
  QUICK_ADD: {
    LABEL: "快速收藏",
    SHORTCUT: "Ctrl+K",
    DIALOG_TITLE: "快速添加书签",
    DIALOG_DESCRIPTION: "输入 URL 快速添加到收藏",
    URL_LABEL: "网址",
    URL_PLACEHOLDER: "https://example.com",
    SUBMIT: "添加",
    SUBMITTING: "添加中...",
    SUCCESS: "书签添加成功",
    ERROR: "添加失败，请重试",
    INVALID_URL: "请输入有效的网址",
  },
  /** 反馈建议 */
  FEEDBACK: {
    LABEL: "反馈建议",
  },
} as const;

// ============================================
// 样式配置
// ============================================

export const FAB_STYLES = {
  /** 主按钮尺寸 */
  MAIN_SIZE: "w-14 h-14",
  /** 子按钮尺寸 */
  ITEM_SIZE: "w-11 h-11",
  /** 子按钮间距 */
  ITEM_GAP: 56, // px
  /** 动画时长 */
  ANIMATION_DURATION: 200, // ms
  /** stagger 延迟 */
  STAGGER_DELAY: 50, // ms
} as const;
