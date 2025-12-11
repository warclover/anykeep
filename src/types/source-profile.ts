/**
 * 来源画像类型定义
 * V4.2 共享特征层核心组件
 *
 * @description 来源画像用于追踪公众号/网站的内容特征
 * - 同来源内容大概率属于同领域，可作为分类强信号
 * - 支持快速路径匹配，提升分类效率
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

// ============================================================================
// 核心类型
// ============================================================================

/**
 * 内容类型
 */
export type ContentType =
  | "article" // 文章（长文、深度内容）
  | "news" // 新闻（时效性内容）
  | "tutorial" // 教程（教学、指南）
  | "opinion" // 观点（评论、分析）
  | "video" // 视频内容
  | "podcast" // 音频/播客
  | "tool" // 工具/服务
  | "reference" // 参考资料（文档、API）
  | "unknown"; // 未知类型

/**
 * 来源类型
 */
export type SourceType =
  | "wechat_mp" // 微信公众号
  | "bilibili" // B站
  | "xiaohongshu" // 小红书
  | "zhihu" // 知乎
  | "weibo" // 微博
  | "website" // 普通网站
  | "rss" // RSS 订阅
  | "other"; // 其他

// ============================================================================
// 来源画像
// ============================================================================

/**
 * 来源画像（业务层使用）
 */
export interface SourceProfile {
  /** 来源 ID（唯一标识：公众号 ID / 域名） */
  sourceId: string;

  /** 来源名称（公众号名称 / 网站名） */
  sourceName: string;

  /** 来源类型 */
  sourceType: SourceType;

  /** 关联领域标签 */
  domains: string[];

  /** 来源可信度 (0-100) */
  trustScore: number;

  /** 主要内容类型 */
  contentType: ContentType;

  /** 用户历史归类的高频文件夹 ID */
  frequentFolders: number[];

  /** 样本数量（收藏过的该来源内容数） */
  sampleCount: number;

  /** 平均置信度（该来源内容分类的平均置信度） */
  avgConfidence?: number;

  /** 最后活跃时间 */
  lastSeenAt?: string;
}

/**
 * 来源画像数据库记录
 */
export interface SourceProfileRecord {
  id: number;
  user_id: string;

  /** 来源 ID（mp.weixin.qq.com/xxx 或 domain） */
  source_id: string;

  /** 来源名称 */
  source_name: string;

  /** 来源类型 */
  source_type: SourceType;

  /** 关联领域标签（数组） */
  domains: string[];

  /** 可信度分数 */
  trust_score: number;

  /** 内容类型 */
  content_type: ContentType;

  /** 高频文件夹 ID（数组） */
  frequent_folders: number[];

  /** 样本数量 */
  sample_count: number;

  /** 平均置信度 */
  avg_confidence: number | null;

  /** 最后活跃时间 */
  last_seen_at: string | null;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// 来源识别
// ============================================================================

/**
 * 从 URL 提取的来源信息
 */
export interface ExtractedSourceInfo {
  /** 来源 ID */
  sourceId: string;

  /** 来源名称（可能为空，需要后续填充） */
  sourceName?: string;

  /** 来源类型 */
  sourceType: SourceType;

  /** 是否为已知来源格式 */
  isKnownSource: boolean;
}

/**
 * 来源匹配结果
 */
export interface SourceMatchResult {
  /** 是否找到匹配的来源画像 */
  found: boolean;

  /** 匹配的来源画像 */
  profile?: SourceProfile;

  /** 推荐的文件夹 ID */
  suggestedFolderId?: number;

  /** 推荐置信度 (0-100) */
  confidence?: number;

  /** 匹配理由 */
  reason?: string;
}

// ============================================================================
// 输入输出类型
// ============================================================================

/**
 * 创建来源画像输入
 */
export interface CreateSourceProfileInput {
  userId: string;
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  domains?: string[];
  contentType?: ContentType;
  folderId?: number; // 首次分类时的文件夹
}

/**
 * 更新来源画像输入
 */
export interface UpdateSourceProfileInput {
  userId: string;
  sourceId: string;
  /** 新增的领域标签 */
  newDomains?: string[];
  /** 新分类到的文件夹 ID */
  newFolderId?: number;
  /** 分类置信度 */
  confidence?: number;
}

// ============================================================================
// 常量与工具函数
// ============================================================================

/**
 * 默认可信度分数
 */
export const DEFAULT_TRUST_SCORE = 50;

/**
 * 高可信度阈值
 */
export const HIGH_TRUST_THRESHOLD = 70;

/**
 * 来源类型显示信息
 */
export const SOURCE_TYPE_INFO: Record<
  SourceType,
  { label: string; icon: string }
> = {
  wechat_mp: { label: "微信公众号", icon: "message-circle" },
  bilibili: { label: "B站", icon: "video" },
  xiaohongshu: { label: "小红书", icon: "book-open" },
  zhihu: { label: "知乎", icon: "help-circle" },
  weibo: { label: "微博", icon: "at-sign" },
  website: { label: "网站", icon: "globe" },
  rss: { label: "RSS", icon: "rss" },
  other: { label: "其他", icon: "link" },
};

/**
 * 内容类型显示信息
 */
export const CONTENT_TYPE_INFO: Record<
  ContentType,
  { label: string; icon: string }
> = {
  article: { label: "文章", icon: "file-text" },
  news: { label: "新闻", icon: "newspaper" },
  tutorial: { label: "教程", icon: "book" },
  opinion: { label: "观点", icon: "message-square" },
  video: { label: "视频", icon: "video" },
  podcast: { label: "播客", icon: "headphones" },
  tool: { label: "工具", icon: "tool" },
  reference: { label: "参考", icon: "bookmark" },
  unknown: { label: "未知", icon: "help-circle" },
};

/**
 * 从 URL 提取来源信息
 */
export function extractSourceFromUrl(url: string): ExtractedSourceInfo {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // 微信公众号
    if (hostname.includes("mp.weixin.qq.com")) {
      // 尝试从 URL 中提取 __biz 参数作为来源 ID
      const biz = parsed.searchParams.get("__biz");
      if (biz) {
        return {
          sourceId: `wechat:${biz}`,
          sourceType: "wechat_mp",
          isKnownSource: true,
        };
      }
      return {
        sourceId: "wechat:unknown",
        sourceType: "wechat_mp",
        isKnownSource: false,
      };
    }

    // B站
    if (hostname.includes("bilibili.com")) {
      // 尝试提取 UP 主 ID
      const match = url.match(/space\.bilibili\.com\/(\d+)/);
      if (match) {
        return {
          sourceId: `bilibili:${match[1]}`,
          sourceType: "bilibili",
          isKnownSource: true,
        };
      }
      return {
        sourceId: `bilibili:${hostname}`,
        sourceType: "bilibili",
        isKnownSource: false,
      };
    }

    // 小红书
    if (hostname.includes("xiaohongshu.com") || hostname.includes("xhslink.com")) {
      return {
        sourceId: `xiaohongshu:${hostname}`,
        sourceType: "xiaohongshu",
        isKnownSource: false,
      };
    }

    // 知乎
    if (hostname.includes("zhihu.com")) {
      // 尝试提取作者 ID
      const match = url.match(/people\/([^\/]+)/);
      if (match) {
        return {
          sourceId: `zhihu:${match[1]}`,
          sourceType: "zhihu",
          isKnownSource: true,
        };
      }
      return {
        sourceId: `zhihu:${hostname}`,
        sourceType: "zhihu",
        isKnownSource: false,
      };
    }

    // 微博
    if (hostname.includes("weibo.com") || hostname.includes("weibo.cn")) {
      return {
        sourceId: `weibo:${hostname}`,
        sourceType: "weibo",
        isKnownSource: false,
      };
    }

    // 普通网站：使用域名作为来源 ID
    return {
      sourceId: `website:${hostname}`,
      sourceType: "website",
      isKnownSource: false,
    };
  } catch {
    return {
      sourceId: "unknown",
      sourceType: "other",
      isKnownSource: false,
    };
  }
}

/**
 * 验证来源类型
 */
export function isValidSourceType(type: unknown): type is SourceType {
  return (
    type === "wechat_mp" ||
    type === "bilibili" ||
    type === "xiaohongshu" ||
    type === "zhihu" ||
    type === "weibo" ||
    type === "website" ||
    type === "rss" ||
    type === "other"
  );
}

/**
 * 验证内容类型
 */
export function isValidContentType(type: unknown): type is ContentType {
  return (
    type === "article" ||
    type === "news" ||
    type === "tutorial" ||
    type === "opinion" ||
    type === "video" ||
    type === "podcast" ||
    type === "tool" ||
    type === "reference" ||
    type === "unknown"
  );
}
