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
  | "smart_sorting"; // 智能分类功能

// 功能开关默认值（生产环境）
const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  snapshot: false, // 默认关闭，通过环境变量启用
  ai_summary: true, // 已上线功能
  smart_sorting: true, // 已上线功能
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

    // 从环境变量读取
    const envKey = `NEXT_PUBLIC_FEATURE_${flag.toUpperCase()}`;
    const envValue = process.env[envKey];

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
