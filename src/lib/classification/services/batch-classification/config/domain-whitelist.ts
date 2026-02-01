/**
 * 域名白名单配置
 *
 * 定义不同类型域名的预分组规则和权重配置
 *
 * @module classification/batch-classification/config/domain-whitelist
 * @version 1.0.0
 * @since 2026-02-01
 */

import type { PreGroupingConfig, DomainWeightConfig } from "../types";

// ============================================
// 域名分类
// ============================================

/**
 * 专业站点（技术/开发相关）
 * 特点：内容高度专业化，5+ 即可预分组
 */
export const PROFESSIONAL_DOMAINS = [
  // 代码托管
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "gitee.com",

  // 技术文档
  "developer.mozilla.org",
  "docs.microsoft.com",
  "developer.apple.com",
  "developers.google.com",
  "reactjs.org",
  "vuejs.org",
  "angular.io",
  "nextjs.org",

  // 问答社区
  "stackoverflow.com",
  "stackexchange.com",
  "serverfault.com",

  // 包管理
  "npmjs.com",
  "pypi.org",
  "crates.io",
  "rubygems.org",

  // API 文档
  "swagger.io",
  "postman.com",
] as const;

/**
 * 内容平台（UGC 内容）
 * 特点：内容多样化，10+ 才预分组
 */
export const CONTENT_PLATFORM_DOMAINS = [
  // 中文平台
  "zhihu.com",
  "juejin.cn",
  "segmentfault.com",
  "csdn.net",
  "cnblogs.com",
  "jianshu.com",
  "bilibili.com",
  "xiaohongshu.com",
  "weixin.qq.com",
  "mp.weixin.qq.com",

  // 英文平台
  "medium.com",
  "dev.to",
  "hashnode.com",
  "substack.com",
  "reddit.com",
  "twitter.com",
  "x.com",

  // 视频平台
  "youtube.com",
  "vimeo.com",
] as const;

/**
 * 门户站点（聚合内容）
 * 特点：内容来源多样，不调整权重
 */
export const PORTAL_DOMAINS = [
  "news.google.com",
  "hao123.com",
  "360.cn",
  "sogou.com",
  "baidu.com",
  "bing.com",
  "google.com",
] as const;

/**
 * 短链服务（忽略）
 */
export const SHORTENER_DOMAINS = [
  "bit.ly",
  "t.co",
  "tinyurl.com",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "cutt.ly",
] as const;

// ============================================
// 预分组配置
// ============================================

/**
 * 默认预分组配置
 */
export const DEFAULT_PRE_GROUPING_CONFIG: PreGroupingConfig = {
  keywordGrouping: {
    enabled: true,
    minCount: 10,
  },
  domainGrouping: {
    enabled: true,
    whitelist: {
      professional: {
        domains: [...PROFESSIONAL_DOMAINS],
        minCount: 5,
      },
      contentPlatform: {
        domains: [...CONTENT_PLATFORM_DOMAINS],
        minCount: 10,
      },
    },
  },
  urlPathGrouping: {
    enabled: true,
    patterns: [
      // GitHub/GitLab 按组织分组
      { pattern: /github\.com\/([^/]+)/, minCount: 3 },
      { pattern: /gitlab\.com\/([^/]+)/, minCount: 3 },
      { pattern: /gitee\.com\/([^/]+)/, minCount: 3 },
      // 知乎专栏
      { pattern: /zhuanlan\.zhihu\.com\/([^/]+)/, minCount: 5 },
      // Medium 出版物
      { pattern: /medium\.com\/([^/@][^/]*)/, minCount: 5 },
    ],
  },
};

// ============================================
// 域名权重配置
// ============================================

/**
 * 默认域名权重配置
 */
export const DEFAULT_DOMAIN_WEIGHT_CONFIG: DomainWeightConfig = {
  domainCategories: {
    professional: [...PROFESSIONAL_DOMAINS],
    contentPlatform: [...CONTENT_PLATFORM_DOMAINS],
    portal: [...PORTAL_DOMAINS],
    shortener: [...SHORTENER_DOMAINS],
  },
  distanceModifiers: {
    professional: -0.15, // 专业站点：距离减少 15%
    contentPlatform: -0.05, // 内容平台：距离减少 5%
    portal: 0, // 门户：不调整
    shortener: 0, // 短链：忽略
  },
};

// ============================================
// 辅助函数
// ============================================

/**
 * 获取域名类别
 */
export function getDomainCategory(
  domain: string,
  config: DomainWeightConfig = DEFAULT_DOMAIN_WEIGHT_CONFIG,
): "professional" | "contentPlatform" | "portal" | "shortener" | "other" {
  const normalizedDomain = domain.toLowerCase();

  if (
    config.domainCategories.professional.some((d) =>
      normalizedDomain.includes(d),
    )
  ) {
    return "professional";
  }
  if (
    config.domainCategories.contentPlatform.some((d) =>
      normalizedDomain.includes(d),
    )
  ) {
    return "contentPlatform";
  }
  if (
    config.domainCategories.portal.some((d) => normalizedDomain.includes(d))
  ) {
    return "portal";
  }
  if (
    config.domainCategories.shortener.some((d) => normalizedDomain.includes(d))
  ) {
    return "shortener";
  }

  return "other";
}

/**
 * 获取域名权重修正值
 */
export function getDomainDistanceModifier(
  domain: string,
  config: DomainWeightConfig = DEFAULT_DOMAIN_WEIGHT_CONFIG,
): number {
  const category = getDomainCategory(domain, config);

  if (category === "other") {
    return 0;
  }

  return config.distanceModifiers[category];
}

/**
 * 提取有意义的域名
 * 对于 GitHub/GitLab 等，返回 org 级别
 */
export function extractMeaningfulDomain(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // GitHub/GitLab/Gitee：使用 org 级别
    if (
      hostname === "github.com" ||
      hostname === "gitlab.com" ||
      hostname === "gitee.com"
    ) {
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        return `${hostname}/${pathParts[0]}`;
      }
    }

    // 知乎专栏
    if (hostname === "zhuanlan.zhihu.com") {
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        return `zhuanlan.zhihu.com/${pathParts[0]}`;
      }
    }

    // Medium 出版物
    if (hostname === "medium.com") {
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0 && !pathParts[0].startsWith("@")) {
        return `medium.com/${pathParts[0]}`;
      }
    }

    // 其他：返回主域名
    return hostname;
  } catch {
    return url;
  }
}

/**
 * 检查是否为专业域名
 */
export function isProfessionalDomain(domain: string): boolean {
  return getDomainCategory(domain) === "professional";
}

/**
 * 检查是否为内容平台
 */
export function isContentPlatform(domain: string): boolean {
  return getDomainCategory(domain) === "contentPlatform";
}

/**
 * 检查是否为短链
 */
export function isShortenerDomain(domain: string): boolean {
  return getDomainCategory(domain) === "shortener";
}
