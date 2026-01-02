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
