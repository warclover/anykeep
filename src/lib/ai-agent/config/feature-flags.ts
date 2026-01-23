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
  // 对话持久化相关开关 [Phase 0 新增 - 2026-01-13]
  // ===========================================================================

  /**
   * 是否启用对话持久化
   * @default true
   * @description 将当前会话保存到 localStorage，页面刷新不丢失对话
   */
  get ENABLE_CONVERSATION_PERSISTENCE(): boolean {
    return process.env.ENABLE_CONVERSATION_PERSISTENCE !== "false";
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
   * @default true
   * @description 使用 LLM 对用户查询进行语义扩展和同义词补充
   */
  get ENABLE_QUERY_REWRITE(): boolean {
    return process.env.ENABLE_QUERY_REWRITE !== "false";
  },

  /**
   * 是否启用 Rerank 重排序
   * @default true
   * @description 使用交叉编码器对搜索结果进行语义重排序
   */
  get ENABLE_RERANK(): boolean {
    return process.env.ENABLE_RERANK !== "false";
  },

  /**
   * 是否启用向量缓存
   * @default true
   * @description 缓存常用查询的向量表示，提升搜索速度
   */
  get ENABLE_VECTOR_CACHE(): boolean {
    return process.env.ENABLE_VECTOR_CACHE !== "false";
  },

  /**
   * 是否启用智能过滤器提取
   * @default true
   * @description 从自然语言查询中自动提取结构化过滤条件（时间、平台、标签等）
   */
  get ENABLE_SMART_FILTER_EXTRACTION(): boolean {
    return process.env.ENABLE_SMART_FILTER_EXTRACTION !== "false";
  },

  // ===========================================================================
  // RAG 能力增强 [Phase 2 新增]
  // ===========================================================================

  /**
   * 是否启用 Parent-Child 切片策略
   * @default true
   * @description 长文档切片为 Parent-Child 结构，提升精准检索能力
   */
  get ENABLE_PARENT_CHILD_CHUNKING(): boolean {
    return process.env.ENABLE_PARENT_CHILD_CHUNKING !== "false";
  },

  /**
   * 是否启用 RRF 融合算法
   * @default true
   * @description Reciprocal Rank Fusion 合并多来源搜索结果
   */
  get ENABLE_RRF_FUSION(): boolean {
    return process.env.ENABLE_RRF_FUSION !== "false";
  },

  // ===========================================================================
  // RAG 能力增强 [Phase 3 新增]
  // ===========================================================================

  /**
   * 是否启用 RAG 监控
   * @default true
   * @description 启用 RAG 系统指标收集和告警
   */
  get ENABLE_RAG_MONITORING(): boolean {
    return process.env.ENABLE_RAG_MONITORING !== "false";
  },

  /**
   * 是否启用 RAG 评估
   * @default true
   * @description 启用 RAGAS 风格的 RAG 质量评估
   */
  get ENABLE_RAG_EVALUATION(): boolean {
    return process.env.ENABLE_RAG_EVALUATION !== "false";
  },

  // ===========================================================================
  // AI 秘书进化 [Phase 0 新增]
  // ===========================================================================

  /**
   * 是否启用主动简报
   * @default true
   * @description 用户上线后主动推送离线期间的变化摘要和建议操作
   */
  get ENABLE_PROACTIVE_BRIEFING(): boolean {
    return process.env.ENABLE_PROACTIVE_BRIEFING !== "false";
  },

  /**
   * 是否启用全局洞察
   * @default false
   * @description 生成用户知识库的宏观画像
   */
  get ENABLE_GLOBAL_INSIGHT(): boolean {
    return process.env.ENABLE_GLOBAL_INSIGHT === "true";
  },

  /**
   * 是否启用跨会话记忆
   * @default false
   * @description 跨会话保持对话上下文
   */
  get ENABLE_CROSS_SESSION_MEMORY(): boolean {
    return process.env.ENABLE_CROSS_SESSION_MEMORY === "true";
  },

  /**
   * 是否启用 LLM 会话摘要
   * @default true
   * @description 使用 LLM 生成智能会话摘要（含待办、偏好提取）
   * @since 2026-01-13 P2
   */
  get ENABLE_LLM_SESSION_SUMMARY(): boolean {
    return process.env.ENABLE_LLM_SESSION_SUMMARY !== "false";
  },

  /**
   * 是否启用慢思考
   * @default false
   * @description System 2 深度推理，生成内心独白
   */
  get ENABLE_SLOW_THINKING(): boolean {
    return process.env.ENABLE_SLOW_THINKING === "true";
  },

  /**
   * 是否向用户展示思考过程
   * @default true
   * @description 当慢思考启用时，是否在 UI 展示思考过程
   */
  get ENABLE_SLOW_THINKING_VISIBLE(): boolean {
    return process.env.ENABLE_SLOW_THINKING_VISIBLE !== "false";
  },

  /**
   * 是否启用意图预测
   * @default false
   * @description 基于历史行为预测用户下一步意图
   */
  get ENABLE_INTENT_PREDICTION(): boolean {
    return process.env.ENABLE_INTENT_PREDICTION === "true";
  },

  /**
   * 是否启用混合意图分类器（规则 + 语义匹配）
   * @default false
   * @description Phase 1: 混合意图识别，提升准确率到 ~85%
   */
  get ENABLE_HYBRID_INTENT_CLASSIFIER(): boolean {
    return process.env.ENABLE_HYBRID_INTENT_CLASSIFIER === "true";
  },

  /**
   * 是否启用规则学习
   * @default false
   * @description 从用户纠正行为中自动学习规则
   */
  get ENABLE_RULE_LEARNING(): boolean {
    return process.env.ENABLE_RULE_LEARNING === "true";
  },

  /**
   * 是否启用异步分析
   * @default false
   * @description 后台异步执行分析任务
   */
  get ENABLE_ASYNC_ANALYSIS(): boolean {
    return process.env.ENABLE_ASYNC_ANALYSIS === "true";
  },

  // ===========================================================================
  // 工作流系统 [Phase 3 新增]
  // ===========================================================================

  /**
   * 是否启用工作流系统
   * @default true
   * @description 工作流系统总开关
   */
  get ENABLE_WORKFLOW_SYSTEM(): boolean {
    return process.env.ENABLE_WORKFLOW_SYSTEM !== "false";
  },

  /**
   * 是否启用工作流对话触发
   * @default true
   * @description 允许用户通过对话触发工作流
   */
  get ENABLE_WORKFLOW_CONVERSATION_TRIGGER(): boolean {
    return process.env.ENABLE_WORKFLOW_CONVERSATION_TRIGGER !== "false";
  },

  /**
   * 是否启用工作流推荐
   * @default true
   * @description 基于用户状态主动推荐工作流
   */
  get ENABLE_WORKFLOW_RECOMMENDATIONS(): boolean {
    return process.env.ENABLE_WORKFLOW_RECOMMENDATIONS !== "false";
  },

  /**
   * 是否启用工作流通知
   * @default true
   * @description 工作流完成后发送通知
   */
  get ENABLE_WORKFLOW_NOTIFICATIONS(): boolean {
    return process.env.ENABLE_WORKFLOW_NOTIFICATIONS !== "false";
  },

  // ===========================================================================
  // 高风险操作确认 [Phase 1 新增]
  // ===========================================================================

  /**
   * 是否启用确认拦截器
   * @default true
   * @description 高风险操作（删除、批量操作等）执行前需要用户确认
   */
  get ENABLE_CONFIRMATION_INTERCEPTOR(): boolean {
    return process.env.ENABLE_CONFIRMATION_INTERCEPTOR !== "false";
  },

  // ===========================================================================
  // 意图理解优化 [Phase 1 新增 - 2026-01-11]
  // ===========================================================================

  /**
   * 是否启用意图缓存 L1 层（精确匹配）
   * @default true
   * @description LRU 缓存，精确匹配用户消息
   */
  get ENABLE_INTENT_CACHE_L1(): boolean {
    return process.env.ENABLE_INTENT_CACHE_L1 !== "false";
  },

  /**
   * 是否启用高权重规则提前返回
   * @default true
   * @description 权重 ≥95 且置信度 ≥0.9 时跳过剩余规则遍历
   */
  get ENABLE_EARLY_RETURN(): boolean {
    return process.env.ENABLE_EARLY_RETURN !== "false";
  },

  /**
   * 是否启用客户端快捷命令
   * @default true
   * @description /search, /delete 等快捷命令直接执行，不经过 AI
   */
  get ENABLE_CLIENT_FAST_COMMANDS(): boolean {
    return process.env.ENABLE_CLIENT_FAST_COMMANDS !== "false";
  },

  /**
   * 是否启用客户端上下文预处理
   * @default true
   * @description 发送前压缩书签上下文，减少 Token 消耗
   */
  get ENABLE_CLIENT_PREPROCESSING(): boolean {
    return process.env.ENABLE_CLIENT_PREPROCESSING !== "false";
  },

  /**
   * 是否启用意图缓存 L2 层（语义匹配）
   * @default false
   * @description pgvector 语义缓存，相似度 > 阈值时命中（Phase 2）
   */
  get ENABLE_SEMANTIC_CACHE(): boolean {
    return process.env.ENABLE_SEMANTIC_CACHE === "true";
  },

  /**
   * 语义缓存相似度阈值
   * @default 0.95
   * @description 相似度高于此值时认为是相同意图
   */
  get SEMANTIC_CACHE_SIMILARITY(): number {
    return parseFloat(process.env.SEMANTIC_CACHE_SIMILARITY || "0.95");
  },

  // ===========================================================================
  // 意图理解优化 [Phase 3 新增 - 2026-01-11]
  // ===========================================================================

  /**
   * 是否启用置信度校准
   * @default false
   * @description 使用 Platt Scaling 校准原始置信度
   */
  get ENABLE_CONFIDENCE_CALIBRATION(): boolean {
    return process.env.ENABLE_CONFIDENCE_CALIBRATION === "true";
  },

  // ===========================================================================
  // 架构优化 V4.0 [Phase 1 新增 - 2026-01-12]
  // ===========================================================================

  /**
   * 是否启用意图驱动工具加载
   * @default true
   * @description 根据意图类型动态加载相关工具，减少 Token 消耗
   */
  get ENABLE_INTENT_DRIVEN_TOOLS(): boolean {
    return process.env.ENABLE_INTENT_DRIVEN_TOOLS !== "false";
  },

  /**
   * 是否启用胶囊系统
   * @default true
   * @description 使用静态胶囊映射作为工具选择策略，基于意图类型动态加载相关工具集
   */
  get ENABLE_CAPSULE_SYSTEM(): boolean {
    return process.env.ENABLE_CAPSULE_SYSTEM !== "false";
  },

  /**
   * 是否启用规则挖掘
   * @default false
   * @description 从 LLM 兜底案例中自动生成候选规则
   */
  get ENABLE_RULE_MINING(): boolean {
    return process.env.ENABLE_RULE_MINING === "true";
  },

  /**
   * 是否启用权重调优
   * @default false
   * @description 基于用户反馈自动调整规则权重
   */
  get ENABLE_WEIGHT_OPTIMIZATION(): boolean {
    return process.env.ENABLE_WEIGHT_OPTIMIZATION === "true";
  },

  /**
   * 是否启用反馈收集
   * @default true
   * @description 收集用户对意图分类的反馈（隐式 + 显式）
   */
  get ENABLE_FEEDBACK_COLLECTION(): boolean {
    return process.env.ENABLE_FEEDBACK_COLLECTION !== "false";
  },

  // ===========================================================================
  // Skills v1.1.0 新增 Feature Flags [P1-7 修复 - 2026-01-13]
  // ===========================================================================

  /**
   * 是否启用文件夹智能推荐 Skill
   * @default true
   * @description 基于内容和使用习惯推荐最佳文件夹结构
   */
  get ENABLE_FOLDER_RECOMMEND(): boolean {
    return process.env.ENABLE_FOLDER_RECOMMEND !== "false";
  },

  /**
   * 是否启用搜索优化助手 Skill
   * @default true
   * @description 分析搜索词，提供优化建议和技巧
   */
  get ENABLE_SEARCH_OPTIMIZE(): boolean {
    return process.env.ENABLE_SEARCH_OPTIMIZE !== "false";
  },

  /**
   * 是否启用知识图谱探索 Skill
   * @default true
   * @description 可视化知识关联，发现学习盲区
   */
  get ENABLE_KNOWLEDGE_GRAPH_EXPLORE(): boolean {
    return process.env.ENABLE_KNOWLEDGE_GRAPH_EXPLORE !== "false";
  },

  /**
   * 是否启用文件夹健康检查 Skill
   * @default true
   * @description 分析文件夹结构，发现问题并优化建议
   */
  get ENABLE_FOLDER_HEALTH_CHECK(): boolean {
    return process.env.ENABLE_FOLDER_HEALTH_CHECK !== "false";
  },

  /**
   * 是否启用快照对比分析 Skill
   * @default true
   * @description 对比页面快照，检测内容变化
   */
  get ENABLE_SNAPSHOT_COMPARE(): boolean {
    return process.env.ENABLE_SNAPSHOT_COMPARE !== "false";
  },

  // ===========================================================================
  // 智能分类系统 [v5.1 新增 - 2026-01-23]
  // ===========================================================================

  /**
   * 是否启用 AI 标签优先匹配
   * @default true
   * @description 在 L0 规则匹配最前端，使用 AI 标签与文件夹进行匹配
   */
  get ENABLE_AI_TAG_MATCHER(): boolean {
    return process.env.ENABLE_AI_TAG_MATCHER !== "false";
  },
} as const;

// =============================================================================
// 类型导出
// =============================================================================

export type FeatureFlagKey = keyof typeof FeatureFlags;

/** 布尔类型的功能开关键（排除数值型配置） */
export type BooleanFeatureFlagKey = Exclude<
  FeatureFlagKey,
  "PERSONA_ROLLOUT_PERCENTAGE" | "SEMANTIC_CACHE_SIMILARITY"
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
  SEMANTIC_CACHE_SIMILARITY: number;
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
    // 对话持久化 [Phase 0 新增 - 2026-01-13]
    ENABLE_CONVERSATION_PERSISTENCE:
      FeatureFlags.ENABLE_CONVERSATION_PERSISTENCE,
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
    ENABLE_SMART_FILTER_EXTRACTION: FeatureFlags.ENABLE_SMART_FILTER_EXTRACTION,
    // RAG 能力增强 [Phase 2 新增]
    ENABLE_PARENT_CHILD_CHUNKING: FeatureFlags.ENABLE_PARENT_CHILD_CHUNKING,
    ENABLE_RRF_FUSION: FeatureFlags.ENABLE_RRF_FUSION,
    // 意图映射优化 [Phase 1 新增]
    ENABLE_HYBRID_INTENT_CLASSIFIER:
      FeatureFlags.ENABLE_HYBRID_INTENT_CLASSIFIER,
    // RAG 能力增强 [Phase 3 新增]
    ENABLE_RAG_MONITORING: FeatureFlags.ENABLE_RAG_MONITORING,
    ENABLE_RAG_EVALUATION: FeatureFlags.ENABLE_RAG_EVALUATION,
    // AI 秘书进化 [Phase 0 新增]
    ENABLE_PROACTIVE_BRIEFING: FeatureFlags.ENABLE_PROACTIVE_BRIEFING,
    ENABLE_GLOBAL_INSIGHT: FeatureFlags.ENABLE_GLOBAL_INSIGHT,
    ENABLE_CROSS_SESSION_MEMORY: FeatureFlags.ENABLE_CROSS_SESSION_MEMORY,
    ENABLE_LLM_SESSION_SUMMARY: FeatureFlags.ENABLE_LLM_SESSION_SUMMARY,
    ENABLE_SLOW_THINKING: FeatureFlags.ENABLE_SLOW_THINKING,
    ENABLE_SLOW_THINKING_VISIBLE: FeatureFlags.ENABLE_SLOW_THINKING_VISIBLE,
    ENABLE_INTENT_PREDICTION: FeatureFlags.ENABLE_INTENT_PREDICTION,
    ENABLE_RULE_LEARNING: FeatureFlags.ENABLE_RULE_LEARNING,
    ENABLE_ASYNC_ANALYSIS: FeatureFlags.ENABLE_ASYNC_ANALYSIS,
    // 工作流系统 [Phase 3 新增]
    ENABLE_WORKFLOW_SYSTEM: FeatureFlags.ENABLE_WORKFLOW_SYSTEM,
    ENABLE_WORKFLOW_CONVERSATION_TRIGGER:
      FeatureFlags.ENABLE_WORKFLOW_CONVERSATION_TRIGGER,
    ENABLE_WORKFLOW_RECOMMENDATIONS:
      FeatureFlags.ENABLE_WORKFLOW_RECOMMENDATIONS,
    ENABLE_WORKFLOW_NOTIFICATIONS: FeatureFlags.ENABLE_WORKFLOW_NOTIFICATIONS,
    // 高风险操作确认 [Phase 1 新增]
    ENABLE_CONFIRMATION_INTERCEPTOR:
      FeatureFlags.ENABLE_CONFIRMATION_INTERCEPTOR,
    // 意图理解优化 [Phase 1 新增 - 2026-01-11]
    ENABLE_INTENT_CACHE_L1: FeatureFlags.ENABLE_INTENT_CACHE_L1,
    ENABLE_EARLY_RETURN: FeatureFlags.ENABLE_EARLY_RETURN,
    ENABLE_CLIENT_FAST_COMMANDS: FeatureFlags.ENABLE_CLIENT_FAST_COMMANDS,
    ENABLE_CLIENT_PREPROCESSING: FeatureFlags.ENABLE_CLIENT_PREPROCESSING,
    ENABLE_SEMANTIC_CACHE: FeatureFlags.ENABLE_SEMANTIC_CACHE,
    SEMANTIC_CACHE_SIMILARITY: FeatureFlags.SEMANTIC_CACHE_SIMILARITY,
    // 意图理解优化 [Phase 3 新增 - 2026-01-11]
    ENABLE_CONFIDENCE_CALIBRATION: FeatureFlags.ENABLE_CONFIDENCE_CALIBRATION,
    ENABLE_RULE_MINING: FeatureFlags.ENABLE_RULE_MINING,
    ENABLE_WEIGHT_OPTIMIZATION: FeatureFlags.ENABLE_WEIGHT_OPTIMIZATION,
    ENABLE_FEEDBACK_COLLECTION: FeatureFlags.ENABLE_FEEDBACK_COLLECTION,
    // 架构优化 V4.0 [Phase 1 新增 - 2026-01-12]
    ENABLE_INTENT_DRIVEN_TOOLS: FeatureFlags.ENABLE_INTENT_DRIVEN_TOOLS,
    ENABLE_CAPSULE_SYSTEM: FeatureFlags.ENABLE_CAPSULE_SYSTEM,
    // Skills v1.1.0 新增 [P1-7 修复 - 2026-01-13]
    ENABLE_FOLDER_RECOMMEND: FeatureFlags.ENABLE_FOLDER_RECOMMEND,
    ENABLE_SEARCH_OPTIMIZE: FeatureFlags.ENABLE_SEARCH_OPTIMIZE,
    ENABLE_KNOWLEDGE_GRAPH_EXPLORE: FeatureFlags.ENABLE_KNOWLEDGE_GRAPH_EXPLORE,
    ENABLE_FOLDER_HEALTH_CHECK: FeatureFlags.ENABLE_FOLDER_HEALTH_CHECK,
    ENABLE_SNAPSHOT_COMPARE: FeatureFlags.ENABLE_SNAPSHOT_COMPARE,
    // 智能分类系统 [v5.1 新增 - 2026-01-23]
    ENABLE_AI_TAG_MATCHER: FeatureFlags.ENABLE_AI_TAG_MATCHER,
  };
}

// =============================================================================
// 工作流便捷函数
// =============================================================================

/**
 * 检查工作流系统是否启用
 */
export function isWorkflowEnabled(): boolean {
  return FeatureFlags.ENABLE_WORKFLOW_SYSTEM;
}

/**
 * 检查工作流对话触发是否启用
 */
export function isWorkflowConversationTriggerEnabled(): boolean {
  return (
    FeatureFlags.ENABLE_WORKFLOW_SYSTEM &&
    FeatureFlags.ENABLE_WORKFLOW_CONVERSATION_TRIGGER
  );
}

/**
 * 检查工作流推荐是否启用
 */
export function isWorkflowRecommendationsEnabled(): boolean {
  return (
    FeatureFlags.ENABLE_WORKFLOW_SYSTEM &&
    FeatureFlags.ENABLE_WORKFLOW_RECOMMENDATIONS
  );
}

/**
 * 检查工作流通知是否启用
 */
export function isWorkflowNotificationsEnabled(): boolean {
  return (
    FeatureFlags.ENABLE_WORKFLOW_SYSTEM &&
    FeatureFlags.ENABLE_WORKFLOW_NOTIFICATIONS
  );
}
