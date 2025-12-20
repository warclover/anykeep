/**
 * Feature Flags Configuration (V4.2.1)
 * 功能开关配置 - 控制新功能的渐进式发布
 *
 * 使用方式：
 * - 环境变量: NEXT_PUBLIC_FEATURE_XXX=true
 * - 代码中: if (featureFlags.isEnabled('snapshot')) { ... }
 */

// ============================================================================
// 功能开关定义
// ============================================================================

export type FeatureFlag =
  | "snapshot" // 网页快照功能
  | "ai_summary" // AI 摘要功能
  | "smart_sorting" // 智能分类功能
  // V4.2.17: 首页重构相关
  | "home_use_context" // 首页使用新 Context 系统
  | "home_use_new_bookmarks_hook" // 首页使用新书签数据 Hook
  // V4.2.2: 微信文章功能
  | "wechat_article"; // 微信公众号文章完整内容抓取

// 功能开关默认值（生产环境）
const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  snapshot: false, // 默认关闭，通过环境变量启用
  ai_summary: true, // 已上线功能
  smart_sorting: true, // 已上线功能
  // V4.2.17: 首页重构
  // Phase 2.4: 启用 Context 系统（已修复 hydration 问题）
  home_use_context: true,
  home_use_new_bookmarks_hook: false,
  // V4.2.2: 微信文章功能
  wechat_article: false, // 默认关闭，通过环境变量启用
};

// ============================================================================
// 静态环境变量映射
// ============================================================================
// 重要：Next.js 在构建时静态分析 process.env.XXX
// 动态 key 访问 (process.env[key]) 不会被替换，始终返回 undefined
// 必须使用静态的完整变量名访问

const ENV_VAR_MAP: Record<FeatureFlag, string | undefined> = {
  snapshot: process.env.NEXT_PUBLIC_FEATURE_SNAPSHOT,
  ai_summary: process.env.NEXT_PUBLIC_FEATURE_AI_SUMMARY,
  smart_sorting: process.env.NEXT_PUBLIC_FEATURE_SMART_SORTING,
  // V4.2.17: 首页重构
  home_use_context: process.env.NEXT_PUBLIC_FEATURE_HOME_USE_CONTEXT,
  home_use_new_bookmarks_hook:
    process.env.NEXT_PUBLIC_FEATURE_HOME_USE_NEW_BOOKMARKS_HOOK,
  // V4.2.2: 微信文章功能
  wechat_article: process.env.NEXT_PUBLIC_FEATURE_WECHAT_ARTICLE,
};

// ============================================================================
// 功能开关服务
// ============================================================================

class FeatureFlagService {
  private cache: Map<FeatureFlag, boolean> = new Map();

  /**
   * 检查功能是否启用
   */
  isEnabled(flag: FeatureFlag): boolean {
    // 检查缓存
    if (this.cache.has(flag)) {
      return this.cache.get(flag)!;
    }

    // 从静态映射读取环境变量（Next.js 要求静态访问）
    const envValue = ENV_VAR_MAP[flag];

    let enabled: boolean;
    if (envValue !== undefined) {
      // 环境变量存在，解析值
      enabled = envValue === "true" || envValue === "1";
    } else {
      // 使用默认值
      enabled = DEFAULT_FLAGS[flag] ?? false;
    }

    // 缓存结果
    this.cache.set(flag, enabled);

    return enabled;
  }

  /**
   * 获取所有功能开关状态
   */
  getAllFlags(): Record<FeatureFlag, boolean> {
    const flags = Object.keys(DEFAULT_FLAGS) as FeatureFlag[];
    return flags.reduce(
      (acc, flag) => {
        acc[flag] = this.isEnabled(flag);
        return acc;
      },
      {} as Record<FeatureFlag, boolean>,
    );
  }

  /**
   * 清除缓存（用于测试）
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// 导出单例
export const featureFlags = new FeatureFlagService();

// ============================================================================
// React Hook
// ============================================================================

/**
 * 检查功能是否启用的 Hook
 * @param flag 功能标识
 * @returns 是否启用
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  // 直接返回结果，因为环境变量在构建时确定
  return featureFlags.isEnabled(flag);
}

/**
 * 快照功能是否启用
 */
export function useSnapshotFeature(): boolean {
  return useFeatureFlag("snapshot");
}

// ============================================================================
// V4.2.17: 首页重构 Feature Flags
// ============================================================================

/**
 * 首页是否使用新 Context 系统
 */
export function useHomeContextFeature(): boolean {
  return useFeatureFlag("home_use_context");
}

/**
 * 首页是否使用新书签数据 Hook
 */
export function useHomeBookmarksHookFeature(): boolean {
  return useFeatureFlag("home_use_new_bookmarks_hook");
}

// ============================================================================
// V4.2.2: 微信文章功能 Feature Flags
// ============================================================================

/**
 * 微信公众号文章完整内容功能是否启用
 */
export function useWechatArticleFeature(): boolean {
  return useFeatureFlag("wechat_article");
}
