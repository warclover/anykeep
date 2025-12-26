/**
 * AI 功能开关配置
 *
 * 通过环境变量控制各模块的启用/禁用
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

// =============================================================================
// 功能开关
// =============================================================================

/**
 * 功能开关配置
 *
 * 通过环境变量控制，支持热切换和回滚
 */
export const FeatureFlags = {
  /**
   * 是否启用动态上下文
   * @default true
   */
  get ENABLE_DYNAMIC_CONTEXT(): boolean {
    return process.env.ENABLE_DYNAMIC_CONTEXT !== "false";
  },

  /**
   * 是否启用模型分层
   * @default true
   */
  get ENABLE_MODEL_TIERING(): boolean {
    return process.env.ENABLE_MODEL_TIERING !== "false";
  },

  /**
   * 是否启用 ReAct Prompt
   * @default true
   */
  get ENABLE_REACT_PROMPT(): boolean {
    return process.env.ENABLE_REACT_PROMPT !== "false";
  },

  /**
   * 是否启用 reasoning 参数记录
   * @default true
   */
  get ENABLE_REASONING(): boolean {
    return process.env.ENABLE_REASONING !== "false";
  },

  /**
   * 是否启用智能错误恢复
   * @default true
   */
  get ENABLE_ERROR_RECOVERY(): boolean {
    return process.env.ENABLE_ERROR_RECOVERY !== "false";
  },

  /**
   * 是否启用偏好学习
   * @default true
   */
  get ENABLE_PREFERENCE_LEARNING(): boolean {
    return process.env.ENABLE_PREFERENCE_LEARNING !== "false";
  },

  /**
   * 是否启用成本控制
   * @default true
   */
  get ENABLE_COST_CONTROL(): boolean {
    return process.env.ENABLE_COST_CONTROL !== "false";
  },
} as const;

// =============================================================================
// 类型导出
// =============================================================================

export type FeatureFlagKey = keyof typeof FeatureFlags;

/**
 * 检查功能是否启用
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return FeatureFlags[flag];
}

/**
 * 获取所有功能开关状态
 */
export function getAllFeatureFlags(): Record<FeatureFlagKey, boolean> {
  return {
    ENABLE_DYNAMIC_CONTEXT: FeatureFlags.ENABLE_DYNAMIC_CONTEXT,
    ENABLE_MODEL_TIERING: FeatureFlags.ENABLE_MODEL_TIERING,
    ENABLE_REACT_PROMPT: FeatureFlags.ENABLE_REACT_PROMPT,
    ENABLE_REASONING: FeatureFlags.ENABLE_REASONING,
    ENABLE_ERROR_RECOVERY: FeatureFlags.ENABLE_ERROR_RECOVERY,
    ENABLE_PREFERENCE_LEARNING: FeatureFlags.ENABLE_PREFERENCE_LEARNING,
    ENABLE_COST_CONTROL: FeatureFlags.ENABLE_COST_CONTROL,
  };
}
