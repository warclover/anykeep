/**
 * AI 功能开关配置
 *
 * 通过环境变量控制各模块的启用/禁用
 *
 * @version 1.1.0
 * @since 2025-12-26
 * @updated 2025-12-26 添加任务理解层相关开关
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

  // ===========================================================================
  // 任务理解层（零接管模式）相关开关
  // ===========================================================================

  /**
   * 是否启用任务理解层
   * @default true
   * @description 总开关，控制是否启用深度任务理解能力
   */
  get ENABLE_TASK_UNDERSTANDING(): boolean {
    return process.env.ENABLE_TASK_UNDERSTANDING !== "false";
  },

  /**
   * 是否启用智能默认值
   * @default true
   * @description 不问用户，AI 自主决策参数
   */
  get ENABLE_SMART_DEFAULTS(): boolean {
    return process.env.ENABLE_SMART_DEFAULTS !== "false";
  },

  /**
   * 是否启用零接管模式
   * @default true
   * @description 静默理解 → 直接执行 → 事后撤销
   */
  get ENABLE_ZERO_TAKEOVER(): boolean {
    return process.env.ENABLE_ZERO_TAKEOVER !== "false";
  },

  /**
   * 是否启用撤销服务
   * @default true
   * @description 支持操作回滚
   */
  get ENABLE_UNDO_SERVICE(): boolean {
    return process.env.ENABLE_UNDO_SERVICE !== "false";
  },

  /**
   * 是否启用偏好学习 V2
   * @default true
   * @description 从用户的撤销/调整行为中学习
   */
  get ENABLE_PREFERENCE_LEARNING_V2(): boolean {
    return process.env.ENABLE_PREFERENCE_LEARNING_V2 !== "false";
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
    // 任务理解层（零接管模式）
    ENABLE_TASK_UNDERSTANDING: FeatureFlags.ENABLE_TASK_UNDERSTANDING,
    ENABLE_SMART_DEFAULTS: FeatureFlags.ENABLE_SMART_DEFAULTS,
    ENABLE_ZERO_TAKEOVER: FeatureFlags.ENABLE_ZERO_TAKEOVER,
    ENABLE_UNDO_SERVICE: FeatureFlags.ENABLE_UNDO_SERVICE,
    ENABLE_PREFERENCE_LEARNING_V2: FeatureFlags.ENABLE_PREFERENCE_LEARNING_V2,
  };
}
