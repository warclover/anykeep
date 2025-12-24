/**
 * ShareBundleSkill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

/**
 * 分享包格式
 */
export type ShareBundleFormat =
  | "link" // 分享链接
  | "html" // 独立 HTML 页面
  | "markdown" // Markdown 文档
  | "json"; // JSON 数据包

/**
 * 分享范围
 */
export type ShareScope =
  | "bookmarks" // 指定书签
  | "folder" // 整个文件夹
  | "tag" // 按标签
  | "collection"; // 自定义集合

/**
 * 分享可见性
 */
export type ShareVisibility = "public" | "private" | "password";

/**
 * 分享包输入
 */
export interface ShareBundleInput {
  /** 分享格式 */
  format: ShareBundleFormat;
  /** 分享范围 */
  scope: ShareScope;
  /** 书签 ID 列表（scope 为 bookmarks 时必填） */
  bookmarkIds?: number[];
  /** 文件夹 ID（scope 为 folder 时必填） */
  folderId?: number;
  /** 标签（scope 为 tag 时必填） */
  tag?: string;
  /** 分享标题 */
  title?: string;
  /** 分享描述 */
  description?: string;
  /** 可见性设置 */
  visibility?: ShareVisibility;
  /** 密码（visibility 为 password 时使用） */
  password?: string;
  /** 过期时间（天数，0 表示永不过期） */
  expirationDays?: number;
  /** 分享选项 */
  options?: {
    /** 是否包含摘要 */
    includeSummary?: boolean;
    /** 是否包含标签 */
    includeTags?: boolean;
    /** 是否包含评分 */
    includeRating?: boolean;
    /** 是否包含笔记 */
    includeNotes?: boolean;
    /** 主题样式 */
    theme?: "light" | "dark" | "auto";
  };
}

/**
 * 分享书签项
 */
export interface ShareBookmarkItem {
  /** 书签 ID */
  id: number;
  /** 标题 */
  title: string;
  /** URL */
  url: string;
  /** 平台 */
  platform: string;
  /** AI 摘要 */
  summary?: string;
  /** 标签 */
  tags: string[];
  /** 评分 */
  rating?: number;
  /** 笔记 */
  note?: string;
  /** 收藏时间 */
  createdAt: string;
}

/**
 * 分享包统计
 */
export interface ShareBundleStats {
  /** 书签总数 */
  totalBookmarks: number;
  /** 平台分布 */
  platforms: Record<string, number>;
  /** 标签分布 */
  tags: string[];
  /** 时间范围 */
  dateRange: {
    earliest: string;
    latest: string;
  };
}

/**
 * 分享包元数据
 */
export interface ShareBundleMetadata {
  /** 分享 ID */
  shareId: string;
  /** 创建者 */
  createdBy: string;
  /** 创建时间 */
  createdAt: string;
  /** 过期时间 */
  expiresAt?: string;
  /** 访问次数 */
  viewCount: number;
  /** 可见性 */
  visibility: ShareVisibility;
  /** 是否需要密码 */
  requiresPassword: boolean;
}

/**
 * 分享包输出
 */
export interface ShareBundleOutput {
  /** 分享标题 */
  title: string;
  /** 分享描述 */
  description?: string;
  /** 分享格式 */
  format: ShareBundleFormat;
  /** 分享链接（format 为 link 时） */
  shareUrl?: string;
  /** 分享内容（format 为 html/markdown/json 时） */
  content?: string;
  /** 文件名 */
  filename?: string;
  /** MIME 类型 */
  mimeType?: string;
  /** 书签列表 */
  bookmarks: ShareBookmarkItem[];
  /** 统计信息 */
  stats: ShareBundleStats;
  /** 元数据 */
  metadata: ShareBundleMetadata;
  /** 建议 */
  suggestions: string[];
  /** 生成时间 */
  generatedAt: string;
}

/**
 * 分享格式配置
 */
export const SHARE_FORMAT_CONFIG: Record<
  ShareBundleFormat,
  {
    name: string;
    icon: string;
    extension?: string;
    mimeType?: string;
    description: string;
  }
> = {
  link: {
    name: "分享链接",
    icon: "🔗",
    description: "生成可访问的分享链接",
  },
  html: {
    name: "HTML 页面",
    icon: "🌐",
    extension: ".html",
    mimeType: "text/html",
    description: "生成独立的 HTML 页面，可离线查看",
  },
  markdown: {
    name: "Markdown",
    icon: "📝",
    extension: ".md",
    mimeType: "text/markdown",
    description: "生成 Markdown 文档，便于分享和编辑",
  },
  json: {
    name: "JSON 数据",
    icon: "📦",
    extension: ".json",
    mimeType: "application/json",
    description: "生成 JSON 数据包，便于程序处理",
  },
};

/**
 * 默认分享配置
 */
export const DEFAULT_SHARE_CONFIG = {
  format: "link" as ShareBundleFormat,
  visibility: "private" as ShareVisibility,
  expirationDays: 7,
  options: {
    includeSummary: true,
    includeTags: true,
    includeRating: false,
    includeNotes: false,
    theme: "auto" as const,
  },
};

/**
 * 生成分享 ID
 */
export function generateShareId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
