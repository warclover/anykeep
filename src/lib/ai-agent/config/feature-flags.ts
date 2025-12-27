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

  // ===========================================================================
  // 任务理解层 v2.0 相关开关
  // ===========================================================================

  /**
   * 是否启用 v2.0 System Prompt
   * @default true
   * @description 使用增强版 System Prompt（含置信度分层、隐含意图推断）
   */
  get ENABLE_V2_PROMPT(): boolean {
    return process.env.ENABLE_V2_PROMPT !== "false";
  },

  /**
   * 是否启用置信度分层执行
   * @default true
   * @description 根据置信度选择静默/说明/澄清策略
   */
  get ENABLE_CONFIDENCE_TIERING(): boolean {
    return process.env.ENABLE_CONFIDENCE_TIERING !== "false";
  },

  /**
   * 是否启用隐含意图推断
   * @default true
   * @description 从用户模糊表达推断真正目标
   */
  get ENABLE_IMPLICIT_INTENT(): boolean {
    return process.env.ENABLE_IMPLICIT_INTENT !== "false";
  },

  /**
   * 是否启用 System-Reminder 动态注入
   * @default true
   * @description 基于用户数据状态主动提供建议
   */
  get ENABLE_SYSTEM_REMINDER(): boolean {
    return process.env.ENABLE_SYSTEM_REMINDER !== "false";
  },

  /**
   * 是否启用增强置信度计算
   * @default true
   * @description 多因素综合评估意图理解置信度
   */
  get ENABLE_ENHANCED_CONFIDENCE(): boolean {
    return process.env.ENABLE_ENHANCED_CONFIDENCE !== "false";
  },

  // ===========================================================================
  // 情景记忆（Episodic Memory）相关开关
  // ===========================================================================

  /**
   * 是否启用情景记忆
   * @default true
   * @description 总开关，控制是否启用跨会话记忆能力
   */
  get ENABLE_EPISODIC_MEMORY(): boolean {
    return process.env.ENABLE_EPISODIC_MEMORY !== "false";
  },

  /**
   * 是否启用交互日志
   * @default true
   * @description 记录用户与 AI 的交互行为，用于偏好学习
   */
  get ENABLE_INTERACTION_LOGGING(): boolean {
    return process.env.ENABLE_INTERACTION_LOGGING !== "false";
  },

  /**
   * 是否启用记忆 Prompt 注入
   * @default true
   * @description 将情景记忆注入 System Prompt
   */
  get ENABLE_MEMORY_PROMPT(): boolean {
    return process.env.ENABLE_MEMORY_PROMPT !== "false";
  },

  /**
   * 是否启用未完成意图提醒
   * @default true
   * @description 主动提醒用户之前未完成的意图
   */
  get ENABLE_PENDING_INTENT_REMINDER(): boolean {
    return process.env.ENABLE_PENDING_INTENT_REMINDER !== "false";
  },

  // ===========================================================================
  // 上下文压缩相关开关
  // ===========================================================================

  /**
   * 是否启用对话上下文压缩
   * @default true
   * @description 当对话过长时自动压缩历史消息为摘要
   */
  get ENABLE_CONVERSATION_COMPRESSION(): boolean {
    return process.env.ENABLE_CONVERSATION_COMPRESSION !== "false";
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
    // 任务理解层 v2.0
    ENABLE_V2_PROMPT: FeatureFlags.ENABLE_V2_PROMPT,
    ENABLE_CONFIDENCE_TIERING: FeatureFlags.ENABLE_CONFIDENCE_TIERING,
    ENABLE_IMPLICIT_INTENT: FeatureFlags.ENABLE_IMPLICIT_INTENT,
    ENABLE_SYSTEM_REMINDER: FeatureFlags.ENABLE_SYSTEM_REMINDER,
    ENABLE_ENHANCED_CONFIDENCE: FeatureFlags.ENABLE_ENHANCED_CONFIDENCE,
    // 情景记忆（Episodic Memory）
    ENABLE_EPISODIC_MEMORY: FeatureFlags.ENABLE_EPISODIC_MEMORY,
    ENABLE_INTERACTION_LOGGING: FeatureFlags.ENABLE_INTERACTION_LOGGING,
    ENABLE_MEMORY_PROMPT: FeatureFlags.ENABLE_MEMORY_PROMPT,
    ENABLE_PENDING_INTENT_REMINDER: FeatureFlags.ENABLE_PENDING_INTENT_REMINDER,
    // 上下文压缩
    ENABLE_CONVERSATION_COMPRESSION:
      FeatureFlags.ENABLE_CONVERSATION_COMPRESSION,
  };
}
