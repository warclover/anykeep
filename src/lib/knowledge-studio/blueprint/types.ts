/**
 * Blueprint Engine - 类型定义
 * @module knowledge-studio/blueprint
 */

import type {
  BlueprintType,
  BlueprintConfig,
  BlueprintMetadata,
  Citation,
  GenerationStage,
  StreamChunk,
  RecoverableError,
} from "../types";

// ============================================================
// Enhanced Blueprint System Types (v2.0)
// ============================================================

/**
 * Briefing 问题输入类型
 */
export type BriefingQuestionType =
  | "text" // 文本输入
  | "single_choice" // 单选
  | "multi_choice" // 多选
  | "scale"; // 数值刻度

/**
 * Briefing 问题语义类别 (Story 1.5)
 *
 * 定义问题收集的信息类型：
 * - audience: 目标读者/受众
 * - objective: 生成目标/目的
 * - tone: 语气/风格
 * - constraint: 约束条件/限制
 * - context: 背景信息/上下文
 * - custom: 自定义问题类别
 */
export type BriefingQuestionCategory =
  | "audience" // 目标读者
  | "objective" // 生成目标
  | "tone" // 语气风格
  | "constraint" // 约束条件
  | "context" // 背景信息
  | "custom"; // 自定义

/**
 * Briefing 问题定义
 * 用于在生成前收集用户上下文信息
 */
export interface BriefingQuestion {
  /** 问题唯一标识 */
  id: string;
  /** 问题输入类型 */
  type: BriefingQuestionType;
  /** 问题语义类别 (Story 1.5) */
  category?: BriefingQuestionCategory;
  /** 问题文本 */
  question: string;
  /** 占位符提示 */
  placeholder?: string;
  /** 选项列表（用于 single_choice/multi_choice） */
  options?: Array<{
    value: string;
    label: string;
    /** 选项描述（可选） */
    description?: string;
  }>;
  /** 刻度配置（用于 scale） */
  scaleConfig?: {
    min: number;
    max: number;
    step: number;
    labels?: Record<number, string>;
  };
  /** 是否必填 */
  required: boolean;
  /** 默认值 */
  defaultValue?: string | string[] | number;
  /** 问题帮助提示 */
  helpText?: string;
  /** 是否为条件问题（动态生成，Story 1.6） */
  isConditional?: boolean;
}

// ============================================================
// Story 1.6: 动态问题生成类型
// ============================================================

/**
 * 素材分析结果
 * 用于判断是否需要生成动态问题
 */
export interface MaterialAnalysisResult {
  /** 素材是否缺少代码示例 */
  missingCode: boolean;
  /** 素材是否缺少具体数据 */
  missingData: boolean;
  /** 素材是否缺少来源引用 */
  missingCitations: boolean;
  /** 素材是否缺少时间信息 */
  missingTimeContext: boolean;
  /** 素材的主要语言 */
  primaryLanguage?: "zh" | "en" | "mixed";
  /** 素材的主要领域 */
  primaryDomain?: string;
  /** 素材总字数 */
  totalWordCount: number;
  /** 检测到的关键词 */
  detectedKeywords: string[];
}

/**
 * 条件问题规则
 * 定义在什么条件下生成什么问题
 */
export interface ConditionalQuestionRule {
  /** 规则ID */
  id: string;
  /** 规则名称（用于调试） */
  name: string;
  /** 条件判断函数 */
  condition: (analysis: MaterialAnalysisResult) => boolean;
  /** 生成的问题模板 */
  questionTemplate: Omit<BriefingQuestion, "id" | "isConditional">;
  /** 规则优先级（数字越小越优先） */
  priority: number;
}

// ============================================================
// Story 1.9: 生成模式类型
// ============================================================

/**
 * 生成模式
 * - quick: 快速模式，跳过 Briefing
 * - guided: 引导模式，完成 Briefing 问答
 */
export type GenerationMode = "quick" | "guided";

/**
 * 生成请求配置
 */
export interface GenerationRequest {
  /** 生成模式 */
  mode: GenerationMode;
  /** Briefing 上下文（guided 模式必填） */
  briefingContext?: BriefingContext;
  /** 素材列表 */
  materials: MaterialInput[];
  /** 用户自定义提示 */
  customPrompt?: string;
  /** 目标长度 */
  targetLength?: "short" | "medium" | "long";
}

/**
 * Briefing 配置
 */
export interface BriefingConfig {
  /** 是否启用 Briefing */
  enabled: boolean;
  /** 最大问题数量（硬限制：3） */
  maxQuestions: 1 | 2 | 3;
  /** 静态问题定义 */
  questions: BriefingQuestion[];
  /** 条件问题规则（Story 1.6） */
  conditionalRules?: ConditionalQuestionRule[];
}

/**
 * Briefing 上下文 - 用户回答
 */
export interface BriefingContext {
  /** 问题ID到回答的映射 */
  answers: Record<string, string | string[] | number>;
  /** 回答时间戳 */
  answeredAt: Date;
}

/**
 * 增强蓝图输入
 */
export interface EnhancedBlueprintInput {
  /** 素材列表 */
  materials: MaterialInput[];
  /** Briefing 上下文（可选，如果启用了 Briefing） */
  briefingContext?: BriefingContext;
  /** 用户自定义提示 */
  customPrompt?: string;
  /** 目标长度 */
  targetLength?: "short" | "medium" | "long";
  /** 请求元数据 */
  requestMetadata?: {
    requestId: string;
    userId: string;
    sessionId?: string;
  };
}

/**
 * 结构化输出基础类型
 * 所有蓝图输出必须继承此类型
 */
export interface StructuredOutput {
  /** 输出版本 */
  version: string;
  /** 生成时间戳 */
  generatedAt: Date;
  /** 使用的蓝图ID */
  blueprintId: string;
  /** 引用列表 */
  citations?: Citation[];
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 大纲节点
 */
export interface OutlineNode {
  /** 节点ID */
  id: string;
  /** 节点标题 */
  title: string;
  /** 节点级别 (1-3) */
  level: 1 | 2 | 3;
  /** 节点描述/要点 */
  description?: string;
  /** 子节点 */
  children?: OutlineNode[];
  /** 预估字数 */
  estimatedWords?: number;
}

/**
 * 大纲结构
 */
export interface BlueprintOutline {
  /** 大纲标题 */
  title: string;
  /** 大纲摘要 */
  summary: string;
  /** 节点列表 */
  nodes: OutlineNode[];
  /** 总预估字数 */
  totalEstimatedWords: number;
  /** 大纲生成模型 */
  generatedBy: string;
}

/**
 * 蓝图权限层级
 */
export type BlueprintTier = "free" | "pro" | "enterprise";

/**
 * 目标用户群体
 */
export type TargetUserGroup =
  | "ai_blogger" // AI 博主
  | "tech_writer" // 技术作者
  | "product_manager" // 产品经理
  | "developer" // 开发者
  | "architect" // 架构师
  | "researcher" // 研究员
  | "content_creator" // 内容创作者
  | "marketer" // 营销人员
  | "analyst" // 分析师
  | "entrepreneur" // 创业者
  | "investor" // 投资人
  | "journalist" // 记者
  | "podcaster" // 播客主持人
  | "writer" // 作者
  | "video_creator" // 视频创作者
  | "educator" // 教育者/培训师
  | "academic" // 学术研究者
  | "student" // 学生
  | "blogger" // 博主
  | "tech_lead" // 技术负责人
  | "trainer" // 培训师
  | "facilitator" // 引导师
  | "general"; // 通用

/**
 * 增强蓝图元数据
 */
export interface EnhancedBlueprintMetadata {
  // ========== 必需字段 (Story 1.2 AC) ==========

  /** 蓝图ID */
  blueprintId: string;
  /** 蓝图显示名称 */
  displayName: string;
  /** 蓝图描述 */
  description: string;
  /** 蓝图图标 (emoji) */
  icon: string;
  /** 权限层级 */
  tier: BlueprintTier;
  /** 目标用户群体 */
  targetUsers: TargetUserGroup[];

  // ========== 可选字段 (Story 1.2 AC) ==========

  /** 蓝图分类 */
  category?:
    | "geek"
    | "creator"
    | "business"
    | "tech"
    | "classic"
    | "professional"
    | "custom";
  /** 优先级排序 (数字越小越靠前) */
  priority?: number;
  /** 是否为新蓝图 (用于标记 NEW 徽章) */
  isNew?: boolean;

  // ========== 配额字段 (Story 8.1) ==========

  /**
   * 蓝图消耗配额点数
   * 增强蓝图每次生成消耗 2-3 个配额点数
   * 根据蓝图复杂度和输出质量设定
   */
  creditsCost: number;

  // ========== 扩展字段 ==========

  /** 是否为 Geek 蓝图 (P0) */
  isGeek: boolean;
  /** 预估生成时间（秒） */
  estimatedTimeSeconds: number;
  /** 是否支持大纲模式 */
  supportsOutline: boolean;
  /** 是否启用 Briefing */
  briefingEnabled: boolean;
  /** Briefing 问题数量 */
  briefingQuestionCount: number;
  /** 蓝图标签 (用于搜索和过滤) */
  tags?: string[];
  /** 使用示例/模板 */
  examplePrompts?: string[];
}

/**
 * 蓝图生成上下文
 */
export interface GenerationContext {
  requestId: string;
  userId: string;
  config: BlueprintConfig;
  materials: MaterialInput[];
  customPrompt?: string;
}

/**
 * 素材输入
 */
export interface MaterialInput {
  bookmarkId: string;
  title: string;
  content: string;
  url: string;
  platform?: string;
}

/**
 * 蓝图生成器配置
 */
export interface BlueprintEngineConfig {
  maxContextTokens: number;
  defaultTargetLength: "short" | "medium" | "long";
  enableCitationTracking: boolean;
  streamingEnabled: boolean;
}

/**
 * 生成进度回调
 */
export type ProgressCallback = (chunk: StreamChunk) => void;

/**
 * 蓝图生成结果
 */
export interface GenerationResult {
  success: boolean;
  content?: string;
  citations?: Citation[];
  metadata?: BlueprintMetadata;
  error?: RecoverableError;
}

/**
 * 长度指南配置
 */
export interface LengthGuideline {
  minWords: number;
  maxWords: number;
  paragraphs: number;
}

/**
 * 蓝图 Prompt 模板
 * 支持两种结构：
 * - 旧版：systemPrompt + userPromptTemplate + outputFormat
 * - 新版：systemPrompt + outlinePrompt + contentPrompt + lengthGuidelines
 */
export interface BlueprintPromptTemplate {
  type: BlueprintType;
  systemPrompt: string;
  // 新版结构（推荐）
  name?: string;
  description?: string;
  isPro?: boolean;
  outlinePrompt?: string;
  contentPrompt?: string;
  lengthGuidelines?: {
    short: LengthGuideline;
    medium: LengthGuideline;
    long: LengthGuideline;
  };
  // 旧版结构（向后兼容）
  userPromptTemplate?: string;
  outputFormat?: string;
  examples?: string;
}

/**
 * 阶段进度信息
 */
export interface StageProgress {
  stage: GenerationStage;
  stageProgress: number;
  totalProgress: number;
  message?: string;
}

/**
 * 蓝图类型显示配置
 */
export const BLUEPRINT_DISPLAY_CONFIG: Record<
  BlueprintType,
  {
    name: string;
    description: string;
    icon: string;
    estimatedTime: string;
  }
> = {
  debater: {
    name: "辩论家",
    description: "正反论证，引用支撑",
    icon: "⚖️",
    estimatedTime: "30-60秒",
  },
  blogger: {
    name: "博主",
    description: "个人化叙事，融合观点",
    icon: "✍️",
    estimatedTime: "20-40秒",
  },
  thread: {
    name: "推文串",
    description: "分段式内容，渐进展开",
    icon: "🧵",
    estimatedTime: "15-30秒",
  },
  tutorial: {
    name: "教程",
    description: "步骤化讲解，代码示例",
    icon: "📚",
    estimatedTime: "40-80秒",
  },
  feynman: {
    name: "费曼",
    description: "简化解释，类比丰富",
    icon: "🎓",
    estimatedTime: "25-50秒",
  },
};
