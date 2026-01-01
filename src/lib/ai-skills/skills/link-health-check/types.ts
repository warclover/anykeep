/**
 * 链接健康检测 Skill 类型定义
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

// ============================================
// 枚举类型
// ============================================

/**
 * 健康状态枚举
 */
export type HealthStatus =
  | "unknown"
  | "healthy"
  | "slow"
  | "redirect"
  | "failed"
  | "ignored";

/**
 * 错误类型枚举
 */
export type HealthErrorType =
  | "not_found" // 404
  | "timeout" // 请求超时
  | "ssl_error" // SSL 证书问题
  | "dns_error" // DNS 解析失败
  | "connection_refused" // 连接被拒绝
  | "content_changed" // 内容已变更（可选）
  | "paywall" // 付费墙
  | "login_required"; // 需要登录

/**
 * 检测范围枚举
 */
export type CheckScope = "all" | "folder" | "selected";

/**
 * 检测状态枚举
 */
export type CheckStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * 修复操作类型
 */
export type FixAction = "delete" | "archive" | "update_url" | "ignore";

// ============================================
// 数据结构
// ============================================

/**
 * 单个链接检测结果
 */
export interface LinkCheckResult {
  /** 书签 ID */
  bookmarkId: number;
  /** 链接 URL */
  url: string;
  /** 健康状态 */
  status: HealthStatus;
  /** HTTP 状态码 */
  httpStatus?: number;
  /** 响应时间（毫秒） */
  responseTimeMs?: number;
  /** 错误类型 */
  errorType?: HealthErrorType;
  /** 错误消息 */
  errorMessage?: string;
  /** 重定向后的 URL */
  redirectUrl?: string;
  /** Wayback Machine 归档链接 */
  waybackUrl?: string;
  /** 检测时间 */
  checkedAt: Date;
}

/**
 * 书签基础信息（用于检测）
 */
export interface BookmarkForCheck {
  /** 书签 ID */
  id: number;
  /** 链接 URL */
  url: string;
  /** 书签标题 */
  title: string;
}

/**
 * 检测统计结果
 */
export interface HealthCheckStats {
  /** 总检测数 */
  totalChecked: number;
  /** 健康链接数 */
  healthyCount: number;
  /** 失效链接数 */
  failedCount: number;
  /** 缓慢链接数 */
  slowCount: number;
  /** 重定向链接数 */
  redirectCount: number;
  /** 已忽略数（反爬虫平台） */
  ignoredCount?: number;
}

/**
 * Wayback 查找结果
 */
export interface WaybackResult {
  /** 书签 ID */
  bookmarkId: number;
  /** 原始 URL */
  originalUrl: string;
  /** Wayback 归档 URL */
  waybackUrl?: string;
  /** 归档时间戳 */
  timestamp?: string;
}

// ============================================
// Skill 输入/输出
// ============================================

/**
 * 检测输入参数
 */
export interface LinkHealthCheckInput {
  /** 检测范围 */
  scope: CheckScope;
  /** 文件夹 ID（scope='folder' 时必填） */
  folderId?: number;
  /** 书签 ID 列表（scope='selected' 时必填） */
  bookmarkIds?: number[];
  /** 是否查找 Wayback 归档 */
  includeWayback?: boolean;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 并发数 */
  concurrency?: number;
}

/**
 * 检测输出结果
 */
export interface LinkHealthCheckOutput {
  /** 检测记录 ID */
  checkId: string;
  /** 统计结果 */
  stats: HealthCheckStats;
  /** 问题链接列表 */
  problems: LinkCheckResult[];
  /** 摘要文本 */
  summary: string;
  /** 建议列表 */
  suggestions: string[];
  /** 生成时间 */
  generatedAt: string;
}

/**
 * 修复操作请求
 */
export interface FixActionRequest {
  /** 书签 ID */
  bookmarkId: number;
  /** 操作类型 */
  action: FixAction;
  /** 新 URL（action='update_url' 时使用） */
  newUrl?: string;
}

/**
 * 修复操作结果
 */
export interface FixActionResult {
  /** 书签 ID */
  bookmarkId: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

// ============================================
// 服务接口
// ============================================

/**
 * URL 检测选项
 */
export interface UrlCheckOptions {
  /** 超时时间（毫秒） */
  timeout: number;
  /** 并发数 */
  concurrency: number;
}

/**
 * 数据库健康检测记录
 */
export interface HealthCheckRecord {
  id: string;
  user_id: string;
  scope: CheckScope;
  folder_id?: number;
  bookmark_ids?: number[];
  total_checked: number;
  healthy_count: number;
  failed_count: number;
  slow_count: number;
  redirect_count: number;
  problems: LinkCheckResult[];
  status: CheckStatus;
  progress: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// ============================================
// 配置常量
// ============================================

/**
 * 链接健康检测配置
 */
export const LINK_HEALTH_CONFIG = {
  /** 默认超时时间（毫秒） */
  DEFAULT_TIMEOUT_MS: 10000,

  /** 最大超时时间（毫秒） */
  MAX_TIMEOUT_MS: 30000,

  /** 默认并发数 */
  DEFAULT_CONCURRENCY: 5,

  /** 最大并发数 */
  MAX_CONCURRENCY: 10,

  /** 慢响应阈值（毫秒） */
  SLOW_THRESHOLD_MS: 5000,

  /** 单次最大检测数量 */
  MAX_CHECK_LIMIT: 500,

  /** 批次大小 */
  BATCH_SIZE: 50,

  /** Wayback Machine API */
  WAYBACK_API: "https://archive.org/wayback/available",

  /** 需要跳过的协议 */
  SKIP_PROTOCOLS: ["javascript:", "data:", "blob:", "file:"],

  /** User-Agent 标识 */
  USER_AGENT: "AnyKeep-LinkChecker/1.0",

  /** Wayback 查找并发限制 */
  WAYBACK_CONCURRENCY: 3,

  /** Wayback 请求间隔（毫秒） */
  WAYBACK_DELAY_MS: 500,

  /** Wayback 最大查找数量 */
  WAYBACK_MAX_LOOKUP: 20,

  /**
   * 跳过检测的域名列表（反爬虫平台）
   * 这些平台有严格的反爬虫机制，服务端请求会被拒绝
   * 应标记为 "ignored" 而非 "failed"
   */
  SKIP_DOMAINS: [
    // 小红书
    "xiaohongshu.com",
    "xhslink.com",
    // 微信
    "mp.weixin.qq.com",
    "weixin.qq.com",
    // 抖音/TikTok
    "douyin.com",
    "tiktok.com",
    // 淘宝/天猫
    "taobao.com",
    "tmall.com",
    // 其他需要登录的平台
    "zhihu.com", // 知乎部分内容需要登录
  ],
} as const;

/**
 * 错误处理配置
 */
export const ERROR_HANDLING_CONFIG: Record<
  HealthErrorType,
  {
    retryable: boolean;
    maxRetries: number;
    suggestion: string;
  }
> = {
  timeout: {
    retryable: true,
    maxRetries: 1,
    suggestion: "网络可能不稳定，建议稍后重试",
  },
  ssl_error: {
    retryable: false,
    maxRetries: 0,
    suggestion: "网站证书有问题，可能不安全",
  },
  dns_error: {
    retryable: false,
    maxRetries: 0,
    suggestion: "域名可能已不存在",
  },
  not_found: {
    retryable: false,
    maxRetries: 0,
    suggestion: "页面已被删除，可尝试查找归档版本",
  },
  connection_refused: {
    retryable: true,
    maxRetries: 1,
    suggestion: "服务器暂时不可用，建议稍后重试",
  },
  content_changed: {
    retryable: false,
    maxRetries: 0,
    suggestion: "页面内容已发生变化",
  },
  paywall: {
    retryable: false,
    maxRetries: 0,
    suggestion: "需要付费才能访问",
  },
  login_required: {
    retryable: false,
    maxRetries: 0,
    suggestion: "需要登录才能访问",
  },
};
