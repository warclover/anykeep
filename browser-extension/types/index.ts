/**
 * AnyKeep 浏览器扩展 - 类型定义
 */

// ==================== 消息类型 ====================

/** 消息类型枚举 */
export type MessageType =
  | "ANYKEEP_AUTH"
  | "ANYKEEP_LOGOUT"
  | "PING"
  | "SAVE_BOOKMARK"
  | "GET_AUTH_STATUS"
  | "GET_PAGE_INFO"
  | "SYNC_OFFLINE_QUEUE"
  | "CLEAR_AUTH";

/** 消息基础接口 */
export interface BaseMessage {
  type: MessageType;
}

/** 认证消息 */
export interface AuthMessage extends BaseMessage {
  type: "ANYKEEP_AUTH";
  token: string;
  userId: string;
  apiUrl?: string;
  expiresIn?: number;
}

/** 登出消息 */
export interface LogoutMessage extends BaseMessage {
  type: "ANYKEEP_LOGOUT";
}

/** 保存书签消息 */
export interface SaveBookmarkMessage extends BaseMessage {
  type: "SAVE_BOOKMARK";
  url: string;
  title: string;
  metadata?: Partial<PageMetadata>;
}

/** 获取页面信息消息 */
export interface GetPageInfoMessage extends BaseMessage {
  type: "GET_PAGE_INFO";
}

/** 联合消息类型 */
export type ExtensionMessage =
  | AuthMessage
  | LogoutMessage
  | SaveBookmarkMessage
  | GetPageInfoMessage
  | BaseMessage;

// ==================== 存储类型 ====================

/** 存储数据接口 */
export interface StorageData {
  authToken: string | null;
  userId: string | null;
  apiUrl: string;
  tokenExpiresAt: number | null;
}

/** 存储键名 */
export type StorageKey = keyof StorageData;

/** 默认存储值 */
export const DEFAULT_STORAGE: StorageData = {
  authToken: null,
  userId: null,
  apiUrl: "https://anykeep.vercel.app",
  tokenExpiresAt: null,
};

// ==================== 页面元数据 ====================

/** 平台类型 */
export type Platform =
  | "WECHAT_OFFICIAL_ACCOUNT"
  | "BILIBILI"
  | "XIAOHONGSHU"
  | "ZHIHU"
  | "DOUYIN"
  | "WEIBO"
  | "JUEJIN"
  | "JIANSHU"
  | "CSDN"
  | "GITHUB"
  | "YOUTUBE"
  | "TWITTER"
  | "MEDIUM"
  | "NOTION"
  | "BROWSER_CHROME"
  | "BROWSER_EDGE"
  | "BROWSER_FIREFOX"
  | "BROWSER_SAFARI"
  | "OTHER"
  | "UNKNOWN";

/** 页面元数据 */
export interface PageMetadata {
  title: string;
  url: string;
  description?: string;
  coverUrl?: string;
  author?: string;
  siteName?: string;
  platform: Platform;
  publishTime?: string;
  wordCount?: number;
  imageCount?: number;
}

// ==================== API 相关 ====================

/** 创建书签请求数据 */
export interface BookmarkCreateData {
  url: string;
  title: string;
  description?: string;
  coverUrl?: string;
  author?: string;
  sourceName?: string;
  platform?: Platform;
  folderId?: number;
  userTags?: string[];
  notes?: string;
  publishTime?: string;
  wordCount?: number;
  imageCount?: number;
}

/** API 响应基础接口 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/** 书签响应数据 */
export interface BookmarkResponse {
  id: number;
  user_id: string;
  url: string;
  title: string;
  description: string | null;
  platform: Platform;
  folder_id: number | null;
  status: "PROCESSING" | "COMPLETED";
  ai_summary: string | null;
  ai_tags: string[] | null;
  created_at: string;
  updated_at: string;
}

// ==================== 离线队列 ====================

/** 离线书签 */
export interface OfflineBookmark {
  id: string;
  url: string;
  title: string;
  platform: Platform;
  metadata?: Partial<PageMetadata>;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}

/** 同步结果 */
export interface SyncResult {
  synced: number;
  failed: number;
  errors: Array<{
    id: string;
    url: string;
    error: string;
  }>;
}

// ==================== 认证状态 ====================

/** 认证状态 */
export type AuthStatus = "unknown" | "loggedIn" | "loggedOut" | "expired";

/** 认证信息 */
export interface AuthInfo {
  token: string;
  userId: string;
  expiresAt: number | null;
}

// ==================== 保存结果 ====================

/** 保存书签结果 */
export interface SaveResult {
  success: boolean;
  message: string;
  isOffline?: boolean;
  bookmarkId?: number;
}
