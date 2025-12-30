/**
 * 全局洞察服务常量配置
 *
 * @version 1.0.0
 * @since 2025-12-30
 */

import type { GlobalInsightConfig, TopicRelationMap } from "./types";

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: GlobalInsightConfig = {
  analysisPeriodDays: 90,
  maxTopics: 20,
  updateIntervalHours: 24,
  enableLLMAnalysis: false,
  coreKnowledgeThreshold: 70,
};

/**
 * 时间常量
 */
export const TIME_CONSTANTS = {
  /** 一天的毫秒数 */
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
  /** 一小时的毫秒数 */
  ONE_HOUR_MS: 60 * 60 * 1000,
  /** 趋势计算周期：最近 30 天 */
  TREND_PERIOD_DAYS: 30,
  /** 趋势计算周期：较早的 30-60 天 */
  TREND_COMPARISON_PERIOD_DAYS: 60,
} as const;

/**
 * 趋势判断阈值
 */
export const TREND_THRESHOLDS = {
  /** 上升趋势阈值：最近频率 > 较早频率 * 1.5 */
  RISING_MULTIPLIER: 1.5,
  /** 下降趋势阈值：最近频率 < 较早频率 * 0.5 */
  DECLINING_MULTIPLIER: 0.5,
} as const;

/**
 * 活跃度计算参数
 */
export const ACTIVITY_PARAMS = {
  /** 活跃度衰减周期（天）：30天内的活动权重最高 */
  DECAY_PERIOD_DAYS: 30,
  /** 最低活跃度值 */
  MIN_ACTIVITY: 0,
  /** 最高活跃度值 */
  MAX_ACTIVITY: 1,
} as const;

/**
 * 主题关联映射
 * 用于识别用户可能感兴趣但尚未收藏的相关主题
 */
export const TOPIC_RELATIONS: TopicRelationMap = {
  // 前端技术
  React: ["TypeScript", "Next.js", "Redux", "React Native", "Tailwind CSS"],
  Vue: ["TypeScript", "Nuxt.js", "Pinia", "Vite"],
  Angular: ["TypeScript", "RxJS", "NgRx"],
  TypeScript: ["JavaScript", "Node.js"],
  "Next.js": ["React", "TypeScript", "Vercel"],
  Tailwind: ["CSS", "UI Design"],

  // 后端技术
  "Node.js": ["Express", "NestJS", "TypeScript", "MongoDB"],
  Python: ["Django", "FastAPI", "机器学习", "数据分析"],
  Go: ["微服务", "Docker", "Kubernetes"],
  Rust: ["WebAssembly", "系统编程"],
  Java: ["Spring", "微服务", "Kotlin"],

  // AI/ML
  AI: ["深度学习", "LLM", "Prompt Engineering", "RAG"],
  LLM: ["GPT", "Claude", "Prompt Engineering", "RAG", "Fine-tuning"],
  机器学习: ["深度学习", "Python", "TensorFlow", "PyTorch"],
  深度学习: ["神经网络", "CNN", "RNN", "Transformer"],
  RAG: ["向量数据库", "Embedding", "LangChain"],

  // 基础设施
  Docker: ["Kubernetes", "容器化", "DevOps"],
  Kubernetes: ["Docker", "微服务", "云原生"],
  AWS: ["云计算", "DevOps", "Serverless"],

  // 数据库
  PostgreSQL: ["SQL", "数据库优化", "Supabase"],
  MongoDB: ["NoSQL", "Node.js"],
  Redis: ["缓存", "消息队列"],

  // 设计
  "UI Design": ["UX", "Figma", "设计系统"],
  UX: ["用户研究", "可用性测试", "设计思维"],
} as const;

/**
 * 知识盲区检测的最大建议数
 */
export const MAX_KNOWLEDGE_GAPS = 5;

/**
 * 最小书签数量要求
 * 低于此数量不生成洞察
 */
export const MIN_BOOKMARKS_FOR_INSIGHT = 5;

/**
 * 缓存版本号
 * 更新数据结构时需要递增
 */
export const INSIGHT_VERSION = 1;
