/**
 * 笔记功能文案常量
 *
 * 统一管理笔记相关 UI 文本，便于维护和国际化准备
 */

export const NOTES = {
  // NotesSection 组件
  SECTION: {
    TITLE: "个人笔记",
    SUBTITLE: "记录想法",
    PLACEHOLDER: "记录想法...",
  },

  // DetailNotesEditor 组件
  EDITOR: {
    TITLE: "我的备注",
    EDIT: "编辑",
    SAVING: "保存中...",
    SAVE: "保存",
    CANCEL: "取消",
    PLACEHOLDER: "输入备注...",
    ADD: "添加备注",
  },

  // SaveToNoteButton 组件
  BUTTON: {
    IDLE: "保存",
    CHECKING: "检查中",
    GENERATING: "生成标题",
    SAVING: "保存中",
    SUCCESS: "已保存",
    ERROR: "失败",
    TOOLTIP: "保存到我的笔记",
  },

  // SaveToNoteDialog 组件
  DIALOG: {
    TITLE: "保存到我的笔记",
    LABEL_TITLE: "标题",
    PLACEHOLDER_TITLE: "输入笔记标题",
    LABEL_LOCATION: "保存位置",
    DEFAULT_FOLDER: "AI 生成（默认）",
    LABEL_PREVIEW: "内容预览",
    CANCEL: "取消",
    SAVE: "保存",
  },

  // DuplicateWarningPopover 组件
  DUPLICATE_WARNING: {
    TITLE: "相似内容已存在",
    SAVED_AT: "保存于",
    VIEW_EXISTING: "查看已有",
    SAVE_ANYWAY: "仍然保存",
  },

  // SaveSuccessToast 组件
  SUCCESS_TOAST: {
    SAVED_TO: (folderName: string) => `已保存到「${folderName}」`,
    VIEW_NOTE: "查看笔记",
  },

  // 错误信息
  ERROR: {
    SAVE_FAILED: "保存失败",
    SAVE_RETURN_ERROR: "保存返回数据异常",
  },
} as const;
