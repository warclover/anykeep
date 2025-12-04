/**
 * 缓存策略配置
 * 定义各类缓存的行为参数
 */

// 页面缓存配置
export const KEEP_ALIVE_CONFIG = {
  // 最大缓存页面数（LRU 淘汰）
  maxCachedPages: 5,
  // 排除的路由（不缓存）
  excludePatterns: ["/login", "/auth", "/callback"],
  // 默认 TTL: 5 分钟
  defaultTTL: 5 * 60 * 1000,
} as const;

// 数据缓存配置
export const DATA_CACHE_CONFIG = {
  // 数据新鲜期（在此时间内直接返回缓存，不发请求）
  staleTime: 30 * 1000, // 30 秒
  // 缓存保留时间（超过后完全失效）
  cacheTime: 5 * 60 * 1000, // 5 分钟
  // 请求重试次数
  retryCount: 3,
  // 重试延迟（毫秒）
  retryDelay: 1000,
} as const;

// 页面特定配置
export const PAGE_CACHE_CONFIG = {
  "/home": {
    keepAlive: true,
    staleTime: 60 * 1000, // 首页数据 1 分钟内认为新鲜
    priority: "high" as const, // 高优先级，不易被淘汰
  },
  "/folders": {
    keepAlive: true,
    staleTime: 60 * 1000,
    priority: "medium" as const,
  },
  "/analytics": {
    keepAlive: true,
    staleTime: 2 * 60 * 1000, // 统计数据 2 分钟
    priority: "low" as const,
  },
  "/settings": {
    keepAlive: false, // 设置页不缓存
    staleTime: 0,
    priority: "low" as const,
  },
  "/search": {
    keepAlive: true,
    staleTime: 30 * 1000,
    priority: "medium" as const,
  },
} as const;

// 数据类型特定配置
export const DATA_TYPE_CONFIG = {
  bookmarks: {
    staleTime: 30 * 1000, // 30 秒
    cacheTime: 5 * 60 * 1000,
  },
  folders: {
    staleTime: 60 * 1000, // 1 分钟
    cacheTime: 10 * 60 * 1000,
  },
  profile: {
    staleTime: 5 * 60 * 1000, // 5 分钟
    cacheTime: 30 * 60 * 1000,
  },
  analytics: {
    staleTime: 2 * 60 * 1000, // 2 分钟
    cacheTime: 10 * 60 * 1000,
  },
} as const;

/**
 * 缓存键生成器
 * 确保缓存键的一致性和可预测性
 */
export const CACHE_KEYS = {
  // 书签列表
  bookmarks: (userId: string, platform?: string) =>
    `bookmarks:${userId}:${platform || "all"}`,

  // 单个书签
  bookmark: (bookmarkId: string) => `bookmark:${bookmarkId}`,

  // 文件夹列表
  folders: (userId: string) => `folders:${userId}`,

  // 单个文件夹
  folder: (folderId: string) => `folder:${folderId}`,

  // 用户资料
  profile: (userId: string) => `profile:${userId}`,

  // 统计数据
  analytics: (userId: string) => `analytics:${userId}`,

  // 搜索结果
  search: (userId: string, query: string) =>
    `search:${userId}:${encodeURIComponent(query)}`,

  // 浏览器书签
  browserBookmarks: (userId: string) => `browser-bookmarks:${userId}`,
} as const;

/**
 * 缓存优先级类型
 */
export type CachePriority = "high" | "medium" | "low";

/**
 * 获取页面缓存配置
 */
export function getPageCacheConfig(pathname: string) {
  // 精确匹配
  const exactConfig =
    PAGE_CACHE_CONFIG[pathname as keyof typeof PAGE_CACHE_CONFIG];
  if (exactConfig) return exactConfig;

  // 模式匹配（处理动态路由）
  if (pathname.startsWith("/bookmark/")) {
    return { keepAlive: false, staleTime: 0, priority: "low" as const };
  }

  // 默认配置
  return {
    keepAlive: true,
    staleTime: DATA_CACHE_CONFIG.staleTime,
    priority: "medium" as const,
  };
}

/**
 * 获取数据类型缓存配置
 */
export function getDataCacheConfig(dataType: keyof typeof DATA_TYPE_CONFIG) {
  return (
    DATA_TYPE_CONFIG[dataType] || {
      staleTime: DATA_CACHE_CONFIG.staleTime,
      cacheTime: DATA_CACHE_CONFIG.cacheTime,
    }
  );
}
