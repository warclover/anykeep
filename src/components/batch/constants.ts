/**
 * 批量操作模块常量配置
 */

/**
 * 批量操作限制
 */
export const BATCH_LIMITS = {
  /** 单次批量操作最大书签数 */
  MAX_BOOKMARKS: 200,
  /** 单次批量操作最大标签数 */
  MAX_TAGS: 20,
  /** 批量标签输入最大长度（单个标签） */
  TAG_MAX_LENGTH: 50,
} as const;

/**
 * 批量操作 UI 文本
 */
export const BATCH_TEXT = {
  /** 页面标题 */
  PAGE_TITLE: "批量操作",
  /** 返回首页 */
  BACK_TO_HOME: "返回首页",
  /** 全选 */
  SELECT_ALL: "全选",
  /** 清空选择 */
  CLEAR_SELECTION: "清空",
  /** 添加标签 */
  ADD_TAGS: "添加标签",
  /** 移除标签 */
  REMOVE_TAGS: "移除标签",
  /** 删除 */
  DELETE: "删除",
  /** 移动到 */
  MOVE_TO: "移动到",
  /** 导出 */
  EXPORT: "导出",
  /** 已选择 */
  SELECTED_COUNT: (count: number) => `已选择 ${count} 个`,
  /** 共 N 个书签 */
  TOTAL_COUNT: (count: number) => `共 ${count} 个书签`,
  /** 快捷键提示 */
  SHORTCUT_HINT: {
    SHIFT_SELECT: "Shift+点击 范围选择",
    ESC_CLEAR: "Esc 清空选择",
  },
  /** 空状态 */
  EMPTY_STATE: {
    TITLE: "暂无书签",
    DESCRIPTION: "当前筛选条件下没有书签",
  },
} as const;

/**
 * 批量标签对话框模式
 */
export const TAG_DIALOG_MODES = {
  ADD: "add",
  REMOVE: "remove",
} as const;

export type TagDialogMode =
  (typeof TAG_DIALOG_MODES)[keyof typeof TAG_DIALOG_MODES];
