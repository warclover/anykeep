/**
 * 统一蓝图显示配置 (v1 + v2)
 * @module knowledge-studio/blueprint/unified-display-config
 *
 * 解决 v1/v2 版本混用问题：
 * - v1 蓝图类型: debater, blogger, thread, tutorial, feynman (5种)
 * - v2 蓝图 ID: geek-arxiv_decoder, creator-video_script 等 (14种)
 *
 * 所有蓝图类型都存入 synthesis_reports.blueprint_type 字段
 */

// ============================================================
// Types
// ============================================================

/**
 * 蓝图显示配置
 */
export interface BlueprintDisplayConfig {
  /** 显示名称 */
  name: string;
  /** 描述 */
  description: string;
  /** 图标 (emoji) */
  icon: string;
  /** 预估生成时间 */
  estimatedTime: string;
  /** 版本标识 */
  version: "v1" | "v2";
  /** 分类 (v2) */
  category?: "geek" | "creator" | "business" | "professional";
}

// ============================================================
// V1 蓝图配置 (5种)
// ============================================================

const V1_BLUEPRINTS: Record<string, BlueprintDisplayConfig> = {
  debater: {
    name: "辩论家",
    description: "正反论证，引用支撑",
    icon: "⚖️",
    estimatedTime: "30-60秒",
    version: "v1",
  },
  blogger: {
    name: "博主",
    description: "个人化叙事，融合观点",
    icon: "✍️",
    estimatedTime: "20-40秒",
    version: "v1",
  },
  thread: {
    name: "推文串",
    description: "分段式内容，渐进展开",
    icon: "🧵",
    estimatedTime: "15-30秒",
    version: "v1",
  },
  tutorial: {
    name: "教程",
    description: "步骤化讲解，代码示例",
    icon: "📚",
    estimatedTime: "40-80秒",
    version: "v1",
  },
  feynman: {
    name: "费曼",
    description: "简化解释，类比丰富",
    icon: "🎓",
    estimatedTime: "25-50秒",
    version: "v1",
  },
};

// ============================================================
// V2 蓝图配置 (14种)
// ============================================================

const V2_BLUEPRINTS: Record<string, BlueprintDisplayConfig> = {
  // Geek (4)
  "geek-arxiv_decoder": {
    name: "论文实战解码器",
    description: "将 arXiv 论文和代码仓库转换为实战评测报告",
    icon: "📄",
    estimatedTime: "60-120秒",
    version: "v2",
    category: "geek",
  },
  "geek-tutorial_architect": {
    name: "技术教程架构师",
    description: "生成结构化技术教程",
    icon: "📐",
    estimatedTime: "60-120秒",
    version: "v2",
    category: "geek",
  },
  "geek-prd_master": {
    name: "PRD大师",
    description: "生成专业产品需求文档",
    icon: "📋",
    estimatedTime: "60-120秒",
    version: "v2",
    category: "geek",
  },
  "geek-system_design_review": {
    name: "系统架构评审官",
    description: "系统设计评审和改进建议",
    icon: "🏗️",
    estimatedTime: "60-120秒",
    version: "v2",
    category: "geek",
  },

  // Creator (3)
  "creator-scriptwriter": {
    name: "视频编剧",
    description: "生成视频脚本和分镜",
    icon: "🎬",
    estimatedTime: "45-90秒",
    version: "v2",
    category: "creator",
  },
  "creator-newsletter": {
    name: "周刊策展",
    description: "策划和编辑周刊内容",
    icon: "📰",
    estimatedTime: "45-90秒",
    version: "v2",
    category: "creator",
  },
  "creator-interview_prep": {
    name: "访谈准备",
    description: "准备访谈问题和背景资料",
    icon: "🎙️",
    estimatedTime: "45-90秒",
    version: "v2",
    category: "creator",
  },

  // Business (3)
  "business-competitor_scout": {
    name: "竞品侦察",
    description: "竞争对手分析和洞察",
    icon: "🔍",
    estimatedTime: "60-120秒",
    version: "v2",
    category: "business",
  },
  "business-due_diligence": {
    name: "尽调专家",
    description: "尽职调查报告生成",
    icon: "📊",
    estimatedTime: "60-120秒",
    version: "v2",
    category: "business",
  },
  "business-pitch_narrative": {
    name: "故事线",
    description: "投资叙事和故事线构建",
    icon: "📈",
    estimatedTime: "60-120秒",
    version: "v2",
    category: "business",
  },

  // Professional (4)
  "professional-tech_decider": {
    name: "技术决策",
    description: "技术选型和决策分析",
    icon: "⚙️",
    estimatedTime: "60-120秒",
    version: "v2",
    category: "professional",
  },
  "professional-literature_matrix": {
    name: "文献矩阵",
    description: "文献综述和对比分析",
    icon: "📚",
    estimatedTime: "60-120秒",
    version: "v2",
    category: "professional",
  },
  "professional-seo_pillar": {
    name: "SEO支柱",
    description: "SEO优化内容策略",
    icon: "🔗",
    estimatedTime: "60-120秒",
    version: "v2",
    category: "professional",
  },
  "professional-workshop_designer": {
    name: "课程设计",
    description: "工作坊和课程设计",
    icon: "🎓",
    estimatedTime: "60-120秒",
    version: "v2",
    category: "professional",
  },
};

// ============================================================
// 统一配置
// ============================================================

/**
 * 统一蓝图显示配置 (v1 + v2)
 */
export const UNIFIED_BLUEPRINT_DISPLAY_CONFIG: Record<
  string,
  BlueprintDisplayConfig
> = {
  ...V1_BLUEPRINTS,
  ...V2_BLUEPRINTS,
};

/**
 * 获取蓝图显示配置
 * @param blueprintType 蓝图类型或ID
 * @returns 显示配置，如果未找到返回默认配置
 */
export function getBlueprintDisplayConfig(
  blueprintType: string | null | undefined,
): BlueprintDisplayConfig {
  if (!blueprintType) {
    return {
      name: "未知蓝图",
      description: "",
      icon: "📝",
      estimatedTime: "-",
      version: "v1",
    };
  }

  const config = UNIFIED_BLUEPRINT_DISPLAY_CONFIG[blueprintType];
  if (config) {
    return config;
  }

  // 回退：尝试从 BlueprintRegistry 获取 v2 蓝图信息
  // 如果是未知类型，返回默认配置并使用原始类型名称
  return {
    name: blueprintType,
    description: "",
    icon: "📝",
    estimatedTime: "-",
    version: blueprintType.includes("-") ? "v2" : "v1",
    category: blueprintType.split("-")[0] as BlueprintDisplayConfig["category"],
  };
}

/**
 * 获取所有 v1 蓝图类型
 */
export function getV1BlueprintTypes(): string[] {
  return Object.keys(V1_BLUEPRINTS);
}

/**
 * 获取所有 v2 蓝图 ID
 */
export function getV2BlueprintIds(): string[] {
  return Object.keys(V2_BLUEPRINTS);
}

/**
 * 获取所有蓝图类型（v1 + v2）
 */
export function getAllBlueprintTypes(): string[] {
  return Object.keys(UNIFIED_BLUEPRINT_DISPLAY_CONFIG);
}

/**
 * 判断是否为 v2 蓝图
 */
export function isV2Blueprint(blueprintType: string): boolean {
  return blueprintType in V2_BLUEPRINTS || blueprintType.includes("-");
}

/**
 * 按分类获取蓝图
 */
export function getBlueprintsByCategory(): Record<
  string,
  Array<{ id: string; config: BlueprintDisplayConfig }>
> {
  const result: Record<
    string,
    Array<{ id: string; config: BlueprintDisplayConfig }>
  > = {
    v1: [],
    geek: [],
    creator: [],
    business: [],
    professional: [],
  };

  for (const [id, config] of Object.entries(UNIFIED_BLUEPRINT_DISPLAY_CONFIG)) {
    if (config.version === "v1") {
      result.v1.push({ id, config });
    } else if (config.category) {
      result[config.category].push({ id, config });
    }
  }

  return result;
}
