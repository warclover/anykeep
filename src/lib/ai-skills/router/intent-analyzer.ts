/**
 * IntentAnalyzer - 统一意图分析器
 *
 * 合并原有的三层架构为单一分析器：
 * - IntentClassifier: 意图分类
 * - ComplexityEvaluator: 复杂度评估
 * - ModeSelector: 模式选择
 *
 * 设计原则：
 * - 单一入口: analyze() 方法返回完整分析结果
 * - 规则优先: 规则匹配 + LLM 兜底
 * - 内联消歧: 将 DISAMBIGUATION_RULES 合并到规则系统
 *
 * @version 1.0.0
 * @since 2026-01-05
 */

import { logger } from "@/lib/logger";
import type {
  IntentType,
  IntentClassification,
  IntentRule,
  ExtractedEntity,
  ComplexityLevel,
  ComplexityFactor,
  RequestContext,
} from "./types";
import type { LLMIntentClassifier } from "./llm-classifier";
import { createLLMClassifier } from "./llm-classifier";

// ============================================
// 配置常量（提取自魔法数字）
// ============================================

/**
 * 置信度相关阈值
 */
export const CONFIDENCE_THRESHOLDS = {
  /** 规则匹配高置信度阈值，高于此值直接使用规则结果 */
  RULE_HIGH_CONFIDENCE: 0.8,
  /** LLM 兜底阈值，低于此值触发 LLM 分类 */
  LLM_FALLBACK_DEFAULT: 0.6,
  /** 基础置信度（规则匹配默认值） */
  BASE_CONFIDENCE: 0.85,
  /** 实体提取置信度 */
  ENTITY_CONFIDENCE: 0.9,
  /** 问句默认置信度 */
  QUESTION_DEFAULT: 0.5,
  /** 闲聊默认置信度 */
  CHITCHAT_DEFAULT: 0.4,
  /** 置信度下限 */
  MIN_CONFIDENCE: 0.5,
  /** 置信度上限 */
  MAX_CONFIDENCE: 1.0,
} as const;

/**
 * 置信度调整值
 */
export const CONFIDENCE_ADJUSTMENTS = {
  /** 短消息惩罚 */
  SHORT_MESSAGE_PENALTY: 0.1,
  /** 长消息惩罚 */
  LONG_MESSAGE_PENALTY: 0.05,
  /** 高权重规则加分 */
  HIGH_WEIGHT_BONUS: 0.05,
} as const;

/**
 * 消息长度阈值
 */
export const MESSAGE_LENGTH_THRESHOLDS = {
  /** 短消息阈值（字符数） */
  SHORT_MESSAGE: 5,
  /** 长消息阈值（字符数） */
  LONG_MESSAGE: 50,
} as const;

/**
 * 规则权重阈值
 */
export const RULE_WEIGHT_THRESHOLDS = {
  /** 高权重阈值，高于此值视为高权重规则 */
  HIGH_WEIGHT: 80,
} as const;

/**
 * 复杂度阈值默认值
 */
export const COMPLEXITY_THRESHOLD_DEFAULTS = {
  /** 简单任务分数上限 */
  SIMPLE: 35,
  /** 复杂任务分数下限 */
  COMPLEX: 60,
} as const;

/**
 * 数据规模阈值
 */
export const DATA_SCALE_THRESHOLDS = {
  /** 大规模数据阈值 */
  LARGE: 100,
  /** 中等规模数据阈值 */
  MEDIUM: 50,
  /** 小规模数据阈值 */
  SMALL: 20,
  /** 默认数据规模 */
  DEFAULT: 20,
  /** 单条数据规模（action 类型） */
  SINGLE: 1,
  /** 通用默认规模 */
  FALLBACK: 10,
} as const;

/**
 * 复杂度因子权重（总和应为 1.0）
 */
export const COMPLEXITY_FACTOR_WEIGHTS = {
  /** 意图复杂度权重 */
  INTENT_COMPLEXITY: 0.3,
  /** 多步骤需求权重 */
  MULTI_STEP: 0.25,
  /** 交付物期望权重 */
  DELIVERABLE: 0.2,
  /** 数据规模权重 */
  DATA_SCALE: 0.15,
  /** 确认需求权重 */
  CONFIRMATION: 0.1,
} as const;

/**
 * 复杂度因子分值
 */
export const COMPLEXITY_FACTOR_VALUES = {
  /** 多步骤 - 高值 */
  MULTI_STEP_HIGH: 80,
  /** 多步骤 - 低值 */
  MULTI_STEP_LOW: 20,
  /** 交付物 - 高值 */
  DELIVERABLE_HIGH: 70,
  /** 交付物 - 低值 */
  DELIVERABLE_LOW: 10,
  /** 数据规模 - 大规模 */
  SCALE_LARGE: 80,
  /** 数据规模 - 中等 */
  SCALE_MEDIUM: 60,
  /** 数据规模 - 小规模 */
  SCALE_SMALL: 40,
  /** 数据规模 - 默认 */
  SCALE_DEFAULT: 20,
  /** 确认需求 - 高值 */
  CONFIRMATION_HIGH: 50,
  /** 确认需求 - 低值 */
  CONFIRMATION_LOW: 10,
  /** 分数下限 */
  MIN_SCORE: 0,
  /** 分数上限 */
  MAX_SCORE: 100,
} as const;

/**
 * 默认配置值
 */
export const DEFAULT_CONFIG_VALUES = {
  /** LLM 超时时间（毫秒） */
  LLM_TIMEOUT_MS: 5000,
  /** 默认意图复杂度分数 */
  DEFAULT_INTENT_SCORE: 50,
} as const;

// ============================================
// 输出类型定义
// ============================================

/**
 * 意图分析结果（合并了分类、复杂度、模式选择）
 */
export interface AnalysisResult {
  // 意图分类
  intent: IntentType;
  subType?: string;
  confidence: number;
  entities: ExtractedEntity[];
  source: "rule" | "llm" | "semantic" | "hybrid" | "default";

  // 复杂度信息
  complexity: {
    level: ComplexityLevel;
    score: number;
    factors: ComplexityFactor[];
  };

  // 执行决策
  execution: {
    mode: "atomic" | "orchestration";
    suggestedSkill?: string;
    reason: string;
  };

  // 元信息
  requiresMultiStep: boolean;
  hasDeliverableExpectation: boolean;
  durationMs: number;
}

/**
 * IntentAnalyzer 配置
 */
export interface IntentAnalyzerConfig {
  /** 是否启用实体提取 */
  enableEntityExtraction?: boolean;
  /** LLM 超时时间(ms) */
  llmTimeoutMs?: number;
  /** LLM 兜底置信度阈值 */
  llmFallbackThreshold?: number;
  /** 是否启用 LLM 兜底 */
  enableLLMFallback?: boolean;
  /** LLM 分类器配置 */
  llmClassifierConfig?: Record<string, unknown>;
  /** 简单任务阈值 */
  simpleThreshold?: number;
  /** 复杂任务阈值 */
  complexThreshold?: number;
  /** 是否强制原子模式 */
  forceAtomicMode?: boolean;
  /** 调试模式 */
  debug?: boolean;
}

// ============================================
// 合并后的统一规则集
// ============================================

/**
 * 统一意图规则（合并了分类规则 + 消歧规则）
 *
 * 优先级分层：
 * - 100+: 高优先级场景规则
 * - 70-99: 标准意图规则
 * - 50-69: 通用规则
 * - 30-49: 默认规则
 */
const UNIFIED_RULES: IntentRule[] = [
  // ============================================
  // Active Recall 主动复习类（优先级最高）
  // ============================================
  {
    pattern:
      /开始复习|今日复习|知识同步|脑回路同步|看看要复习什么|有什么要复习/,
    type: "learn",
    subType: "active_recall_start",
    complexity: "complex",
    weight: 95,
  },
  {
    pattern: /复习进度|我学了什么|掌握了多少|内化率|记忆曲线|复习统计|掌握度/,
    type: "query",
    subType: "mastery_stats",
    complexity: "simple",
    weight: 85,
  },
  {
    pattern: /设置复习|复习偏好|调整复习频率|关闭复习|开启复习|复习设置/,
    type: "action",
    subType: "review_preferences",
    complexity: "simple",
    weight: 82,
  },

  // ============================================
  // 消歧增强规则（从 disambiguation-rules 合并）
  // ============================================

  // 动词+宾语结构 → create（高优先级）
  {
    pattern: /(梳理|整理|归纳).{0,10}(总结|纪要|摘要|笔记|报告)/,
    type: "create",
    subType: "digest",
    complexity: "medium",
    weight: 110,
  },
  // 主谓结构：主要动作是创建
  {
    pattern:
      /(总结|概括|归纳|撰写|生成).{0,5}(并|和|后再?|再)?.{0,5}(整理|分类|归档)?/,
    type: "create",
    subType: "digest",
    complexity: "medium",
    weight: 105,
  },
  // 整理为主 → organize
  {
    pattern: /(整理|清理|分类|归档).{0,5}(后|完).{0,5}(总结|生成|写)/,
    type: "organize",
    subType: "cleanup",
    complexity: "complex",
    weight: 100,
  },
  // 明确的创建类动词
  {
    pattern: /帮我(生成|创建|写|做).{0,10}(总结|摘要|笔记|报告)/,
    type: "create",
    subType: "digest",
    complexity: "medium",
    weight: 85,
  },

  // ============================================
  // 学习类（高优先级）
  // ============================================
  {
    pattern: /复习|回顾|巩固|温习|重温/,
    type: "learn",
    subType: "review",
    complexity: "complex",
    weight: 90,
  },
  {
    pattern: /准备.{0,5}面试|面试.{0,5}准备/,
    type: "learn",
    subType: "interview",
    complexity: "complex",
    weight: 90,
  },
  {
    pattern: /学习路径|学习计划|学习规划/,
    type: "learn",
    subType: "path",
    complexity: "complex",
    weight: 85,
  },

  // ============================================
  // 综述类（主题合成器）
  // ============================================
  {
    pattern:
      /(综述|合成|整合|归纳).{0,5}(关于|有关)|关于.{0,5}(综述|合成|整合)/,
    type: "create",
    subType: "synthesis_topic",
    complexity: "complex",
    weight: 93,
  },
  {
    pattern: /(综述|合成|整合|归纳).{0,5}(文件夹|目录)|文件夹.{0,5}(综述|合成)/,
    type: "create",
    subType: "synthesis_folder",
    complexity: "complex",
    weight: 92,
  },
  {
    pattern: /(综述|合成|整合|归纳).{0,5}标签|标签.{0,5}(综述|合成)/,
    type: "create",
    subType: "synthesis_tag",
    complexity: "complex",
    weight: 92,
  },
  {
    pattern: /(综述|合成|整合|归纳).{0,5}(最近|近期|这周|今天|昨天)/,
    type: "create",
    subType: "synthesis_recent",
    complexity: "complex",
    weight: 91,
  },
  {
    pattern:
      /综述|合成|整合.{0,5}(收藏|文章)|归纳.{0,5}(收藏|文章)|生成.{0,3}(综述|报告|合成)/,
    type: "create",
    subType: "synthesis",
    complexity: "complex",
    weight: 90,
  },

  // ============================================
  // 分析类
  // ============================================
  {
    pattern:
      /微信.{0,3}(文章|阅读|收藏).{0,3}(摘要|总结|整理|报告)|公众号.{0,3}(摘要|总结)/,
    type: "analyze",
    subType: "wechat",
    complexity: "medium",
    weight: 88,
  },
  {
    pattern:
      /消息.{0,3}(摘要|总结|概览|统计)|收件箱.{0,3}(摘要|总结|报告)|未读.{0,3}(摘要|总结)|通知.{0,3}(摘要|总结)/,
    type: "analyze",
    subType: "inbox_digest",
    complexity: "medium",
    weight: 87,
  },

  // ============================================
  // 创建类
  // ============================================
  {
    pattern:
      /B站.{0,3}(字幕|文字稿|转文字)|bilibili.{0,3}(字幕|文字稿|转文字)|视频.{0,3}(字幕|文字稿)|提取.{0,3}字幕/i,
    type: "create",
    subType: "bilibili_transcript",
    complexity: "medium",
    weight: 86,
  },
  {
    pattern: /(?<!阅)读|朗读|播放.{0,3}摘要|听|语音|念|tts/i,
    type: "create",
    subType: "tts",
    complexity: "simple",
    weight: 85,
  },

  // ============================================
  // 查询类（搜索优先 - 从消歧规则合并）
  // ============================================
  {
    pattern: /找.{0,10}(那篇|那个|哪篇|哪个)|搜.{0,5}(一下|下)/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 80,
  },
  {
    pattern: /有多少|多少个|多少篇|总共|一共|数量/,
    type: "query",
    subType: "count",
    complexity: "simple",
    weight: 75,
  },

  // ============================================
  // 整理类
  // ============================================
  {
    pattern: /去重|重复|找出重复|清理重复/,
    type: "organize",
    subType: "dedupe",
    complexity: "complex",
    weight: 85,
  },
  {
    pattern: /监控|变更检测|页面监控|变化检测|内容变化|监控列表|我的监控/,
    type: "organize",
    subType: "monitor",
    complexity: "simple",
    weight: 80,
  },
  {
    pattern: /周报|月报|报告|统计报告/,
    type: "analyze",
    subType: "report",
    complexity: "complex",
    weight: 80,
  },
  {
    pattern: /整理|清理|规整|梳理/,
    type: "organize",
    subType: "cleanup",
    complexity: "complex",
    weight: 80,
  },
  {
    pattern: /过期|失效|无效.{0,3}链接/,
    type: "organize",
    subType: "expire",
    complexity: "medium",
    weight: 75,
  },
  {
    pattern: /分类|归类|归档/,
    type: "organize",
    subType: "classify",
    complexity: "medium",
    weight: 70,
  },

  // ============================================
  // 操作类
  // ============================================
  {
    pattern: /添加.{0,3}标签|打标签|标记|标为|设为.{0,3}标签/,
    type: "action",
    subType: "tag",
    complexity: "simple",
    weight: 75,
  },
  {
    pattern: /分析|洞察|趋势/,
    type: "analyze",
    subType: "insight",
    complexity: "medium",
    weight: 70,
  },
  {
    pattern: /摘要|总结|概括|速览|summarize|summary/i,
    type: "create",
    subType: "digest",
    complexity: "medium",
    weight: 70,
  },
  {
    pattern: /笔记|记录|心得/,
    type: "create",
    subType: "note",
    complexity: "medium",
    weight: 65,
  },
  {
    pattern: /分享|导出|生成.{0,3}文档/,
    type: "create",
    subType: "share",
    complexity: "medium",
    weight: 65,
  },
  {
    pattern: /统计|有多少|数量|总共/,
    type: "query",
    subType: "count",
    complexity: "simple",
    weight: 60,
  },
  {
    pattern:
      /收藏.{0,2}(一下|下|它|这|起来)|保存.{0,2}(一下|下|它|这)|存下来?|加入收藏|添加到收藏|把.{0,5}收藏/,
    type: "action",
    subType: "save",
    complexity: "simple",
    weight: 55,
  },
  {
    pattern: /搜索|搜|找|查找|查询/,
    type: "query",
    subType: "search",
    complexity: "simple",
    weight: 50,
  },
  {
    pattern: /移动|转移|放到/,
    type: "action",
    subType: "move",
    complexity: "simple",
    weight: 50,
  },
  {
    pattern: /删除|移除|清除/,
    type: "action",
    subType: "delete",
    complexity: "simple",
    weight: 50,
  },
  {
    pattern: /最近|列表|列出|显示/,
    type: "query",
    subType: "list",
    complexity: "simple",
    weight: 45,
  },
  {
    pattern: /重命名|改名/,
    type: "action",
    subType: "rename",
    complexity: "simple",
    weight: 45,
  },
  {
    pattern: /什么是|介绍|解释/,
    type: "query",
    subType: "explain",
    complexity: "simple",
    weight: 40,
  },

  // ============================================
  // 闲聊类（最低优先级）
  // ============================================
  {
    pattern: /帮助|怎么用|如何使用|功能/,
    type: "chitchat",
    subType: "help",
    complexity: "simple",
    weight: 15,
  },
  {
    pattern: /你好|您好|嗨|hi|hello/i,
    type: "chitchat",
    subType: "greeting",
    complexity: "simple",
    weight: 10,
  },
  {
    pattern: /谢谢|感谢|辛苦/,
    type: "chitchat",
    subType: "thanks",
    complexity: "simple",
    weight: 10,
  },
];

// ============================================
// Skill 映射（从 ModeSelector 合并）
// ============================================

interface SkillMapping {
  skillId: string;
  name: string;
  minComplexity?: ComplexityLevel;
  enabled: boolean;
}

const SKILL_MAPPINGS: Record<string, SkillMapping> = {
  // Active Recall
  "learn:active_recall_start": {
    skillId: "active_recall",
    name: "Brain-Sync 主动复习",
    minComplexity: "medium",
    enabled: true,
  },
  // 学习类
  "learn:review": {
    skillId: "knowledge_review",
    name: "知识回顾助手",
    minComplexity: "medium",
    enabled: true,
  },
  "learn:path": {
    skillId: "learning_path",
    name: "学习路径规划",
    minComplexity: "complex",
    enabled: true,
  },
  // 整理类
  "organize:cleanup": {
    skillId: "batch_organize",
    name: "智能整理助手",
    minComplexity: "medium",
    enabled: true,
  },
  "organize:dedupe": {
    skillId: "duplicate_cleanup",
    name: "重复清理助手",
    minComplexity: "medium",
    enabled: true,
  },
  "organize:classify": {
    skillId: "smart_tagging",
    name: "智能标签助手",
    minComplexity: "medium",
    enabled: true,
  },
  "organize:expire": {
    skillId: "link_health_check",
    name: "链接健康检测",
    minComplexity: "medium",
    enabled: true,
  },
  "organize:monitor": {
    skillId: "content_change_monitor",
    name: "内容变更监控",
    minComplexity: "simple",
    enabled: true,
  },
  // 分析类
  "analyze:report": {
    skillId: "periodic_report",
    name: "周期报告生成",
    minComplexity: "complex",
    enabled: true,
  },
  "analyze:insight": {
    skillId: "insight_report",
    name: "收藏洞察分析",
    minComplexity: "medium",
    enabled: true,
  },
  "analyze:wechat": {
    skillId: "wechat_digest",
    name: "微信阅读摘要",
    minComplexity: "medium",
    enabled: true,
  },
  "analyze:inbox_digest": {
    skillId: "inbox_digest",
    name: "收件箱摘要",
    minComplexity: "medium",
    enabled: true,
  },
  // 创建类
  "create:digest": {
    skillId: "quick_digest",
    name: "快速摘要生成",
    minComplexity: "simple",
    enabled: true,
  },
  "create:share": {
    skillId: "share_bundle",
    name: "分享包生成",
    minComplexity: "medium",
    enabled: true,
  },
  "create:tts": {
    skillId: "tts_synthesis",
    name: "语音朗读助手",
    minComplexity: "simple",
    enabled: true,
  },
  "create:bilibili_transcript": {
    skillId: "bilibili_transcript",
    name: "B站字幕提取",
    minComplexity: "medium",
    enabled: true,
  },
  // 综述类
  "create:synthesis": {
    skillId: "thematic_synthesis",
    name: "主题合成器",
    minComplexity: "medium",
    enabled: true,
  },
  "create:synthesis_folder": {
    skillId: "thematic_synthesis",
    name: "主题合成器",
    minComplexity: "medium",
    enabled: true,
  },
  "create:synthesis_tag": {
    skillId: "thematic_synthesis",
    name: "主题合成器",
    minComplexity: "medium",
    enabled: true,
  },
  "create:synthesis_recent": {
    skillId: "thematic_synthesis",
    name: "主题合成器",
    minComplexity: "medium",
    enabled: true,
  },
  "create:synthesis_topic": {
    skillId: "thematic_synthesis",
    name: "主题合成器",
    minComplexity: "medium",
    enabled: true,
  },
};

// ============================================
// 实体提取模式
// ============================================

/**
 * 实体提取模式定义
 *
 * 注意：pattern 和 globalPattern 分开定义，
 * globalPattern 是带 'g' 标志的预编译版本，用于 matchAll
 */
interface EntityPattern {
  type: ExtractedEntity["type"];
  pattern: RegExp;
  /** 预编译的全局匹配正则 (带 'g' 标志) */
  globalPattern: RegExp;
  extractor: (match: RegExpMatchArray) => string;
}

/**
 * 创建实体模式的辅助函数
 * 自动生成带 'g' 标志的预编译正则
 */
function createEntityPattern(
  type: ExtractedEntity["type"],
  pattern: RegExp,
  extractor: (match: RegExpMatchArray) => string,
): EntityPattern {
  // 提取 flags 并添加 'g'
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : pattern.flags + "g";
  return {
    type,
    pattern,
    globalPattern: new RegExp(pattern.source, flags),
    extractor,
  };
}

const ENTITY_PATTERNS: EntityPattern[] = [
  // 时间实体
  createEntityPattern(
    "time",
    /今[天日]|昨[天日]|前[天日]|本周|上周|这周|本月|上月|这个月/,
    (m) => m[0],
  ),
  createEntityPattern("time", /最近(\d+)[天日周月]/, (m) => m[0]),
  createEntityPattern("time", /(\d+)[天日周月][前内以]?来?/, (m) => m[0]),
  // 数量实体
  createEntityPattern("quantity", /(\d+)\s*[条个篇份]/, (m) => m[1]),
  createEntityPattern("quantity", /前\s*(\d+)/, (m) => m[1]),
  // 主题实体
  createEntityPattern(
    "topic",
    /关于(.+?)的|(.+?)相关|(.+?)方面/,
    (m) => m[1] || m[2] || m[3],
  ),
  // 平台实体
  createEntityPattern(
    "platform",
    /微信|公众号|B站|bilibili|小红书|知乎|掘金|GitHub|twitter|x\.com/i,
    (m) => m[0].toLowerCase(),
  ),
  // 文件夹实体
  createEntityPattern(
    "folder",
    /[「「【\[](.+?)[」」】\]]|"(.+?)"|'(.+?)'/,
    (m) => m[1] || m[2] || m[3],
  ),
];

// ============================================
// 复杂度评估常量（从 ComplexityEvaluator 合并）
// ============================================

const INTENT_COMPLEXITY_SCORES: Record<IntentType, number> = {
  chitchat: 10,
  query: 20,
  refine: 25,
  action: 30,
  create: 50,
  organize: 70,
  analyze: 75,
  learn: 80,
};

const SUBTYPE_ADJUSTMENTS: Record<string, number> = {
  count: -5,
  search: 0,
  list: -5,
  explain: 10,
  classify: 10,
  cleanup: 15,
  dedupe: 20,
  expire: 5,
  review: 15,
  interview: 25,
  path: 20,
  report: 20,
  insight: 15,
  digest: 5,
  note: 0,
  share: 5,
};

// ============================================
// IntentAnalyzer 主类
// ============================================

/**
 * ���一意图分析器
 *
 * 合并了 IntentClassifier + ComplexityEvaluator + ModeSelector
 * 提供单一入口的意图分析功能
 */
export class IntentAnalyzer {
  private rules: IntentRule[];
  private config: Required<IntentAnalyzerConfig>;
  private llmClassifier: LLMIntentClassifier | null = null;

  constructor(config: IntentAnalyzerConfig = {}) {
    this.config = {
      enableEntityExtraction: config.enableEntityExtraction ?? true,
      llmTimeoutMs: config.llmTimeoutMs ?? DEFAULT_CONFIG_VALUES.LLM_TIMEOUT_MS,
      llmFallbackThreshold:
        config.llmFallbackThreshold ??
        CONFIDENCE_THRESHOLDS.LLM_FALLBACK_DEFAULT,
      enableLLMFallback: config.enableLLMFallback ?? false,
      llmClassifierConfig: config.llmClassifierConfig ?? {},
      simpleThreshold:
        config.simpleThreshold ?? COMPLEXITY_THRESHOLD_DEFAULTS.SIMPLE,
      complexThreshold:
        config.complexThreshold ?? COMPLEXITY_THRESHOLD_DEFAULTS.COMPLEX,
      forceAtomicMode: config.forceAtomicMode ?? false,
      debug: config.debug ?? false,
    };

    // 按权重排序规则
    this.rules = [...UNIFIED_RULES].sort(
      (a, b) => (b.weight || 0) - (a.weight || 0),
    );

    // 初始化 LLM 分类器
    if (this.config.enableLLMFallback) {
      this.llmClassifier = createLLMClassifier({
        timeoutMs: this.config.llmTimeoutMs,
        ...this.config.llmClassifierConfig,
        debug: this.config.debug,
      });
    }
  }

  /**
   * 分析用户意图（统一入口）
   *
   * @param message - 用户输入消息
   * @param context - 请求上下文
   * @returns 完整的分析结果
   */
  async analyze(
    message: string,
    context: Partial<RequestContext> = {},
  ): Promise<AnalysisResult> {
    const startTime = performance.now();

    // 1. 意图分类
    const classification = await this.classify(message);

    // 2. 复杂度评估
    const complexity = this.evaluateComplexity(classification, context);

    // 3. 模式选择
    const execution = this.selectMode(classification, complexity);

    const result: AnalysisResult = {
      intent: classification.type,
      subType: classification.subType,
      confidence: classification.confidence,
      entities: classification.entities,
      source: classification.source,
      complexity,
      execution,
      requiresMultiStep: classification.requiresMultiStep,
      hasDeliverableExpectation: classification.hasDeliverableExpectation,
      durationMs: Math.round(performance.now() - startTime),
    };

    if (this.config.debug) {
      logger.debug(
        {
          message: message.substring(0, 50),
          intent: result.intent,
          subType: result.subType,
          complexity: result.complexity.level,
          mode: result.execution.mode,
          skill: result.execution.suggestedSkill,
          durationMs: result.durationMs,
        },
        "IntentAnalyzer: Analysis completed",
      );
    }

    return result;
  }

  // ============================================
  // 意图分类（内部方法）
  // ============================================

  private async classify(message: string): Promise<IntentClassification> {
    // 1. 规则匹配
    const ruleMatch = this.matchRules(message);

    if (
      ruleMatch &&
      ruleMatch.confidence >= CONFIDENCE_THRESHOLDS.RULE_HIGH_CONFIDENCE
    ) {
      return ruleMatch;
    }

    // 2. LLM 兜底
    if (
      this.llmClassifier &&
      (!ruleMatch || ruleMatch.confidence < this.config.llmFallbackThreshold)
    ) {
      const llmResult = await this.llmClassifier.classify(message);

      if (llmResult && llmResult.confidence > (ruleMatch?.confidence ?? 0)) {
        const entities = this.config.enableEntityExtraction
          ? this.extractEntities(message)
          : [];

        return {
          type: llmResult.type as IntentType,
          subType: llmResult.subType,
          confidence: llmResult.confidence,
          entities,
          requiresMultiStep: this.isMultiStepType(llmResult.type as IntentType),
          hasDeliverableExpectation: this.expectsDeliverable(
            llmResult.type as IntentType,
            llmResult.subType,
          ),
          source: "llm",
        };
      }
    }

    // 3. 返回规则匹配结果或默认
    return ruleMatch || this.getDefaultClassification(message);
  }

  private matchRules(message: string): IntentClassification | null {
    for (const rule of this.rules) {
      if (rule.pattern.test(message)) {
        const entities = this.config.enableEntityExtraction
          ? this.extractEntities(message)
          : [];

        return {
          type: rule.type,
          subType: rule.subType,
          confidence: this.calculateConfidence(message, rule),
          entities,
          requiresMultiStep: this.isMultiStepType(rule.type),
          hasDeliverableExpectation: this.expectsDeliverable(
            rule.type,
            rule.subType,
          ),
          source: "rule",
        };
      }
    }
    return null;
  }

  private extractEntities(message: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    for (const { type, globalPattern, extractor } of ENTITY_PATTERNS) {
      // 使用预编译的全局正则（避免每次调用创建新 RegExp）
      const matches = message.matchAll(globalPattern);
      for (const match of matches) {
        const value = extractor(match);
        if (value) {
          entities.push({
            type,
            value: value.trim(),
            raw: match[0],
            confidence: CONFIDENCE_THRESHOLDS.ENTITY_CONFIDENCE,
          });
        }
      }
    }

    return entities;
  }

  private calculateConfidence(message: string, rule: IntentRule): number {
    let confidence = CONFIDENCE_THRESHOLDS.BASE_CONFIDENCE;

    if (message.length < MESSAGE_LENGTH_THRESHOLDS.SHORT_MESSAGE) {
      confidence -= CONFIDENCE_ADJUSTMENTS.SHORT_MESSAGE_PENALTY;
    } else if (message.length > MESSAGE_LENGTH_THRESHOLDS.LONG_MESSAGE) {
      confidence -= CONFIDENCE_ADJUSTMENTS.LONG_MESSAGE_PENALTY;
    }

    if (rule.weight && rule.weight >= RULE_WEIGHT_THRESHOLDS.HIGH_WEIGHT) {
      confidence += CONFIDENCE_ADJUSTMENTS.HIGH_WEIGHT_BONUS;
    }

    return Math.max(
      CONFIDENCE_THRESHOLDS.MIN_CONFIDENCE,
      Math.min(CONFIDENCE_THRESHOLDS.MAX_CONFIDENCE, confidence),
    );
  }

  private isMultiStepType(type: IntentType): boolean {
    return ["organize", "analyze", "learn"].includes(type);
  }

  private expectsDeliverable(type: IntentType, subType?: string): boolean {
    if (["analyze", "create", "learn"].includes(type)) {
      return true;
    }
    const deliverableSubTypes = ["report", "digest", "path", "share", "review"];
    return subType ? deliverableSubTypes.includes(subType) : false;
  }

  private getDefaultClassification(message: string): IntentClassification {
    const entities = this.config.enableEntityExtraction
      ? this.extractEntities(message)
      : [];

    if (message.includes("?") || message.includes("？")) {
      return {
        type: "query",
        subType: "general",
        confidence: CONFIDENCE_THRESHOLDS.QUESTION_DEFAULT,
        entities,
        requiresMultiStep: false,
        hasDeliverableExpectation: false,
        source: "rule",
      };
    }

    return {
      type: "chitchat",
      subType: "general",
      confidence: CONFIDENCE_THRESHOLDS.CHITCHAT_DEFAULT,
      entities,
      requiresMultiStep: false,
      hasDeliverableExpectation: false,
      source: "rule",
    };
  }

  // ============================================
  // 复杂度评估（内部方法）
  // ============================================

  private evaluateComplexity(
    intent: IntentClassification,
    context: Partial<RequestContext>,
  ): AnalysisResult["complexity"] {
    const factors: ComplexityFactor[] = [];

    // 因素 1: 意图复杂度
    let intentScore =
      INTENT_COMPLEXITY_SCORES[intent.type] ??
      DEFAULT_CONFIG_VALUES.DEFAULT_INTENT_SCORE;
    if (intent.subType && SUBTYPE_ADJUSTMENTS[intent.subType]) {
      intentScore += SUBTYPE_ADJUSTMENTS[intent.subType];
    }
    intentScore = Math.max(
      COMPLEXITY_FACTOR_VALUES.MIN_SCORE,
      Math.min(COMPLEXITY_FACTOR_VALUES.MAX_SCORE, intentScore),
    );
    factors.push({
      name: "intent_complexity",
      weight: COMPLEXITY_FACTOR_WEIGHTS.INTENT_COMPLEXITY,
      value: intentScore,
      reason: `${intent.type}${intent.subType ? `:${intent.subType}` : ""} 类型`,
    });

    // 因素 2: 多步骤需求
    factors.push({
      name: "multi_step",
      weight: COMPLEXITY_FACTOR_WEIGHTS.MULTI_STEP,
      value: intent.requiresMultiStep
        ? COMPLEXITY_FACTOR_VALUES.MULTI_STEP_HIGH
        : COMPLEXITY_FACTOR_VALUES.MULTI_STEP_LOW,
      reason: intent.requiresMultiStep ? "需要多步骤" : "单步完成",
    });

    // 因素 3: 交付物期望
    factors.push({
      name: "deliverable",
      weight: COMPLEXITY_FACTOR_WEIGHTS.DELIVERABLE,
      value: intent.hasDeliverableExpectation
        ? COMPLEXITY_FACTOR_VALUES.DELIVERABLE_HIGH
        : COMPLEXITY_FACTOR_VALUES.DELIVERABLE_LOW,
      reason: intent.hasDeliverableExpectation ? "期望交付物" : "仅数据",
    });

    // 因素 4: 数据规模
    const dataScale = this.estimateDataScale(intent, context);
    let scaleScore: number = COMPLEXITY_FACTOR_VALUES.SCALE_DEFAULT;
    if (dataScale > DATA_SCALE_THRESHOLDS.LARGE) {
      scaleScore = COMPLEXITY_FACTOR_VALUES.SCALE_LARGE;
    } else if (dataScale > DATA_SCALE_THRESHOLDS.MEDIUM) {
      scaleScore = COMPLEXITY_FACTOR_VALUES.SCALE_MEDIUM;
    } else if (dataScale > DATA_SCALE_THRESHOLDS.SMALL) {
      scaleScore = COMPLEXITY_FACTOR_VALUES.SCALE_SMALL;
    }
    factors.push({
      name: "data_scale",
      weight: COMPLEXITY_FACTOR_WEIGHTS.DATA_SCALE,
      value: scaleScore,
      reason: `约 ${dataScale} 条数据`,
    });

    // 因素 5: 确认需求
    const needsConfirm =
      intent.subType &&
      ["delete", "move", "cleanup", "dedupe"].includes(intent.subType);
    factors.push({
      name: "confirmation",
      weight: COMPLEXITY_FACTOR_WEIGHTS.CONFIRMATION,
      value: needsConfirm
        ? COMPLEXITY_FACTOR_VALUES.CONFIRMATION_HIGH
        : COMPLEXITY_FACTOR_VALUES.CONFIRMATION_LOW,
      reason: needsConfirm ? "需确认" : "自动完成",
    });

    // 计算总分
    const score = Math.round(
      factors.reduce((sum, f) => sum + f.weight * f.value, 0),
    );

    // 确定级别
    let level: ComplexityLevel = "simple";
    if (score >= this.config.complexThreshold) {
      level = "complex";
    } else if (score >= this.config.simpleThreshold) {
      level = "medium";
    }

    return { level, score, factors };
  }

  private estimateDataScale(
    intent: IntentClassification,
    context: Partial<RequestContext>,
  ): number {
    if (context.bookmarkIds?.length) {
      return context.bookmarkIds.length;
    }
    if (context.totalBookmarks) {
      switch (intent.type) {
        case "query":
          return Math.min(context.totalBookmarks, DATA_SCALE_THRESHOLDS.SMALL);
        case "action":
          return DATA_SCALE_THRESHOLDS.SINGLE;
        case "organize":
        case "analyze":
          return context.totalBookmarks;
        case "learn":
          return Math.min(context.totalBookmarks, DATA_SCALE_THRESHOLDS.MEDIUM);
        default:
          return DATA_SCALE_THRESHOLDS.FALLBACK;
      }
    }
    return DATA_SCALE_THRESHOLDS.DEFAULT;
  }

  // ============================================
  // 模式选择（内部方法）
  // ============================================

  private selectMode(
    intent: IntentClassification,
    complexity: AnalysisResult["complexity"],
  ): AnalysisResult["execution"] {
    // 调试模式强制原子
    if (this.config.forceAtomicMode) {
      return {
        mode: "atomic",
        reason: "调试：强制原子模式",
      };
    }

    // 简单任务 → 原子
    if (complexity.level === "simple") {
      return {
        mode: "atomic",
        reason: "简单任务，原子模式",
      };
    }

    // 查找匹配的 Skill
    const skillKey = intent.subType
      ? `${intent.type}:${intent.subType}`
      : `${intent.type}:general`;
    const mapping = SKILL_MAPPINGS[skillKey];

    if (mapping?.enabled) {
      if (this.meetsMinComplexity(complexity.level, mapping.minComplexity)) {
        return {
          mode: "orchestration",
          suggestedSkill: mapping.skillId,
          reason: `使用 ${mapping.name}`,
        };
      }
    }

    // 复杂但无 Skill → 原子多轮
    if (complexity.level === "complex") {
      return {
        mode: "atomic",
        reason: "复杂任务但无专用 Skill",
      };
    }

    // 期望交付物 → 尝试部分匹配
    if (intent.hasDeliverableExpectation) {
      const partialMapping = this.findPartialSkill(intent.type);
      if (partialMapping) {
        return {
          mode: "orchestration",
          suggestedSkill: partialMapping.skillId,
          reason: `期望交付物，使用 ${partialMapping.name}`,
        };
      }
    }

    return {
      mode: "atomic",
      reason: "默认原子模式",
    };
  }

  private meetsMinComplexity(
    current: ComplexityLevel,
    required?: ComplexityLevel,
  ): boolean {
    if (!required || required === "simple") return true;
    const levels = { simple: 1, medium: 2, complex: 3 };
    return levels[current] >= levels[required];
  }

  private findPartialSkill(type: IntentType): SkillMapping | null {
    const prefix = `${type}:`;
    for (const [key, mapping] of Object.entries(SKILL_MAPPINGS)) {
      if (key.startsWith(prefix) && mapping.enabled) {
        return mapping;
      }
    }
    return null;
  }

  // ============================================
  // 公共 API（兼容层）
  // ============================================

  /**
   * 获取规则列表（调试用）
   */
  getRules(): IntentRule[] {
    return [...this.rules];
  }

  /**
   * 添加自定义规则
   */
  addRule(rule: IntentRule): void {
    this.rules.unshift(rule);
    this.rules.sort((a, b) => (b.weight || 0) - (a.weight || 0));
  }
}

// ============================================
// 工厂函数和默认实例
// ============================================

/**
 * 创建意图分析器实例
 */
export function createIntentAnalyzer(
  config?: IntentAnalyzerConfig,
): IntentAnalyzer {
  return new IntentAnalyzer(config);
}

/**
 * 默认意图分析器实例
 */
export const intentAnalyzer = new IntentAnalyzer();

// ============================================
// 向后兼容导出（@deprecated）
// ============================================

/**
 * @deprecated 使用 IntentAnalyzer 替代
 *
 * 迁移示例:
 * ```typescript
 * // 旧代码
 * import { IntentClassifier } from '@/lib/ai-skills/router';
 * const classifier = new IntentClassifier({ debug: true });
 * const result = await classifier.classify('搜索AI');
 *
 * // 新代码
 * import { IntentAnalyzer } from '@/lib/ai-skills/router';
 * const analyzer = new IntentAnalyzer({ debug: true });
 * const analysis = await analyzer.analyze('搜索AI');
 * // analysis.intent 等同于旧的 result.type
 * ```
 */
export const IntentClassifier = IntentAnalyzer;
/** @deprecated 使用 createIntentAnalyzer 替代 */
export const createIntentClassifier = createIntentAnalyzer;
/** @deprecated 使用 intentAnalyzer 替代 */
export const intentClassifier = intentAnalyzer;

/**
 * @deprecated ComplexityEvaluator 已合并到 IntentAnalyzer.analyze().complexity
 *
 * 迁移示例:
 * ```typescript
 * // 旧代码
 * import { ComplexityEvaluator } from '@/lib/ai-skills/router';
 * const evaluator = new ComplexityEvaluator();
 * const complexity = evaluator.evaluate(classification, context);
 *
 * // 新代码
 * import { IntentAnalyzer } from '@/lib/ai-skills/router';
 * const analyzer = new IntentAnalyzer();
 * const analysis = await analyzer.analyze(message, context);
 * const complexity = analysis.complexity; // { level, score, factors }
 * ```
 */
export class ComplexityEvaluator {
  constructor() {
    logger.warn(
      "ComplexityEvaluator 已废弃，请使用 IntentAnalyzer.analyze().complexity",
    );
  }

  evaluate(): {
    level: ComplexityLevel;
    score: number;
    factors: ComplexityFactor[];
  } {
    throw new Error(
      "ComplexityEvaluator 已废弃，请使用 IntentAnalyzer.analyze().complexity",
    );
  }
}

/**
 * @deprecated ModeSelector 已合并到 IntentAnalyzer.analyze().execution
 *
 * 迁移示例:
 * ```typescript
 * // 旧代码
 * import { ModeSelector } from '@/lib/ai-skills/router';
 * const selector = new ModeSelector();
 * const mode = selector.select(classification, complexity);
 *
 * // 新代码
 * import { IntentAnalyzer } from '@/lib/ai-skills/router';
 * const analyzer = new IntentAnalyzer();
 * const analysis = await analyzer.analyze(message, context);
 * const execution = analysis.execution; // { mode, suggestedSkill, reason }
 * ```
 */
export class ModeSelector {
  constructor() {
    logger.warn(
      "ModeSelector 已废弃，请使用 IntentAnalyzer.analyze().execution",
    );
  }

  select(): {
    mode: "atomic" | "orchestration";
    suggestedSkill?: string;
    reason: string;
  } {
    throw new Error(
      "ModeSelector 已废弃，请使用 IntentAnalyzer.analyze().execution",
    );
  }
}

/** @deprecated 使用 createIntentAnalyzer 替代 */
export function createComplexityEvaluator(): ComplexityEvaluator {
  return new ComplexityEvaluator();
}

/** @deprecated 使用 createIntentAnalyzer 替代 */
export function createModeSelector(): ModeSelector {
  return new ModeSelector();
}
