/**
 * 获取所有 AI Skills 的元数据
 *
 * 用于 Skills 浏览器页面展示所有可用的 AI Skills
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type { SkillMetadata, SkillCategory } from "./core/types";

/**
 * 扩展的 Skill 元数据（包含编排信息）
 */
export interface ExtendedSkillMetadata extends SkillMetadata {
  /** 是否是编排型 Skill */
  isOrchestration: boolean;
  /** 交付物类型（仅编排 Skill） */
  deliverableTypes?: string[];
  /** 输出格式（仅编排 Skill） */
  outputFormats?: string[];
  /** 执行步骤（仅编排 Skill） */
  steps?: Array<{ id: string; name: string; description: string }>;
  /** Feature Flag 名称（如需开关控制） */
  featureFlag?: string;
}

/**
 * 所有 AI Skills 元数据
 *
 * 注意：此列表需要与 register.ts 保持同步
 */
export const ALL_SKILLS_METADATA: ExtendedSkillMetadata[] = [
  // ============================================
  // 原子 Skills（默认注册）
  // ============================================
  {
    id: "search",
    name: "搜索书签",
    description:
      "在用户的书签库中搜索内容。支持关键词搜索、语义搜索和混合搜索模式。",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "keyword-search",
      "semantic-search",
      "hybrid-search",
      "filter-by-platform",
      "filter-by-folder",
      "filter-by-tags",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 2000,
    isOrchestration: false,
  },
  {
    id: "classify",
    name: "智能分类",
    description: "对书签进行智能分类，推荐最合适的文件夹和标签。",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["folder-recommendation", "tag-suggestion", "auto-organize"],
    requiresConfirmation: false,
    estimatedDurationMs: 3000,
    isOrchestration: false,
  },
  {
    id: "summary",
    name: "内容摘要",
    description: "为书签生成智能摘要，提取关键信息和要点。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["tldr", "key-points", "full-summary"],
    requiresConfirmation: false,
    estimatedDurationMs: 5000,
    isOrchestration: false,
  },
  {
    id: "folder_recommend",
    name: "文件夹智能推荐",
    description: "基于书签内容和使用习惯，推荐最佳文件夹结构。",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["analyze", "recommend", "folder-optimization"],
    requiresConfirmation: false,
    estimatedDurationMs: 3000,
    isOrchestration: false,
  },

  // ============================================
  // 编排 Skills
  // ============================================
  {
    id: "data_export",
    name: "数据导出助手",
    description:
      "将书签数据导出为多种格式，支持 CSV、Markdown、JSON、HTML、Obsidian 等。",
    category: "utility",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "csv-export",
      "markdown-export",
      "json-export",
      "obsidian-export",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 10000,
    isOrchestration: true,
    deliverableTypes: ["file"],
    outputFormats: ["csv", "markdown", "json", "html"],
  },
  {
    id: "insight_report",
    name: "洞察报告助手",
    description: "分析您的收藏数据，生成活跃度分析、内容趋势和洞察建议报告。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "activity-analysis",
      "trend-detection",
      "insight-generation",
      "recommendation",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 20000,
    isOrchestration: true,
    deliverableTypes: ["report"],
    outputFormats: ["markdown"],
  },
  {
    id: "batch_organize",
    name: "智能整理助手",
    description: "批量整理书签，支持自动分类、标签推荐、重复检测和归档。",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "auto-classify",
      "tag-recommendation",
      "duplicate-detection",
      "batch-archive",
    ],
    requiresConfirmation: true,
    estimatedDurationMs: 30000,
    isOrchestration: true,
    deliverableTypes: ["plan", "report"],
    outputFormats: ["markdown", "json"],
  },
  {
    id: "duplicate_cleanup",
    name: "重复清理助手",
    description: "检测并清理重复的书签，支持智能合并和保留策略。",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["duplicate-detection", "smart-merge", "cleanup-preview"],
    requiresConfirmation: true,
    estimatedDurationMs: 15000,
    isOrchestration: true,
    deliverableTypes: ["plan", "list"],
    outputFormats: ["markdown"],
  },
  {
    id: "smart_tagging",
    name: "智能标签助手",
    description: "自动分析内容并推荐合适的标签，支持批量打标签。",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["tag-recommendation", "auto-tagging", "tag-analysis"],
    requiresConfirmation: false,
    estimatedDurationMs: 8000,
    isOrchestration: true,
    deliverableTypes: ["list"],
    outputFormats: ["json"],
  },
  {
    id: "inbox_triage",
    name: "收件箱智能分拣",
    description: "分析未分类书签，提供智能整理建议和一键执行。",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["analyze", "suggest", "batch-action", "clustering"],
    requiresConfirmation: false,
    estimatedDurationMs: 15000,
    isOrchestration: true,
    deliverableTypes: ["list", "plan"],
    outputFormats: ["json"],
    steps: [
      { id: "scan", name: "扫描收件箱", description: "检索未分类书签" },
      { id: "cluster", name: "聚类分析", description: "按主题聚类书签" },
      { id: "suggest", name: "生成建议", description: "制定整理方案" },
      { id: "prepare", name: "准备操作", description: "构建可执行动作" },
    ],
  },
  {
    id: "folder_health_check",
    name: "文件夹健康检查",
    description: "诊断文件夹结构健康状态，提供合并或拆分建议。",
    category: "organizing",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["diagnose", "merge-suggestion", "split-suggestion"],
    requiresConfirmation: false,
    estimatedDurationMs: 10000,
    isOrchestration: true,
    deliverableTypes: ["report"],
    outputFormats: ["markdown", "json"],
    steps: [
      { id: "scan", name: "扫描结构", description: "获取文件夹信息" },
      { id: "diagnose", name: "诊断问题", description: "分析健康状态" },
      { id: "suggest", name: "生成建议", description: "提供优化方案" },
    ],
  },
  {
    id: "related_discovery",
    name: "相关发现助手",
    description: "基于语义相似度发现相关内容，帮助您探索知识关联。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "semantic-similarity",
      "content-discovery",
      "recommendation",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 8000,
    isOrchestration: true,
    deliverableTypes: ["list"],
    outputFormats: ["markdown"],
  },
  {
    id: "periodic_report",
    name: "周期报告助手",
    description: "生成周报、月报等周期性收藏统计和洞察报告。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["weekly-report", "monthly-report", "trend-analysis"],
    requiresConfirmation: false,
    estimatedDurationMs: 15000,
    isOrchestration: true,
    deliverableTypes: ["report"],
    outputFormats: ["markdown"],
  },
  {
    id: "knowledge_extract",
    name: "知识提取助手",
    description: "从书签内容中提取关键知识点和概念，构建知识图谱。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["concept-extraction", "knowledge-graph", "key-terms"],
    requiresConfirmation: false,
    estimatedDurationMs: 12000,
    isOrchestration: true,
    deliverableTypes: ["report", "graph"],
    outputFormats: ["markdown", "json"],
  },
  {
    id: "tts_synthesis",
    name: "语音朗读助手",
    description:
      "将书签摘要内容转换为语音朗读，支持一句话总结、完整摘要、关键要点等多种模式。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["tts-synthesis", "content-extraction", "audio-generation"],
    requiresConfirmation: false,
    estimatedDurationMs: 10000,
    isOrchestration: true,
    deliverableTypes: ["audio"],
    outputFormats: ["audio"],
    featureFlag: "ENABLE_TTS_SYNTHESIS",
  },
  {
    id: "wechat_digest",
    name: "微信阅读摘要",
    description: "专为微信公众号文章优化的摘要生成，支持长文精炼。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: ["wechat-parsing", "long-form-summary", "article-digest"],
    requiresConfirmation: false,
    estimatedDurationMs: 12000,
    isOrchestration: true,
    deliverableTypes: ["report"],
    outputFormats: ["markdown"],
    featureFlag: "ENABLE_WECHAT_DIGEST",
  },

  {
    id: "thematic_synthesis",
    name: "主题合成器",
    description: "将多个相关书签合成为主题报告，支持 AI 智能推荐和自定义主题。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "theme-synthesis",
      "multi-source-merge",
      "report-generation",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 25000,
    isOrchestration: true,
    deliverableTypes: ["report"],
    outputFormats: ["markdown", "html"],
    featureFlag: "ENABLE_THEMATIC_SYNTHESIS",
  },
];

/**
 * 按分类获取 Skills
 */
export function getSkillsByCategory(): Record<
  SkillCategory,
  ExtendedSkillMetadata[]
> {
  const result: Record<SkillCategory, ExtendedSkillMetadata[]> = {
    understanding: [],
    organizing: [],
    learning: [],
    utility: [],
  };

  for (const skill of ALL_SKILLS_METADATA) {
    result[skill.category].push(skill);
  }

  return result;
}

/**
 * 获取分类的显示名称和描述
 */
export const CATEGORY_INFO: Record<
  SkillCategory,
  { name: string; description: string; icon: string }
> = {
  understanding: {
    name: "理解增强",
    description: "帮助您更好地理解和消化收藏内容",
    icon: "🧠",
  },
  organizing: {
    name: "整理优化",
    description: "智能整理和优化您的收藏结构",
    icon: "📁",
  },
  learning: {
    name: "学习助手",
    description: "辅助学习和知识内化",
    icon: "📚",
  },
  utility: {
    name: "实用工具",
    description: "搜索、导出等实用功能",
    icon: "🔧",
  },
};

/**
 * 获取 Skills 统计信息
 */
export function getSkillsStats() {
  const byCategory = getSkillsByCategory();
  return {
    total: ALL_SKILLS_METADATA.length,
    orchestration: ALL_SKILLS_METADATA.filter((s) => s.isOrchestration).length,
    atomic: ALL_SKILLS_METADATA.filter((s) => !s.isOrchestration).length,
    byCategory: {
      understanding: byCategory.understanding.length,
      organizing: byCategory.organizing.length,
      learning: byCategory.learning.length,
      utility: byCategory.utility.length,
    },
    withFeatureFlag: ALL_SKILLS_METADATA.filter((s) => s.featureFlag).length,
  };
}
