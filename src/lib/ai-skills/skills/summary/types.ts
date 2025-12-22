/**
 * SummarySkill 类型定义
 *
 * 使用简化的自包含类型，避免与外部类型系统耦合
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

/**
 * 摘要模式
 */
export type SummaryMode = "standard" | "enhanced";

/**
 * 情感倾向
 */
export type Sentiment = "positive" | "neutral" | "negative";

/**
 * 摘要输入参数
 */
export interface SummarySkillInput {
  /** 书签 ID（用于更新已有书签的摘要） */
  bookmarkId?: number;
  /** 书签标题 */
  title: string;
  /** 书签 URL */
  url?: string;
  /** 书签描述 */
  description?: string;
  /** 正文内容（可选，用于更精准的摘要） */
  content?: string;
  /** 摘要模式 */
  mode?: SummaryMode;
  /** 是否需要分类 */
  needsClassification?: boolean;
}

/**
 * 结构化摘要（简化版）
 */
export interface SkillStructuredSummary {
  /** 一句话总结 */
  tldr?: string;
  /** 关键要点 */
  keyPoints?: string[];
  /** 关键词/标签 */
  keywords?: string[];
  /** 情感倾向 */
  sentiment?: Sentiment;
  /** 预计阅读时间（分钟） */
  readingTime?: number;
  /** 可执行行动项 */
  actionItems?: string[];
}

/**
 * 提取的实体（简化版）
 */
export interface SkillEntity {
  /** 实体名称 */
  name: string;
  /** 实体类型 */
  type: string;
  /** 置信度 */
  confidence?: number;
}

/**
 * 关键数据项
 */
export interface SkillKeyDataItem {
  /** 标签 */
  label: string;
  /** 值 */
  value: string;
  /** 单位 */
  unit?: string;
}

/**
 * 增强摘要数据
 */
export interface SkillEnhancedData {
  /** 提取的实体 */
  entities: SkillEntity[];
  /** 关键数据 */
  keyData: SkillKeyDataItem[];
  /** 难度等级 */
  difficulty?: string;
}

/**
 * 摘要输出结果
 */
export interface SummarySkillOutput {
  /** 摘要文本 */
  summary: string;
  /** 生成的标签 */
  tags: string[];
  /** 结构化摘要 */
  structured?: SkillStructuredSummary;
  /** 增强摘要（仅 enhanced 模式） */
  enhanced?: SkillEnhancedData;
  /** 检测到的内容类型 */
  contentType?: string;
  /** 内容类型置信度 */
  contentTypeConfidence?: number;
  /** 使用的 Provider */
  providerUsed?: string;
  /** 处理耗时 (ms) */
  latencyMs: number;
}
