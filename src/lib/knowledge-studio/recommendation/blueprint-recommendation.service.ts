/**
 * Blueprint Recommendation Service
 * @module knowledge-studio/recommendation
 *
 * P1-3: 基于素材内容智能推荐最佳蓝图
 * - 分析素材关键词、平台、内容类型
 * - 匹配蓝图 targetUsers、tags、category
 * - 生成推荐原因
 */

import { getBlueprintRegistry } from "../blueprint/blueprint-registry";
import type { MaterialInput } from "../blueprint/types";

// ============================================================
// Types
// ============================================================

/**
 * 素材分析结果
 */
export interface MaterialAnalysis {
  /** 检测到的主题/关键词 */
  topics: string[];
  /** 内容类型 */
  contentType: "technical" | "business" | "creative" | "academic" | "general";
  /** 主要语言 */
  language: "zh" | "en" | "mixed";
  /** 来源平台 */
  platforms: string[];
  /** 估计技术难度 */
  technicalLevel: "beginner" | "intermediate" | "advanced";
  /** 内容长度级别 */
  lengthLevel: "short" | "medium" | "long";
}

/**
 * 蓝图推荐项
 */
export interface BlueprintRecommendation {
  /** 蓝图 ID */
  blueprintId: string;
  /** 蓝图显示名 */
  displayName: string;
  /** 蓝图图标 */
  icon: string;
  /** 蓝图描述 */
  description: string;
  /** 推荐分数 (0-100) */
  score: number;
  /** 推荐原因 */
  reasons: string[];
  /** 匹配的标签 */
  matchedTags: string[];
  /** 权限层级 */
  tier: string;
}

/**
 * 推荐结果
 */
export interface RecommendationResult {
  /** 分析结果 */
  analysis: MaterialAnalysis;
  /** 推荐列表（按分数排序） */
  recommendations: BlueprintRecommendation[];
}

// ============================================================
// Constants
// ============================================================

/** 技术相关关键词 */
const TECHNICAL_KEYWORDS = [
  "代码",
  "编程",
  "开发",
  "api",
  "sdk",
  "框架",
  "库",
  "算法",
  "数据结构",
  "架构",
  "部署",
  "git",
  "docker",
  "kubernetes",
  "react",
  "vue",
  "node",
  "python",
  "java",
  "typescript",
  "javascript",
  "前端",
  "后端",
  "全栈",
  "机器学习",
  "深度学习",
  "ai",
  "llm",
  "gpt",
  "模型",
  "训练",
  "推理",
  "arxiv",
  "论文",
  "研究",
];

/** 商业相关关键词 */
const BUSINESS_KEYWORDS = [
  "商业",
  "产品",
  "市场",
  "营销",
  "运营",
  "增长",
  "用户",
  "转化",
  "roi",
  "kpi",
  "融资",
  "投资",
  "估值",
  "创业",
  "创始人",
  "ceo",
  "战略",
  "竞品",
  "定价",
  "收入",
  "利润",
];

/** 创意相关关键词 */
const CREATIVE_KEYWORDS = [
  "创意",
  "设计",
  "文案",
  "脚本",
  "故事",
  "内容",
  "视频",
  "直播",
  "播客",
  "newsletter",
  "公众号",
  "小红书",
  "抖音",
  "b站",
  "bilibili",
  "youtube",
  "短视频",
  "vlog",
  "种草",
  "测评",
];

/** 学术相关关键词 */
const ACADEMIC_KEYWORDS = [
  "论文",
  "研究",
  "实验",
  "方法",
  "结论",
  "假设",
  "验证",
  "分析",
  "综述",
  "引用",
  "文献",
  "期刊",
  "会议",
  "arxiv",
  "ieee",
  "acm",
  "nature",
  "science",
];

/** 平台到内容类型映射 */
const PLATFORM_CONTENT_MAP: Record<string, string[]> = {
  github: ["technical", "code"],
  arxiv: ["academic", "research"],
  微信公众号: ["creative", "business"],
  小红书: ["creative", "lifestyle"],
  bilibili: ["creative", "video"],
  知乎: ["technical", "academic"],
  掘金: ["technical", "tutorial"],
  medium: ["technical", "creative"],
  youtube: ["creative", "video"],
};

// ============================================================
// Analysis Functions
// ============================================================

/**
 * 分析素材内容
 */
function analyzeMaterials(materials: MaterialInput[]): MaterialAnalysis {
  const allContent = materials
    .map((m) => `${m.title} ${m.content}`)
    .join(" ")
    .toLowerCase();

  const totalLength = materials.reduce(
    (sum, m) => sum + (m.content?.length ?? 0),
    0,
  );

  // 检测关键词
  const technicalCount = TECHNICAL_KEYWORDS.filter((kw) =>
    allContent.includes(kw.toLowerCase()),
  ).length;
  const businessCount = BUSINESS_KEYWORDS.filter((kw) =>
    allContent.includes(kw.toLowerCase()),
  ).length;
  const creativeCount = CREATIVE_KEYWORDS.filter((kw) =>
    allContent.includes(kw.toLowerCase()),
  ).length;
  const academicCount = ACADEMIC_KEYWORDS.filter((kw) =>
    allContent.includes(kw.toLowerCase()),
  ).length;

  // 确定内容类型
  const typeCounts = [
    { type: "technical" as const, count: technicalCount },
    { type: "business" as const, count: businessCount },
    { type: "creative" as const, count: creativeCount },
    { type: "academic" as const, count: academicCount },
  ];
  typeCounts.sort((a, b) => b.count - a.count);
  const contentType = typeCounts[0].count > 0 ? typeCounts[0].type : "general";

  // 检测语言
  const chineseChars = (allContent.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const englishWords = (allContent.match(/[a-z]+/gi) ?? []).length;
  let language: "zh" | "en" | "mixed" = "zh";
  if (chineseChars > 0 && englishWords > 0) {
    const ratio = chineseChars / (chineseChars + englishWords);
    language = ratio > 0.7 ? "zh" : ratio < 0.3 ? "en" : "mixed";
  } else if (englishWords > chineseChars) {
    language = "en";
  }

  // 提取平台
  const platforms = [
    ...new Set(materials.map((m) => m.platform).filter(Boolean) as string[]),
  ];

  // 提取主题
  const topics: string[] = [];
  [...TECHNICAL_KEYWORDS, ...BUSINESS_KEYWORDS, ...CREATIVE_KEYWORDS].forEach(
    (kw) => {
      if (allContent.includes(kw.toLowerCase()) && topics.length < 5) {
        topics.push(kw);
      }
    },
  );

  // 确定技术难度
  const advancedKeywords = ["架构", "算法", "论文", "研究", "深度学习", "llm"];
  const hasAdvanced = advancedKeywords.some((kw) =>
    allContent.includes(kw.toLowerCase()),
  );
  const technicalLevel: "beginner" | "intermediate" | "advanced" = hasAdvanced
    ? "advanced"
    : technicalCount > 3
      ? "intermediate"
      : "beginner";

  // 内容长度
  const lengthLevel: "short" | "medium" | "long" =
    totalLength < 2000 ? "short" : totalLength < 10000 ? "medium" : "long";

  return {
    topics,
    contentType,
    language,
    platforms,
    technicalLevel,
    lengthLevel,
  };
}

/**
 * 计算蓝图与素材的匹配分数
 */
function calculateMatchScore(
  analysis: MaterialAnalysis,
  blueprintTags: string[] = [],
  blueprintCategory?: string,
): { score: number; reasons: string[]; matchedTags: string[] } {
  let score = 50; // 基础分
  const reasons: string[] = [];
  const matchedTags: string[] = [];

  const lowerTags = blueprintTags.map((t) => t.toLowerCase());
  const lowerTopics = analysis.topics.map((t) => t.toLowerCase());

  // 标签匹配（每匹配一个 +10 分）
  lowerTopics.forEach((topic) => {
    if (lowerTags.includes(topic)) {
      score += 10;
      matchedTags.push(topic);
    }
  });

  // 平台匹配
  analysis.platforms.forEach((platform) => {
    const platformTypes = PLATFORM_CONTENT_MAP[platform.toLowerCase()];
    if (platformTypes?.some((type) => lowerTags.includes(type))) {
      score += 15;
      reasons.push(`适合处理 ${platform} 内容`);
    }
  });

  // 内容类型匹配
  if (
    lowerTags.includes(analysis.contentType) ||
    blueprintCategory === analysis.contentType
  ) {
    score += 20;
    reasons.push(`匹配内容类型: ${analysis.contentType}`);
  }

  // 技术难度匹配
  if (
    analysis.technicalLevel === "advanced" &&
    (lowerTags.includes("深度") || lowerTags.includes("专业"))
  ) {
    score += 10;
    reasons.push("适合专业深度内容");
  }

  // 长度适配
  if (
    analysis.lengthLevel === "long" &&
    (lowerTags.includes("综合") || lowerTags.includes("报告"))
  ) {
    score += 10;
    reasons.push("适合长篇综合分析");
  }

  // 基于 category 的通用匹配
  if (blueprintCategory) {
    if (blueprintCategory === "geek" && analysis.contentType === "technical") {
      score += 15;
      reasons.push("Geek 蓝图适合技术内容");
    }
    if (
      blueprintCategory === "creator" &&
      analysis.contentType === "creative"
    ) {
      score += 15;
      reasons.push("Creator 蓝图适合创意内容");
    }
    if (
      blueprintCategory === "business" &&
      analysis.contentType === "business"
    ) {
      score += 15;
      reasons.push("Business 蓝图适合商业内容");
    }
  }

  // 如果没有匹配到任何特征，添加通用原因
  if (matchedTags.length > 0) {
    reasons.unshift(`素材关键词匹配: ${matchedTags.slice(0, 3).join(", ")}`);
  }

  // 限制分数在 0-100 之间
  score = Math.max(0, Math.min(100, score));

  return { score, reasons, matchedTags };
}

// ============================================================
// Main Service
// ============================================================

/**
 * 基于素材内容推荐蓝图
 *
 * @param materials - 用户选择的素材
 * @param userTier - 用户会员等级（用于过滤可用蓝图）
 * @param limit - 返回推荐数量限制
 * @returns 推荐结果
 */
export async function recommendBlueprints(
  materials: MaterialInput[],
  userTier: "free" | "pro" | "enterprise" = "free",
  limit = 5,
): Promise<RecommendationResult> {
  // 分析素材
  const analysis = analyzeMaterials(materials);

  // 获取用户可访问的蓝图
  const registry = getBlueprintRegistry();
  const accessibleBlueprints = registry.getAccessibleBlueprints(userTier);

  // 计算每个蓝图的匹配分数
  const recommendations: BlueprintRecommendation[] = accessibleBlueprints.map(
    (blueprint) => {
      const metadata = blueprint.getBlueprintMetadata();
      const { score, reasons, matchedTags } = calculateMatchScore(
        analysis,
        metadata.tags ?? [],
        metadata.category,
      );

      return {
        blueprintId: blueprint.blueprintId,
        displayName: blueprint.displayName,
        icon: blueprint.icon,
        description: blueprint.description,
        score,
        reasons,
        matchedTags,
        tier: blueprint.tier,
      };
    },
  );

  // 按分数排序
  recommendations.sort((a, b) => b.score - a.score);

  // 为没有特殊原因的推荐添加默认原因
  recommendations.forEach((rec) => {
    if (rec.reasons.length === 0) {
      rec.reasons.push("通用内容处理蓝图");
    }
  });

  return {
    analysis,
    recommendations: recommendations.slice(0, limit),
  };
}

/**
 * 快速获取推荐蓝图（不含详细分析）
 */
export async function getTopRecommendation(
  materials: MaterialInput[],
  userTier: "free" | "pro" | "enterprise" = "free",
): Promise<BlueprintRecommendation | null> {
  const result = await recommendBlueprints(materials, userTier, 1);
  return result.recommendations[0] ?? null;
}
