/**
 * 浏览器书签模块常量
 */

/** 每批导入的最大书签数量 */
export const BATCH_SIZE = 100;

/** 批次间延迟时间（毫秒） */
export const BATCH_DELAY_MS = 500;

/** 最大文件夹层级深度 */
export const MAX_FOLDER_DEPTH = 5;

/** 支持的文件类型 */
export const SUPPORTED_FILE_TYPES = [".html", ".htm"];

/** 支持的 MIME 类型 */
export const SUPPORTED_MIME_TYPES = ["text/html"];

/** 文件大小限制（10MB） */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Chrome 书签文件特征
 */
export const CHROME_SIGNATURES = {
  fileNamePatterns: ["chrome", "bookmark", "bookmarks"],
  contentPatterns: ["书签栏", "Bookmarks Bar", "Bookmark Bar"],
  rootFolderNames: ["书签栏", "其他书签", "Bookmarks Bar", "Other Bookmarks"],
};

/**
 * Edge 书签文件特征
 */
export const EDGE_SIGNATURES = {
  fileNamePatterns: ["edge", "favorite", "favorites"],
  contentPatterns: ["收藏夹栏", "Favorites Bar", "Favorite Bar"],
  rootFolderNames: [
    "收藏夹栏",
    "其他收藏夹",
    "Favorites Bar",
    "Other Favorites",
  ],
};

/**
 * Firefox 书签文件特征
 */
export const FIREFOX_SIGNATURES = {
  fileNamePatterns: ["firefox", "mozilla"],
  contentPatterns: ["Bookmarks Menu", "书签菜单"],
  rootFolderNames: ["Bookmarks Menu", "Bookmarks Toolbar"],
};

/**
 * Safari 书签文件特征
 */
export const SAFARI_SIGNATURES = {
  fileNamePatterns: ["safari"],
  contentPatterns: ["Reading List", "阅读列表"],
  rootFolderNames: ["Favorites", "Reading List"],
};

/**
 * 导入对话框步骤
 */
export const IMPORT_DIALOG_STEPS = {
  UPLOAD: 1,
  PREVIEW: 2,
  OPTIONS: 3,
  IMPORT: 4,
} as const;

export type ImportDialogStep =
  (typeof IMPORT_DIALOG_STEPS)[keyof typeof IMPORT_DIALOG_STEPS];

/**
 * 步骤名称映射
 */
export const IMPORT_STEP_NAMES: Record<ImportDialogStep, string> = {
  [IMPORT_DIALOG_STEPS.UPLOAD]: "上传文件",
  [IMPORT_DIALOG_STEPS.PREVIEW]: "预览选择",
  [IMPORT_DIALOG_STEPS.OPTIONS]: "配置选项",
  [IMPORT_DIALOG_STEPS.IMPORT]: "开始导入",
};
