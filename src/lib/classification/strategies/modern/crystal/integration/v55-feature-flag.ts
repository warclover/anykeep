/**
 * V5.5 Feature Flags 配置
 */

/**
 * V5.5 功能开关
 */
export const V55FeatureFlags = {
  /** v5.5 主开关 */
  get V55_ENABLED(): boolean {
    return process.env.V55_ENABLED === "true";
  },

  /** 混沌池写入 */
  get V55_CHAOS_POOL_ENABLED(): boolean {
    return process.env.V55_CHAOS_POOL_ENABLED !== "false";
  },

  /** 晶体生长（静默创建） */
  get V55_CRYSTAL_GROWTH_ENABLED(): boolean {
    return process.env.V55_CRYSTAL_GROWTH_ENABLED !== "false";
  },

  /** 异步命名优化 */
  get V55_ASYNC_NAMING_ENABLED(): boolean {
    return process.env.V55_ASYNC_NAMING_ENABLED !== "false";
  },

  /** 静默通知 */
  get V55_SILENT_NOTIFICATION(): boolean {
    return process.env.V55_SILENT_NOTIFICATION !== "false";
  },

  /** 影子模式（仅记录不执行） */
  get V55_SHADOW_MODE(): boolean {
    return process.env.V55_SHADOW_MODE === "true";
  },

  /** 详细日志 */
  get V55_DEBUG_LOG(): boolean {
    return process.env.V55_DEBUG_LOG === "true";
  },

  /** 灰度比例 (0-100) */
  get V55_ROLLOUT_PERCENT(): number {
    const percent = parseInt(process.env.V55_ROLLOUT_PERCENT ?? "0", 10);
    return isNaN(percent) ? 0 : Math.min(100, Math.max(0, percent));
  },

  /**
   * 检查用户是否在灰度范围内
   */
  isUserInRollout(userId: string): boolean {
    if (!this.V55_ENABLED) return false;
    if (this.V55_ROLLOUT_PERCENT >= 100) return true;
    if (this.V55_ROLLOUT_PERCENT <= 0) return false;

    // 基于 userId 的 hash 决定是否在灰度范围
    const hash = this.simpleHash(userId);
    return hash % 100 < this.V55_ROLLOUT_PERCENT;
  },

  /**
   * 简单字符串 hash
   */
  simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  },
};

export default V55FeatureFlags;
