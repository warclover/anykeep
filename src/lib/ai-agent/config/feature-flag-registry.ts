/**
 * Feature Flags 治理机制
 *
 * 提供 Feature Flag 注册表和验证功能，确保：
 * 1. 每个 Flag 都有明确的集成点记录
 * 2. 启用的 Flag 必须有实际的代码调用
 * 3. CI 阶段可检测未集成的 Flag
 *
 * @module @/lib/ai-agent/config/feature-flag-registry
 * @version 1.0.0
 * @since 2026-01-11
 */

import { FeatureFlags, type FeatureFlagKey } from "./feature-flags";
import { createLogger } from "@/lib/logger";

const logger = createLogger("feature-flag-registry");

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 集成点定义
 */
export interface IntegrationPoint {
  /** 文件路径（相对于 src/） */
  file: string;
  /** 调用位置描述 */
  location: string;
  /** 调用类型 */
  type: "check" | "inject" | "execute";
}

/**
 * Feature Flag 定义
 */
export interface FeatureFlagDefinition {
  /** Flag 名称 */
  name: FeatureFlagKey;
  /** 描述 */
  description: string;
  /** 默认值 */
  defaultValue: boolean | number;
  /** 所属模块 */
  module:
    | "core"
    | "task-understanding"
    | "context"
    | "memory"
    | "react"
    | "persona"
    | "rag"
    | "workflow"
    | "safety"
    | "intent"
    | "proactive";
  /** 发布阶段 */
  phase: "stable" | "beta" | "alpha" | "deprecated";
  /** 集成点列表 */
  integrationPoints: IntegrationPoint[];
  /** 依赖的其他 Flags */
  dependencies?: FeatureFlagKey[];
  /** 添加版本 */
  addedVersion?: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否通过验证 */
  valid: boolean;
  /** 警告列表 */
  warnings: ValidationWarning[];
  /** 错误列表 */
  errors: ValidationError[];
  /** 统计信息 */
  stats: ValidationStats;
}

export interface ValidationWarning {
  flag: FeatureFlagKey;
  message: string;
  suggestion?: string;
}

export interface ValidationError {
  flag: FeatureFlagKey;
  message: string;
}

export interface ValidationStats {
  totalFlags: number;
  enabledFlags: number;
  integratedFlags: number;
  deprecatedFlags: number;
  integrationRate: number;
}

// =============================================================================
// Feature Flag 注册表
// =============================================================================

/**
 * Feature Flag 注册表
 *
 * 记录所有 Feature Flags 的定义和集成点
 */
export const FEATURE_FLAG_REGISTRY: FeatureFlagDefinition[] = [
  // ===========================================================================
  // 核心功能
  // ===========================================================================
  {
    name: "ENABLE_DYNAMIC_CONTEXT",
    description: "动态上下文注入",
    defaultValue: true,
    module: "context",
    phase: "stable",
    addedVersion: "2.6.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/context/prompt-injector.ts",
        location: "mergeSystemPromptAsync()",
        type: "inject",
      },
      {
        file: "lib/ai-agent/context/dynamic-context-builder.ts",
        location: "buildDynamicContext()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_MODEL_TIERING",
    description: "模型分层策略",
    defaultValue: true,
    module: "core",
    phase: "stable",
    addedVersion: "2.6.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/core/model-selector.ts",
        location: "selectModel()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_REACT_PROMPT",
    description: "ReAct Prompt 模板",
    defaultValue: true,
    module: "react",
    phase: "stable",
    addedVersion: "2.6.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/react/react-prompt-builder.ts",
        location: "buildPrompt()",
        type: "inject",
      },
    ],
  },
  {
    name: "ENABLE_REASONING",
    description: "reasoning 参数记录",
    defaultValue: true,
    module: "core",
    phase: "stable",
    addedVersion: "2.6.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/core/knowledge-agent-stream.ts",
        location: "handleToolCall()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_ERROR_RECOVERY",
    description: "智能错误恢复",
    defaultValue: true,
    module: "core",
    phase: "stable",
    addedVersion: "2.6.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/core/error-recovery.ts",
        location: "recoverFromError()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_PREFERENCE_LEARNING",
    description: "偏好学习 V1",
    defaultValue: true,
    module: "core",
    phase: "stable",
    addedVersion: "2.6.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/preferences/learning-service.ts",
        location: "recordToolUsage()",
        type: "execute",
      },
      {
        file: "lib/ai-skills/engine/execution-coordinator.ts",
        location: "executeSkill()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_COST_CONTROL",
    description: "成本控制",
    defaultValue: true,
    module: "core",
    phase: "stable",
    addedVersion: "2.6.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/config/cost-controller.ts",
        location: "checkBudget()",
        type: "check",
      },
    ],
  },

  // ===========================================================================
  // 任务理解层
  // ===========================================================================
  {
    name: "ENABLE_TASK_UNDERSTANDING",
    description: "任务理解层总开关",
    defaultValue: true,
    module: "task-understanding",
    phase: "stable",
    addedVersion: "2.7.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/task-understanding/index.ts",
        location: "analyzeTask()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_SMART_DEFAULTS",
    description: "智能默认值",
    defaultValue: true,
    module: "task-understanding",
    phase: "stable",
    addedVersion: "2.7.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/task-understanding/defaults/smart-defaults-service.ts",
        location: "applyDefaults()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_ZERO_TAKEOVER",
    description: "零接管模式",
    defaultValue: true,
    module: "task-understanding",
    phase: "stable",
    addedVersion: "2.7.0",
    integrationPoints: [
      {
        file: "lib/ai-skills/engine/unified-engine.ts",
        location: "execute()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_UNDO_SERVICE",
    description: "撤销服务",
    defaultValue: true,
    module: "task-understanding",
    phase: "stable",
    addedVersion: "2.7.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/task-understanding/undo/undo-service.ts",
        location: "recordOperation()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_PREFERENCE_LEARNING_V2",
    description: "偏好学习 V2（从撤销/调整中学习）",
    defaultValue: true,
    module: "task-understanding",
    phase: "stable",
    addedVersion: "2.7.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/task-understanding/defaults/preference-learning-service-v2.ts",
        location: "learnFromAdjustment()",
        type: "execute",
      },
    ],
  },

  // ===========================================================================
  // 任务理解层 v2.0
  // ===========================================================================
  {
    name: "ENABLE_V2_PROMPT",
    description: "v2.0 增强版 System Prompt",
    defaultValue: true,
    module: "task-understanding",
    phase: "stable",
    addedVersion: "2.7.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/context/prompt-injector.ts",
        location: "mergeSystemPromptAsync()",
        type: "inject",
      },
    ],
  },
  {
    name: "ENABLE_CONFIDENCE_TIERING",
    description: "置信度分层执行",
    defaultValue: true,
    module: "task-understanding",
    phase: "stable",
    addedVersion: "2.7.0",
    integrationPoints: [
      {
        file: "lib/ai-skills/engine/unified-engine.ts",
        location: "executeRouted()",
        type: "check",
      },
      {
        file: "lib/ai-skills/output/adapter.ts",
        location: "formatResponse()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_IMPLICIT_INTENT",
    description: "隐含意图推断",
    defaultValue: true,
    module: "task-understanding",
    phase: "stable",
    addedVersion: "2.7.0",
    integrationPoints: [
      {
        file: "lib/ai-skills/router/intent-analyzer.ts",
        location: "analyze()",
        type: "execute",
      },
      {
        file: "lib/ai-agent/context/prompt-injector.ts",
        location: "mergeSystemPromptAsync()",
        type: "inject",
      },
    ],
  },
  {
    name: "ENABLE_SYSTEM_REMINDER",
    description: "System-Reminder 动态注入",
    defaultValue: true,
    module: "context",
    phase: "stable",
    addedVersion: "2.7.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/context/system-reminder-injector.ts",
        location: "injectReminders()",
        type: "inject",
      },
      {
        file: "lib/ai-agent/context/prompt-injector.ts",
        location: "mergeSystemPromptAsync()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_ENHANCED_CONFIDENCE",
    description: "增强置信度计算",
    defaultValue: true,
    module: "task-understanding",
    phase: "stable",
    addedVersion: "2.7.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/context/enhanced-confidence.ts",
        location: "calculateEnhancedConfidence()",
        type: "execute",
      },
      {
        file: "lib/ai-skills/engine/unified-engine.ts",
        location: "executeRouted()",
        type: "check",
      },
    ],
  },

  // ===========================================================================
  // 情景记忆
  // ===========================================================================
  {
    name: "ENABLE_EPISODIC_MEMORY",
    description: "情景记忆总开关",
    defaultValue: true,
    module: "memory",
    phase: "stable",
    addedVersion: "2.6.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/memory/episodic-memory-service.ts",
        location: "storeMemory()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_INTERACTION_LOGGING",
    description: "交互日志记录",
    defaultValue: true,
    module: "memory",
    phase: "stable",
    addedVersion: "2.6.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/memory/interaction-logger.ts",
        location: "logInteraction()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_MEMORY_PROMPT",
    description: "记忆 Prompt 注入",
    defaultValue: true,
    module: "memory",
    phase: "stable",
    addedVersion: "2.6.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/memory/memory-prompt-builder.ts",
        location: "buildMemoryPrompt()",
        type: "inject",
      },
    ],
  },
  {
    name: "ENABLE_PENDING_INTENT_REMINDER",
    description: "未完成意图提醒",
    defaultValue: true,
    module: "memory",
    phase: "stable",
    addedVersion: "2.6.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/memory/pending-intent-service.ts",
        location: "checkPendingIntents()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_CONVERSATION_COMPRESSION",
    description: "对话上下文压缩",
    defaultValue: true,
    module: "context",
    phase: "stable",
    addedVersion: "2.7.1",
    integrationPoints: [
      {
        file: "lib/ai-agent/context/conversation-compressor.ts",
        location: "compress()",
        type: "execute",
      },
    ],
  },

  // ===========================================================================
  // 对话持久化 [Phase 0 新增 - 2026-01-13]
  // ===========================================================================
  {
    name: "ENABLE_CONVERSATION_PERSISTENCE",
    description: "对话持久化（localStorage）",
    defaultValue: true,
    module: "memory",
    phase: "stable",
    addedVersion: "2.9.2",
    integrationPoints: [
      {
        file: "hooks/domain/ai/use-ai-chat.ts",
        location: "useState initialization",
        type: "execute",
      },
      {
        file: "lib/storage/conversation-storage.ts",
        location: "save/restore functions",
        type: "execute",
      },
    ],
  },

  // ===========================================================================
  // ReAct 循环
  // ===========================================================================
  {
    name: "ENABLE_REACT_LOOP",
    description: "ReAct 循环执行",
    defaultValue: false,
    module: "react",
    phase: "beta",
    addedVersion: "2.7.5",
    integrationPoints: [
      {
        file: "lib/ai-agent/react/react-loop-executor.ts",
        location: "executeLoop()",
        type: "execute",
      },
      {
        file: "lib/ai-agent/core/knowledge-agent-stream.ts",
        location: "streamResponse()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_CITATION_TRACKING",
    description: "引用追踪",
    defaultValue: true,
    module: "react",
    phase: "stable",
    addedVersion: "2.7.5",
    integrationPoints: [
      {
        file: "lib/ai-agent/citation/citation-indexer.ts",
        location: "indexSearchResults()",
        type: "execute",
      },
      {
        file: "lib/ai-agent/citation/citation-annotator.ts",
        location: "annotateCitations()",
        type: "execute",
      },
    ],
  },

  // ===========================================================================
  // 多用户画像
  // ===========================================================================
  {
    name: "ENABLE_MULTI_PERSONA",
    description: "多用户画像功能主开关",
    defaultValue: false,
    module: "persona",
    phase: "beta",
    addedVersion: "3.1.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/inference/persona-inferrer.ts",
        location: "inferPersona()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_PERSONA_INFERENCE",
    description: "画像推断引擎",
    defaultValue: true,
    module: "persona",
    phase: "stable",
    addedVersion: "3.1.0",
    dependencies: ["ENABLE_MULTI_PERSONA"],
    integrationPoints: [
      {
        file: "lib/ai-agent/inference/persona-inferrer.ts",
        location: "inferPersona()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_PERSONA_PROMPTS",
    description: "画像专属 Prompt",
    defaultValue: true,
    module: "persona",
    phase: "stable",
    addedVersion: "3.1.0",
    dependencies: ["ENABLE_MULTI_PERSONA"],
    integrationPoints: [
      {
        file: "lib/ai-agent/personas/persona-prompts.ts",
        location: "getPersonaPrompt()",
        type: "inject",
      },
    ],
  },
  {
    name: "ENABLE_PERSONA_INTENT_BOOST",
    description: "画像意图权重加成",
    defaultValue: true,
    module: "persona",
    phase: "stable",
    addedVersion: "3.1.0",
    dependencies: ["ENABLE_MULTI_PERSONA"],
    integrationPoints: [
      {
        file: "lib/ai-skills/router/intent-analyzer.ts",
        location: "boostIntentWeight()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_PERSONA_SETTINGS_UI",
    description: "画像设置 UI",
    defaultValue: false,
    module: "persona",
    phase: "alpha",
    addedVersion: "3.1.0",
    dependencies: ["ENABLE_MULTI_PERSONA"],
    integrationPoints: [
      {
        file: "components/settings/persona-settings.tsx",
        location: "PersonaSettings()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_PM_PERSONA",
    description: "产品经理画像",
    defaultValue: true,
    module: "persona",
    phase: "stable",
    addedVersion: "3.1.0",
    dependencies: ["ENABLE_MULTI_PERSONA"],
    integrationPoints: [
      {
        file: "lib/ai-agent/personas/persona-prompts.ts",
        location: "PM_PERSONA_PROMPT",
        type: "inject",
      },
    ],
  },
  {
    name: "ENABLE_CONSULTANT_PERSONA",
    description: "咨询顾问画像",
    defaultValue: true,
    module: "persona",
    phase: "stable",
    addedVersion: "3.1.0",
    dependencies: ["ENABLE_MULTI_PERSONA"],
    integrationPoints: [
      {
        file: "lib/ai-agent/personas/persona-prompts.ts",
        location: "CONSULTANT_PERSONA_PROMPT",
        type: "inject",
      },
    ],
  },
  {
    name: "ENABLE_TEACHER_PERSONA",
    description: "大学教师画像",
    defaultValue: true,
    module: "persona",
    phase: "stable",
    addedVersion: "3.1.0",
    dependencies: ["ENABLE_MULTI_PERSONA"],
    integrationPoints: [
      {
        file: "lib/ai-agent/personas/persona-prompts.ts",
        location: "TEACHER_PERSONA_PROMPT",
        type: "inject",
      },
    ],
  },

  // ===========================================================================
  // RAG 能力增强
  // ===========================================================================
  {
    name: "ENABLE_QUERY_REWRITE",
    description: "LLM 查询改写",
    defaultValue: true,
    module: "rag",
    phase: "stable",
    addedVersion: "2.8.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/query/query-rewriter.ts",
        location: "rewriteQuery()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_RERANK",
    description: "Rerank 重排序",
    defaultValue: true,
    module: "rag",
    phase: "stable",
    addedVersion: "2.8.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/rerank/dashscope-reranker.ts",
        location: "rerank()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_VECTOR_CACHE",
    description: "向量缓存",
    defaultValue: true,
    module: "rag",
    phase: "stable",
    addedVersion: "2.8.0",
    integrationPoints: [
      {
        file: "lib/embedding/vector-cache.ts",
        location: "getFromCache()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_SMART_FILTER_EXTRACTION",
    description: "智能过滤器提取",
    defaultValue: true,
    module: "rag",
    phase: "stable",
    addedVersion: "2.8.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/query/filter-extractor.ts",
        location: "extractFilters()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_PARENT_CHILD_CHUNKING",
    description: "Parent-Child 切片策略",
    defaultValue: true,
    module: "rag",
    phase: "stable",
    addedVersion: "2.8.0",
    integrationPoints: [
      {
        file: "lib/embedding/chunking/parent-child-chunker.ts",
        location: "chunk()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_HYBRID_INTENT_CLASSIFIER",
    description: "混合意图分类器",
    defaultValue: false,
    module: "intent",
    phase: "deprecated",
    addedVersion: "2.8.0",
    integrationPoints: [],
  },
  {
    name: "ENABLE_RRF_FUSION",
    description: "RRF 融合算法",
    defaultValue: true,
    module: "rag",
    phase: "stable",
    addedVersion: "2.8.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/rerank/rrf-fusion.ts",
        location: "fuse()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_RAG_MONITORING",
    description: "RAG 监控",
    defaultValue: true,
    module: "rag",
    phase: "stable",
    addedVersion: "2.8.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/rag/monitoring/rag-monitor.ts",
        location: "collectMetrics()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_RAG_EVALUATION",
    description: "RAG 评估",
    defaultValue: true,
    module: "rag",
    phase: "stable",
    addedVersion: "2.8.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/rag/evaluation/rag-evaluator.ts",
        location: "evaluate()",
        type: "execute",
      },
    ],
  },

  // ===========================================================================
  // AI 秘书进化
  // ===========================================================================
  {
    name: "ENABLE_PROACTIVE_BRIEFING",
    description: "主动简报",
    defaultValue: true,
    module: "proactive",
    phase: "stable",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/proactive-briefing/proactive-briefing-service.ts",
        location: "generateBriefing()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_GLOBAL_INSIGHT",
    description: "全局洞察",
    defaultValue: false,
    module: "proactive",
    phase: "alpha",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/global-insight/global-insight-service.ts",
        location: "generateInsight()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_CROSS_SESSION_MEMORY",
    description: "跨会话记忆",
    defaultValue: false,
    module: "memory",
    phase: "alpha",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/memory/cross-session-memory.ts",
        location: "persistMemory()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_LLM_SESSION_SUMMARY",
    description: "LLM 会话摘要",
    defaultValue: true,
    module: "memory",
    phase: "beta",
    addedVersion: "2.10.0",
    integrationPoints: [
      {
        file: "lib/ai-memory/cross-session-memory-service.ts",
        location: "saveSessionSummary()",
        type: "execute",
      },
      {
        file: "lib/ai-memory/session-summarizer.ts",
        location: "generateSessionSummary()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_SLOW_THINKING",
    description: "慢思考",
    defaultValue: false,
    module: "core",
    phase: "alpha",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/slow-thinking/slow-thinking-service.ts",
        location: "think()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_SLOW_THINKING_VISIBLE",
    description: "展示思考过程",
    defaultValue: true,
    module: "core",
    phase: "alpha",
    addedVersion: "2.9.0",
    dependencies: ["ENABLE_SLOW_THINKING"],
    integrationPoints: [
      {
        file: "components/ai/thinking-display.tsx",
        location: "ThinkingDisplay()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_INTENT_PREDICTION",
    description: "意图预测",
    defaultValue: false,
    module: "intent",
    phase: "alpha",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/intent/intent-predictor.ts",
        location: "predictNextIntent()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_RULE_LEARNING",
    description: "规则学习",
    defaultValue: false,
    module: "intent",
    phase: "alpha",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/preferences/rule-learning/rule-extractor.ts",
        location: "extractRule()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_ASYNC_ANALYSIS",
    description: "异步分析",
    defaultValue: false,
    module: "core",
    phase: "alpha",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/async-analysis/async-analysis-service.ts",
        location: "scheduleAnalysis()",
        type: "execute",
      },
    ],
  },

  // ===========================================================================
  // 工作流系统
  // ===========================================================================
  {
    name: "ENABLE_WORKFLOW_SYSTEM",
    description: "工作流系统总开关",
    defaultValue: true,
    module: "workflow",
    phase: "stable",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/workflow/workflow-engine.ts",
        location: "executeWorkflow()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_WORKFLOW_CONVERSATION_TRIGGER",
    description: "工作流对话触发",
    defaultValue: true,
    module: "workflow",
    phase: "stable",
    addedVersion: "2.9.0",
    dependencies: ["ENABLE_WORKFLOW_SYSTEM"],
    integrationPoints: [
      {
        file: "lib/workflow/conversation-trigger.ts",
        location: "detectWorkflowTrigger()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_WORKFLOW_RECOMMENDATIONS",
    description: "工作流推荐",
    defaultValue: true,
    module: "workflow",
    phase: "stable",
    addedVersion: "2.9.0",
    dependencies: ["ENABLE_WORKFLOW_SYSTEM"],
    integrationPoints: [
      {
        file: "lib/workflow/workflow-recommender.ts",
        location: "recommendWorkflows()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_WORKFLOW_NOTIFICATIONS",
    description: "工作流通知",
    defaultValue: true,
    module: "workflow",
    phase: "stable",
    addedVersion: "2.9.0",
    dependencies: ["ENABLE_WORKFLOW_SYSTEM"],
    integrationPoints: [
      {
        file: "lib/workflow/workflow-notifier.ts",
        location: "sendNotification()",
        type: "execute",
      },
    ],
  },

  // ===========================================================================
  // 高风险操作确认
  // ===========================================================================
  {
    name: "ENABLE_CONFIRMATION_INTERCEPTOR",
    description: "确认拦截器",
    defaultValue: true,
    module: "safety",
    phase: "stable",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/safety/confirmation-interceptor.ts",
        location: "intercept()",
        type: "execute",
      },
    ],
  },

  // ===========================================================================
  // 意图理解优化
  // ===========================================================================
  {
    name: "ENABLE_INTENT_CACHE_L1",
    description: "意图缓存 L1 层（精确匹配）",
    defaultValue: true,
    module: "intent",
    phase: "stable",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-skills/router/intent-analyzer.ts",
        location: "checkL1Cache()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_EARLY_RETURN",
    description: "高权重规则提前返回",
    defaultValue: true,
    module: "intent",
    phase: "stable",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-skills/router/intent-analyzer.ts",
        location: "matchRules()",
        type: "check",
      },
    ],
  },
  {
    name: "ENABLE_CLIENT_FAST_COMMANDS",
    description: "客户端快捷命令",
    defaultValue: true,
    module: "core",
    phase: "stable",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/client/fast-commands.ts",
        location: "parseCommand()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_CLIENT_PREPROCESSING",
    description: "客户端上下文预处理",
    defaultValue: true,
    module: "core",
    phase: "stable",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-agent/client/context-preprocessor.ts",
        location: "preprocessContext()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_SEMANTIC_CACHE",
    description: "意图缓存 L2 层（语义匹配）",
    defaultValue: false,
    module: "intent",
    phase: "alpha",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/ai-skills/router/semantic-cache.ts",
        location: "checkSemanticCache()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_CONFIDENCE_CALIBRATION",
    description: "置信度校准",
    defaultValue: false,
    module: "intent",
    phase: "alpha",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/classification/learning/confidence-calibrator.ts",
        location: "calibrate()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_RULE_MINING",
    description: "规则挖掘",
    defaultValue: false,
    module: "intent",
    phase: "alpha",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/classification/learning/rule-miner.ts",
        location: "mineRules()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_WEIGHT_OPTIMIZATION",
    description: "权重调优",
    defaultValue: false,
    module: "intent",
    phase: "alpha",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/classification/learning/weight-optimizer.ts",
        location: "optimize()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_FEEDBACK_COLLECTION",
    description: "反馈收集",
    defaultValue: true,
    module: "intent",
    phase: "stable",
    addedVersion: "2.9.0",
    integrationPoints: [
      {
        file: "lib/classification/learning/feedback-collector.ts",
        location: "collectFeedback()",
        type: "execute",
      },
    ],
  },

  // ===========================================================================
  // 架构优化 V4.0 [2026-01-12 新增]
  // ===========================================================================
  {
    name: "ENABLE_INTENT_DRIVEN_TOOLS",
    description: "意图驱动工具加载（L0 规则直通）",
    defaultValue: true,
    module: "intent",
    phase: "stable",
    addedVersion: "2.9.1",
    integrationPoints: [
      {
        file: "lib/ai-skills/router/intent-router.ts",
        location: "route() - Gate 0",
        type: "check",
      },
      {
        file: "lib/ai-agent/l0-rules/l0-router.ts",
        location: "tryMatch()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_CAPSULE_SYSTEM",
    description: "胶囊系统（意图驱动工具集加载）",
    defaultValue: true,
    module: "intent",
    phase: "stable",
    addedVersion: "2.9.1",
    dependencies: ["ENABLE_INTENT_DRIVEN_TOOLS"],
    integrationPoints: [
      {
        file: "lib/ai-agent/core/knowledge-agent.ts",
        location: "buildToolSet()",
        type: "execute",
      },
      {
        file: "lib/ai-agent/tools/capsules/capsule-registry.ts",
        location: "getToolsForIntent()",
        type: "execute",
      },
    ],
  },

  // ===========================================================================
  // Skills v1.1.0 新增 [P1-7 修复 - 2026-01-13]
  // ===========================================================================
  {
    name: "ENABLE_FOLDER_RECOMMEND",
    description: "文件夹智能推荐 Skill",
    defaultValue: true,
    module: "core",
    phase: "stable",
    addedVersion: "2.10.0",
    integrationPoints: [
      {
        file: "lib/ai-skills/skills/folder-recommend/folder-recommend.skill.ts",
        location: "execute()",
        type: "execute",
      },
    ],
  },
  {
    name: "ENABLE_FOLDER_HEALTH_CHECK",
    description: "文件夹健康检查 Skill",
    defaultValue: true,
    module: "core",
    phase: "stable",
    addedVersion: "2.10.0",
    integrationPoints: [
      {
        file: "lib/ai-skills/skills/folder-health-check/folder-health-check.skill.ts",
        location: "execute()",
        type: "execute",
      },
    ],
  },
  // ===========================================================================
  // 智能分类系统 v5.1
  // ===========================================================================
  {
    name: "ENABLE_AI_TAG_MATCHER",
    description:
      "AI 标签优先匹配系统 - 在 L0 规则匹配最前端使用 AI 标签进行文件夹匹配",
    defaultValue: true,
    module: "core",
    phase: "stable",
    addedVersion: "2.11.0",
    integrationPoints: [
      {
        file: "lib/classification/v5/classification-pipeline/l0-rule-matcher.ts",
        location: "constructor() - 初始化 AiTagMatcher",
        type: "check",
      },
      {
        file: "lib/classification/v5/classification-pipeline/l0-rule-matcher.ts",
        location: "match() - Phase 0 AI 标签匹配",
        type: "execute",
      },
      {
        file: "lib/classification/v5/classification-pipeline/ai-tag-matcher.ts",
        location: "match() - 执行三种匹配策略",
        type: "execute",
      },
    ],
  },
];

// =============================================================================
// 按名称索引
// =============================================================================

/**
 * 按 Flag 名称索引的注册表
 */
export const FEATURE_FLAG_REGISTRY_BY_NAME: Map<
  FeatureFlagKey,
  FeatureFlagDefinition
> = new Map(FEATURE_FLAG_REGISTRY.map((def) => [def.name, def]));

/**
 * 获取指定 Flag 的定义
 */
export function getFeatureFlagDefinition(
  name: FeatureFlagKey,
): FeatureFlagDefinition | undefined {
  return FEATURE_FLAG_REGISTRY_BY_NAME.get(name);
}

// =============================================================================
// 验证函数
// =============================================================================

/**
 * 验证所有 Feature Flags
 *
 * 检查：
 * 1. 启用的 Flag 是否有集成点
 * 2. 依赖的 Flag 是否已启用
 * 3. 废弃的 Flag 是否仍在使用
 */
export function validateFeatureFlags(): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const errors: ValidationError[] = [];

  let enabledCount = 0;
  let integratedCount = 0;
  let deprecatedCount = 0;

  for (const def of FEATURE_FLAG_REGISTRY) {
    const isEnabled =
      typeof def.defaultValue === "boolean"
        ? (FeatureFlags[def.name] as boolean)
        : true;

    if (isEnabled) {
      enabledCount++;

      // 检查是否有集成点
      if (def.integrationPoints.length === 0) {
        if (def.phase !== "deprecated") {
          warnings.push({
            flag: def.name,
            message: `Flag "${def.name}" 已启用但没有集成点`,
            suggestion: "请添加集成点或禁用此 Flag",
          });
        }
      } else {
        integratedCount++;
      }

      // 检查依赖
      if (def.dependencies) {
        for (const dep of def.dependencies) {
          const depEnabled = FeatureFlags[dep] as boolean;
          if (!depEnabled) {
            errors.push({
              flag: def.name,
              message: `Flag "${def.name}" 依赖 "${dep}"，但后者未启用`,
            });
          }
        }
      }
    }

    // 检查废弃的 Flag
    if (def.phase === "deprecated") {
      deprecatedCount++;
      if (isEnabled) {
        warnings.push({
          flag: def.name,
          message: `Flag "${def.name}" 已废弃但仍启用`,
          suggestion: "请迁移到替代方案并禁用此 Flag",
        });
      }
    }
  }

  const totalFlags = FEATURE_FLAG_REGISTRY.length;
  const integrationRate =
    enabledCount > 0 ? (integratedCount / enabledCount) * 100 : 100;

  // 输出日志
  if (warnings.length > 0 || errors.length > 0) {
    logger.warn(
      { warnings: warnings.length, errors: errors.length },
      "Feature Flags 验证发现问题",
    );

    for (const warning of warnings) {
      logger.warn(
        { suggestion: warning.suggestion },
        `[${warning.flag}] ${warning.message}`,
      );
    }

    for (const error of errors) {
      logger.error(`[${error.flag}] ${error.message}`);
    }
  } else {
    logger.info(
      {
        total: totalFlags,
        enabled: enabledCount,
        integrated: integratedCount,
        rate: `${integrationRate.toFixed(1)}%`,
      },
      "Feature Flags 验证通过",
    );
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    stats: {
      totalFlags,
      enabledFlags: enabledCount,
      integratedFlags: integratedCount,
      deprecatedFlags: deprecatedCount,
      integrationRate,
    },
  };
}

/**
 * 获取 Feature Flags 统计信息
 */
export function getFeatureFlagStats(): ValidationStats {
  const result = validateFeatureFlags();
  return result.stats;
}

/**
 * 按模块分组获取 Feature Flags
 */
export function getFeatureFlagsByModule(): Map<
  string,
  FeatureFlagDefinition[]
> {
  const grouped = new Map<string, FeatureFlagDefinition[]>();

  for (const def of FEATURE_FLAG_REGISTRY) {
    const existing = grouped.get(def.module) || [];
    existing.push(def);
    grouped.set(def.module, existing);
  }

  return grouped;
}

/**
 * 获取未集成的 Feature Flags
 */
export function getUnintegratedFlags(): FeatureFlagDefinition[] {
  return FEATURE_FLAG_REGISTRY.filter(
    (def) =>
      def.integrationPoints.length === 0 &&
      def.phase !== "deprecated" &&
      (typeof def.defaultValue === "boolean"
        ? (FeatureFlags[def.name] as boolean)
        : true),
  );
}

/**
 * 生成 Feature Flags 报告（Markdown 格式）
 */
export function generateFeatureFlagReport(): string {
  const stats = getFeatureFlagStats();
  const byModule = getFeatureFlagsByModule();
  const unintegrated = getUnintegratedFlags();

  const lines: string[] = [
    "# Feature Flags 报告",
    "",
    `> 生成时间: ${new Date().toISOString()}`,
    "",
    "## 统计概览",
    "",
    "| 指标 | 值 |",
    "|------|-----|",
    `| 总 Flags 数 | ${stats.totalFlags} |`,
    `| 已启用 | ${stats.enabledFlags} |`,
    `| 已集成 | ${stats.integratedFlags} |`,
    `| 已废弃 | ${stats.deprecatedFlags} |`,
    `| 集成率 | ${stats.integrationRate.toFixed(1)}% |`,
    "",
  ];

  // 按模块分组
  lines.push("## 按模块分组", "");

  for (const [module, flags] of byModule) {
    lines.push(`### ${module}`, "");
    lines.push("| Flag | 默认值 | 阶段 | 集成点数 |");
    lines.push("|------|--------|------|----------|");

    for (const flag of flags) {
      const enabled =
        typeof flag.defaultValue === "boolean" ? flag.defaultValue : "-";
      lines.push(
        `| \`${flag.name}\` | ${enabled} | ${flag.phase} | ${flag.integrationPoints.length} |`,
      );
    }

    lines.push("");
  }

  // 未集成的 Flags
  if (unintegrated.length > 0) {
    lines.push("## ⚠️ 未集成的 Flags", "");
    lines.push("以下 Flags 已启用但没有集成点：", "");

    for (const flag of unintegrated) {
      lines.push(`- \`${flag.name}\`: ${flag.description}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}
