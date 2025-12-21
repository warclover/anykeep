/**
 * 微信文章模块 - 类型定义
 *
 * @module wechat-article
 * @description 微信公众号文章完整内容存储与展示
 */

// 从配置中导出样式级别类型
export type { StylePreserveLevel } from "./wechat-article.config";

// =============================================================================
// 图片相关类型
// =============================================================================

/**
 * 图片持久化状态
 */
export type ImagePersistStatus = "pending" | "success" | "fallback" | "failed";

/**
 * 微信文章图片元数据
 */
export interface WechatArticleImage {
  /** 原始 URL (mmbiz.qpic.cn) */
  originalUrl: string;
  /** 持久化后的 URL (Supabase Storage) */
  persistedUrl: string | null;
  /** 图片 alt 文本 */
  alt: string;
  /** 持久化状态 */
  status: ImagePersistStatus;
  /** 文件大小 (bytes) */
  fileSize?: number;
  /** 图片宽度 (px) */
  width?: number;
  /** 图片高度 (px) */
  height?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 图片统计信息
 */
export interface ImagesStats {
  total: number;
  success: number;
  failed: number;
}

// =============================================================================
// 媒体相关类型（Phase 3 升级）
// =============================================================================

/**
 * 媒体类型
 */
export type MediaType = "video" | "audio" | "vote" | "miniprogram" | "link";

/**
 * 媒体下载状态
 */
export type MediaDownloadStatus = "pending" | "success" | "failed" | "skipped";

/**
 * 媒体元素
 */
export interface MediaElement {
  /** 媒体类型 */
  type: MediaType;
  /** 标题 */
  title: string;
  /** 封面 URL */
  coverUrl?: string;
  /** 源 URL */
  sourceUrl?: string;
  /** 时长（音频/视频） */
  duration?: string;
  /** 投票选项 */
  options?: string[];
  /** 本地化 URL（下载成功后） */
  localUrl?: string;
  /** 下载状态 */
  downloadStatus?: MediaDownloadStatus;
  /** 错误信息 */
  error?: string;
  /** 文件大小 */
  fileSize?: number;
}

/**
 * 媒体统计信息
 */
export interface MediaStats {
  total: number;
  videos: number;
  audios: number;
  downloaded: number;
  failed: number;
}

// =============================================================================
// 抓取配置类型
// =============================================================================

/**
 * 微信文章抓取配置
 */
export interface WechatArticleCrawlConfig {
  /** 并发下载图片数 */
  imageConcurrency: number;
  /** 图片下载超时 (ms) */
  imageTimeout: number;
  /** 最大图片数量 */
  maxImages: number;
  /** 最小图片宽度 (px)，低于此值的图片将被过滤 */
  minImageWidth: number;
  /** 启用 Markdown 转换 */
  enableMarkdown: boolean;
  /** Storage bucket 名称 */
  storageBucket: string;
  /** 降级代理 URL 模板 */
  fallbackProxyTemplate: string;
}

// =============================================================================
// 内容类型
// =============================================================================

/**
 * 微信文章内容
 */
export interface WechatArticleContent {
  /** 原始 HTML（已清理） */
  html: string;
  /** 纯文本 */
  text: string;
  /** Markdown 格式 */
  markdown: string | null;
  /** 图片列表 */
  images: WechatArticleImage[];
  /** 媒体元素列表（视频/音频等）- Phase 3 升级 */
  media?: MediaElement[];
  /** 字数 */
  wordCount: number;
  /** 样式保留级别 - 样式选项升级 */
  styleLevel?: import("./wechat-article.config").StylePreserveLevel;
}

/**
 * 数据库中的微信文章数据
 */
export interface WechatArticleRow {
  /** 快照 ID */
  snapshotId: number;
  /** HTML 格式正文 */
  readableContent: string | null;
  /** 纯文本正文 */
  readableTextContent: string | null;
  /** Markdown 格式正文 */
  contentMarkdown: string | null;
  /** 图片列表 */
  articleImages: WechatArticleImage[];
  /** 图片状态 */
  imagesStatus: string;
  /** 图片统计 */
  imagesStats: ImagesStats;
  /** 字数 */
  wordCount: number;
  /** 内容版本 */
  contentVersion: number;
  /** 抓取时间 */
  capturedAt: string | null;
}

// =============================================================================
// 进度与状态类型
// =============================================================================

/**
 * 抓取阶段
 */
export type CrawlStage =
  | "fetching" // 获取网页
  | "parsing" // 解析内容
  | "images" // 处理图片
  | "saving" // 保存数据
  | "completed" // 完成
  | "failed"; // 失败

/**
 * 抓取进度
 */
export interface WechatArticleCrawlProgress {
  /** 阶段 */
  stage: CrawlStage;
  /** 当前进度 (0-100) */
  progress: number;
  /** 图片进度 */
  images?: {
    total: number;
    completed: number;
  };
  /** 错误信息 */
  error?: string;
}

// =============================================================================
// 重新获取类型
// =============================================================================

/**
 * 重新获取选项
 */
export interface RefetchOptions {
  /** 强制更新（即使内容未变） */
  forceUpdate?: boolean;
  /** 重新下载图片 */
  redownloadImages?: boolean;
  /** 仅更新图片（不更新正文） */
  imagesOnly?: boolean;
  /** 样式保留级别 - 样式选项升级 */
  styleLevel?: import("./wechat-article.config").StylePreserveLevel;
}

/**
 * 抓取选项 - 样式选项升级
 */
export interface CrawlOptions {
  /** 样式保留级别 */
  styleLevel?: import("./wechat-article.config").StylePreserveLevel;
}

/**
 * 重新获取结果
 */
export interface RefetchResult {
  success: boolean;
  /** 内容是否变化 */
  contentChanged: boolean;
  /** 新版本号 */
  newVersion: number;
  /** 变更详情 */
  changes: {
    title: boolean;
    content: boolean;
    wordCount: boolean;
    imagesUpdated: number;
  };
}

// =============================================================================
// API 类型
// =============================================================================

/**
 * 获取文章内容 API 响应
 */
export interface GetArticleContentResponse {
  success: boolean;
  data: WechatArticleContent | null;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 抓取文章 API 响应
 */
export interface CrawlArticleResponse {
  success: boolean;
  data?: {
    wordCount: number;
    imagesCount: number;
    imagesSuccess: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 重新获取 API 响应
 */
export interface RefetchArticleResponse {
  success: boolean;
  data?: RefetchResult;
  error?: {
    code: string;
    message: string;
  };
}

// =============================================================================
// 前端 Hook 类型
// =============================================================================

/**
 * useWechatArticle Hook 返回类型
 */
export interface UseWechatArticleReturn {
  data: WechatArticleContent | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
}

/**
 * useWechatArticleCrawl Hook 选项
 */
export interface UseWechatArticleCrawlOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * useWechatArticleCrawl Hook 返回类型
 */
export interface UseWechatArticleCrawlReturn {
  crawl: (options?: CrawlOptions) => Promise<void>;
  refetch: (options?: RefetchOptions) => Promise<void>;
  isCrawling: boolean;
  progress: WechatArticleCrawlProgress | null;
}

// =============================================================================
// 用户偏好类型 - 样式选项升级
// =============================================================================

/**
 * 微信文章用户偏好设置
 */
export interface WechatArticleUserPreferences {
  /** 默认样式保留级别 */
  defaultStyleLevel: import("./wechat-article.config").StylePreserveLevel;
  /** 记住上次选择 */
  rememberChoice: boolean;
}

/**
 * 默认用户偏好
 */
export const DEFAULT_WECHAT_PREFERENCES: WechatArticleUserPreferences = {
  defaultStyleLevel: "full-snapshot",
  rememberChoice: true,
};

/**
 * 用户偏好 localStorage 存储键
 */
export const WECHAT_PREFERENCES_STORAGE_KEY = "wechat-article-preferences";
