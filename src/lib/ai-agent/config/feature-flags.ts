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

  // ===========================================================================
  // ReAct 循环相关开关
  // ===========================================================================

  /**
   * 是否启用 ReAct 循环
   * @default false
   * @description Think → Act → Observe 循环，提升工具选择准确性
   */
  get ENABLE_REACT_LOOP(): boolean {
    return process.env.ENABLE_REACT_LOOP === "true";
  },

  /**
   * 是否启用引用追踪
   * @default true
   * @description 自动为搜索结果建立引用索引，生成 [^N] 格式引用
   */
  get ENABLE_CITATION_TRACKING(): boolean {
    return process.env.ENABLE_CITATION_TRACKING !== "false";
  },

  // ===========================================================================
  // 多用户画像推断相关开关 [v3.1 新增]
  // ===========================================================================

  /**
   * 是否启用多用户画像功能（主开关）
   * @default false
   * @description 控制整个多画像功能的启用/禁用，用于灰度发布
   */
  get ENABLE_MULTI_PERSONA(): boolean {
    return process.env.ENABLE_MULTI_PERSONA === "true";
  },

  /**
   * 是否启用画像推断引擎
   * @default true
   * @description 基于用户行为自动推断画像类型
   */
  get ENABLE_PERSONA_INFERENCE(): boolean {
    return process.env.ENABLE_PERSONA_INFERENCE !== "false";
  },

  /**
   * 是否启用画像专属 Prompt
   * @default true
   * @description 根据画像类型注入专属 System Prompt
   */
  get ENABLE_PERSONA_PROMPTS(): boolean {
    return process.env.ENABLE_PERSONA_PROMPTS !== "false";
  },

  /**
   * 是否启用画像意图权重加成
   * @default true
   * @description 根据画像类型调整意图识别权重
   */
  get ENABLE_PERSONA_INTENT_BOOST(): boolean {
    return process.env.ENABLE_PERSONA_INTENT_BOOST !== "false";
  },

  /**
   * 是否启用画像设置 UI
   * @default false
   * @description 在设置页面显示画像配置入口
   */
  get ENABLE_PERSONA_SETTINGS_UI(): boolean {
    return process.env.ENABLE_PERSONA_SETTINGS_UI === "true";
  },

  /**
   * 是否启用产品经理画像
   * @default true
   * @description PM 专属 Prompt 和意图权重
   */
  get ENABLE_PM_PERSONA(): boolean {
    return process.env.ENABLE_PM_PERSONA !== "false";
  },

  /**
   * 是否启用咨询顾问画像
   * @default true
   * @description 咨询顾问专属 Prompt 和意图权重
   */
  get ENABLE_CONSULTANT_PERSONA(): boolean {
    return process.env.ENABLE_CONSULTANT_PERSONA !== "false";
  },

  /**
   * 是否启用大学教师画像
   * @default true
   * @description 大学教师专属 Prompt 和意图权重
   */
  get ENABLE_TEACHER_PERSONA(): boolean {
    return process.env.ENABLE_TEACHER_PERSONA !== "false";
  },

  // ===========================================================================
  // 灰度发布控制 [Phase 4 新增]
  // ===========================================================================

  /**
   * 画像功能灰度发布百分比
   * @default 0
   * @description 控制多少百分比的用户可以使用画像功能（0-100）
   */
  get PERSONA_ROLLOUT_PERCENTAGE(): number {
    const value = parseInt(process.env.PERSONA_ROLLOUT_PERCENTAGE || "0", 10);
    return isNaN(value) ? 0 : Math.min(100, Math.max(0, value));
  },

  // ===========================================================================
  // RAG 能力增强 [Phase 1 新增]
  // ===========================================================================

  /**
   * 是否启用 LLM 查询改写
   * @default false
   * @description 使用 LLM 对用户查询进行语义扩展和同义词补充
   */
  get ENABLE_QUERY_REWRITE(): boolean {
    return process.env.ENABLE_QUERY_REWRITE === "true";
  },

  /**
   * 是否启用 Rerank 重排序
   * @default false
   * @description 使用交叉编码器对搜索结果进行语义重排序
   */
  get ENABLE_RERANK(): boolean {
    return process.env.ENABLE_RERANK === "true";
  },

  /**
   * 是否启用向量缓存
   * @default false
   * @description 缓存常用查询的向量表示，提升搜索速度
   */
  get ENABLE_VECTOR_CACHE(): boolean {
    return process.env.ENABLE_VECTOR_CACHE === "true";
  },

  // ===========================================================================
  // RAG 能力增强 [Phase 2 新增]
  // ===========================================================================

  /**
   * 是否启用 Parent-Child 切片策略
   * @default false
   * @description 长文档切片为 Parent-Child 结构，提升精准检索能力
   */
  get ENABLE_PARENT_CHILD_CHUNKING(): boolean {
    return process.env.ENABLE_PARENT_CHILD_CHUNKING === "true";
  },

  /**
   * 是否启用 RRF 融合算法
   * @default false
   * @description Reciprocal Rank Fusion 合并多来源搜索结果
   */
  get ENABLE_RRF_FUSION(): boolean {
    return process.env.ENABLE_RRF_FUSION === "true";
  },

  // ===========================================================================
  // RAG 能力增强 [Phase 3 新增]
  // ===========================================================================

  /**
   * 是否启用 RAG 监控
   * @default false
   * @description 启用 RAG 系统指标收集和告警
   */
  get ENABLE_RAG_MONITORING(): boolean {
    return process.env.ENABLE_RAG_MONITORING === "true";
  },

  /**
   * 是否启用 RAG 评估
   * @default false
   * @description 启用 RAGAS 风格的 RAG 质量评估
   */
  get ENABLE_RAG_EVALUATION(): boolean {
    return process.env.ENABLE_RAG_EVALUATION === "true";
  },
} as const;

// =============================================================================
// 类型导出
// =============================================================================

export type FeatureFlagKey = keyof typeof FeatureFlags;

/** 布尔类型的功能开关键（排除数值型配置） */
export type BooleanFeatureFlagKey = Exclude<
  FeatureFlagKey,
  "PERSONA_ROLLOUT_PERCENTAGE"
>;

/**
 * 检查功能是否启用
 * @note 仅适用于布尔类型的功能开关
 */
export function isFeatureEnabled(flag: BooleanFeatureFlagKey): boolean {
  return FeatureFlags[flag] as boolean;
}

/**
 * 获取所有功能开关状态
 */
export function getAllFeatureFlags(): Record<BooleanFeatureFlagKey, boolean> & {
  PERSONA_ROLLOUT_PERCENTAGE: number;
} {
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
    // ReAct 循环与引用追踪
    ENABLE_REACT_LOOP: FeatureFlags.ENABLE_REACT_LOOP,
    ENABLE_CITATION_TRACKING: FeatureFlags.ENABLE_CITATION_TRACKING,
    // 多用户画像推断 [v3.1 新增]
    ENABLE_MULTI_PERSONA: FeatureFlags.ENABLE_MULTI_PERSONA,
    ENABLE_PERSONA_INFERENCE: FeatureFlags.ENABLE_PERSONA_INFERENCE,
    ENABLE_PERSONA_PROMPTS: FeatureFlags.ENABLE_PERSONA_PROMPTS,
    ENABLE_PERSONA_INTENT_BOOST: FeatureFlags.ENABLE_PERSONA_INTENT_BOOST,
    ENABLE_PERSONA_SETTINGS_UI: FeatureFlags.ENABLE_PERSONA_SETTINGS_UI,
    ENABLE_PM_PERSONA: FeatureFlags.ENABLE_PM_PERSONA,
    ENABLE_CONSULTANT_PERSONA: FeatureFlags.ENABLE_CONSULTANT_PERSONA,
    ENABLE_TEACHER_PERSONA: FeatureFlags.ENABLE_TEACHER_PERSONA,
    // 灰度发布控制 [Phase 4 新增]
    PERSONA_ROLLOUT_PERCENTAGE: FeatureFlags.PERSONA_ROLLOUT_PERCENTAGE,
    // RAG 能力增强 [Phase 1 新增]
    ENABLE_QUERY_REWRITE: FeatureFlags.ENABLE_QUERY_REWRITE,
    ENABLE_RERANK: FeatureFlags.ENABLE_RERANK,
    ENABLE_VECTOR_CACHE: FeatureFlags.ENABLE_VECTOR_CACHE,
    // RAG 能力增强 [Phase 2 新增]
    ENABLE_PARENT_CHILD_CHUNKING: FeatureFlags.ENABLE_PARENT_CHILD_CHUNKING,
    ENABLE_RRF_FUSION: FeatureFlags.ENABLE_RRF_FUSION,
    // RAG 能力增强 [Phase 3 新增]
    ENABLE_RAG_MONITORING: FeatureFlags.ENABLE_RAG_MONITORING,
    ENABLE_RAG_EVALUATION: FeatureFlags.ENABLE_RAG_EVALUATION,
  };
}
