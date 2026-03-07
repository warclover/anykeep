/**
 * 内容类型专用 Prompt 配置
 *
 * 为每种内容类型定义专用的 System Prompt 角色、
 * 摘要结构指引、温度参数和长度策略。
 *
 * @version 1.0.0
 * @since 2026-03-07
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 摘要长度范围
 */
export interface SummaryLengthRange {
  /** 最小字数 */
  min: number;
  /** 最大字数 */
  max: number;
}

/**
 * 内容类型 Prompt 配置
 */
export interface ContentTypePromptConfig {
  /** System Prompt 角色定义 */
  systemRole: string;
  /** 摘要结构要求（追加到 user prompt） */
  structureGuide: string;
  /** 温度参数 */
  temperature: number;
  /** 摘要长度策略：根据原文长度计算摘要字数范围 */
  getSummaryLength: (contentLength: number) => SummaryLengthRange;
}

// ============================================================================
// 长度策略工具函数
// ============================================================================

/**
 * 默认长度策略：按比例缩放，带上下限
 *
 * @param contentLength - 原文字符数
 * @param ratio - 摘要/原文 比率
 * @param minLength - 最小字数
 * @param maxLength - 最大字数
 */
function scaledLength(
  contentLength: number,
  ratio: number,
  minLength: number,
  maxLength: number,
): SummaryLengthRange {
  const target = Math.round(contentLength * ratio);
  const min = Math.max(minLength, Math.round(target * 0.8));
  const max = Math.min(maxLength, Math.round(target * 1.2));
  return { min, max };
}

// ============================================================================
// 内容类型配置
// ============================================================================

/** 技术文章配置 */
const ARTICLE_CONFIG: ContentTypePromptConfig = {
  systemRole:
    "你是一位资深技术编辑，擅长提炼文章核心观点、技术方案和实践价值。你的摘要注重逻辑清晰和信息密度。",
  structureGuide: [
    "- tldr：用一句话概括文章的核心主题和价值主张",
    "- key_points：提炼 3-5 个核心技术观点或方案要点，每条 15-30 字",
    "- keywords：提取 5 个技术关键词，优先包含框架/工具/概念名称",
    "- sentiment：根据作者对技术方案的态度判断情感倾向",
    "- reading_time：根据内容深度和长度估算阅读分钟数",
  ].join("\n"),
  temperature: 0.7,
  getSummaryLength: (len) => scaledLength(len, 0.08, 80, 300),
};

/** 编程教程配置 */
const TUTORIAL_CONFIG: ContentTypePromptConfig = {
  systemRole:
    "你是一位技术教育专家，擅长提炼教程的学习目标、关键步骤和实操要点。你的摘要注重可操作性和学习路径。",
  structureGuide: [
    "- tldr：一句话概括教程教什么、用什么技术、达到什么效果",
    "- key_points：提炼 3-5 个关键学习点或技术步骤",
    "- keywords：提取 5 个技术关键词，包含核心技术栈和工具",
    "- action_items：必须提供 3-5 个具体可执行的操作步骤",
    "- reading_time：根据教程复杂度估算完整跟做所需时间",
  ].join("\n"),
  temperature: 0.3,
  getSummaryLength: (len) => scaledLength(len, 0.1, 100, 400),
};

/** 科技新闻配置 */
const NEWS_CONFIG: ContentTypePromptConfig = {
  systemRole:
    "你是一位资深新闻编辑，擅长提炼新闻核心事实和影响分析。你的摘要注重客观准确，突出 5W1H 要素。",
  structureGuide: [
    "- tldr：一句话概括新闻核心事件和影响，包含关键数字",
    "- key_points：提炼 3-5 个核心事实要点，优先包含具体数据和时间节点",
    "- keywords：提取 5 个关键词，包含涉及的公司/产品/人物名称",
    "- sentiment：根据新闻事件的正面/负面影响判断",
    "- reading_time：新闻通常 2-5 分钟",
  ].join("\n"),
  temperature: 0.4,
  getSummaryLength: (len) => scaledLength(len, 0.06, 60, 200),
};

/** 观点评论配置 */
const OPINION_CONFIG: ContentTypePromptConfig = {
  systemRole:
    "你是一位批判性思维专家，擅长提炼论点、论据和逻辑结构。你的摘要注重呈现作者立场和论证过程，保持客观中立。",
  structureGuide: [
    "- tldr：一句话概括作者的核心论点和立场",
    "- key_points：第一条为核心论点，后续为支撑论据或反驳要点",
    "- keywords：提取 5 个关键词，包含争议话题和核心概念",
    "- sentiment：根据作者对讨论主题的态度判断（支持=positive/反对=negative/中立分析=neutral）",
    "- reading_time：根据论述深度估算",
  ].join("\n"),
  temperature: 0.6,
  getSummaryLength: (len) => scaledLength(len, 0.08, 80, 250),
};

/** 技术视频配置 */
const VIDEO_CONFIG: ContentTypePromptConfig = {
  systemRole:
    "你是一位视频内容分析专家，擅长从视频描述和字幕中提取核心知识点和演示要点。你的摘要帮助用户决定是否值得观看。",
  structureGuide: [
    "- tldr：一句话概括视频演示的内容和核心价值",
    "- key_points：提炼 3-5 个视频中演示或讲解的核心知识点",
    "- keywords：提取 5 个关键词，包含演示的技术和工具",
    "- reading_time：使用视频实际时长（分钟），如无法判断则估算",
    "- sentiment：根据视频整体基调判断",
  ].join("\n"),
  temperature: 0.5,
  getSummaryLength: (len) => scaledLength(len, 0.1, 60, 250),
};

/** 工具推荐配置 */
const TOOL_CONFIG: ContentTypePromptConfig = {
  systemRole:
    "你是一位开发工具评测专家，擅长提炼工具的核心功能、性能数据和使用场景。你的摘要帮助开发者快速判断工具是否适合自己。",
  structureGuide: [
    "- tldr：一句话概括工具定位、核心优势和适用场景",
    "- key_points：提炼核心功能特性、性能指标和与竞品的对比",
    "- keywords：提取 5 个关键词，包含工具名、技术栈和竞品名称",
    "- action_items：提供 2-3 个快速上手步骤（安装/配置/迁移）",
    "- sentiment：根据作者推荐程度判断",
  ].join("\n"),
  temperature: 0.3,
  getSummaryLength: (len) => scaledLength(len, 0.08, 60, 250),
};

/** 案例分析配置 */
const CASE_STUDY_CONFIG: ContentTypePromptConfig = {
  systemRole:
    "你是一位技术案例分析专家，擅长提炼问题背景、解决方案和量化成果。你的摘要注重方案的可复制性和数据支撑。",
  structureGuide: [
    "- tldr：一句话概括谁解决了什么问题、用了什么方案、取得了什么成果",
    "- key_points：按「问题→方案→结果」的结构提炼，优先包含具体数据",
    "- keywords：提取 5 个关键词，包含公司/团队名、技术方案和度量指标",
    "- sentiment：案例分析通常为 positive（成功案例）或 neutral（经验总结）",
    "- reading_time：根据案例复杂度估算",
  ].join("\n"),
  temperature: 0.4,
  getSummaryLength: (len) => scaledLength(len, 0.08, 80, 350),
};

/** API 文档 / 参考资料配置 */
const REFERENCE_CONFIG: ContentTypePromptConfig = {
  systemRole:
    "你是一位技术文档专家，擅长提取 API 接口、参数和使用方式。你的摘要注重准确性和实用性，帮助开发者快速查阅。",
  structureGuide: [
    "- tldr：一句话概括 API/文档覆盖的功能范围和核心用法",
    "- key_points：提炼核心 API 方法、关键参数和注意事项",
    "- keywords：提取 5 个关键词，包含 API 名称、方法名和相关技术",
    "- action_items：提供 2-3 个最常用的代码用法示例说明",
    "- reading_time：参考文档通常 3-8 分钟",
  ].join("\n"),
  temperature: 0.2,
  getSummaryLength: (len) => scaledLength(len, 0.06, 60, 200),
};

/** 学术研究 / 论文配置 */
const RESEARCH_CONFIG: ContentTypePromptConfig = {
  systemRole:
    "你是一位学术论文摘要专家，擅长提炼研究方法、核心发现和局限性。你的摘要遵循学术规范，注重客观性和严谨性。",
  structureGuide: [
    "- tldr：一句话概括研究问题、方法和核心发现",
    "- key_points：按「研究背景→方法→核心发现→局限性」结构提炼",
    "- keywords：提取 5 个学术关键词，包含研究领域、方法论和核心概念",
    "- sentiment：学术内容通常为 neutral",
    "- reading_time：根据论文长度和复杂度估算",
  ].join("\n"),
  temperature: 0.3,
  getSummaryLength: (len) => scaledLength(len, 0.06, 80, 300),
};

/** 对比评测配置 */
const COMPARISON_CONFIG: ContentTypePromptConfig = {
  systemRole:
    "你是一位技术评测专家，擅长提炼多方案的对比维度、优劣势和适用场景。你的摘要帮助读者快速做出技术选型决策。",
  structureGuide: [
    "- tldr：一句话概括对比了哪些方案、各自适用什么场景",
    "- key_points：每条聚焦一个对比维度（性能/易用性/生态/成本等），给出结论",
    "- keywords：提取 5 个关键词，包含所有被对比的技术方案名称",
    "- sentiment：对比类内容通常为 neutral",
    "- reading_time：根据对比深度估算",
  ].join("\n"),
  temperature: 0.4,
  getSummaryLength: (len) => scaledLength(len, 0.08, 80, 300),
};

/** 社交媒体帖子配置 */
const SOCIAL_POST_CONFIG: ContentTypePromptConfig = {
  systemRole:
    "你是一位社交媒体内容分析师，擅长从简短的社交帖子中提取核心信息和观点。你的摘要简洁精炼，适配碎片化内容。",
  structureGuide: [
    "- tldr：直接提炼帖子的核心信息，不超过 30 字",
    "- key_points：提炼 2-3 个要点即可，社交帖子内容通常较短",
    "- keywords：提取 3-5 个关键词或话题标签",
    "- sentiment：根据帖子语气和情绪判断",
    "- reading_time：社交帖子通常 1-2 分钟",
  ].join("\n"),
  temperature: 0.6,
  getSummaryLength: (len) => scaledLength(len, 0.15, 30, 120),
};

/** 食谱 / 教程类配置 */
const RECIPE_CONFIG: ContentTypePromptConfig = {
  systemRole:
    "你是一位生活方式内容编辑，擅长提炼食谱、手工教程等实操类内容的关键步骤和材料清单。你的摘要注重可操作性。",
  structureGuide: [
    "- tldr：一句话概括做什么、核心特点、难度和耗时",
    "- key_points：提炼关键步骤和注意事项，突出核心技巧",
    "- keywords：提取 5 个关键词，包含菜名/项目名、核心食材/材料和烹饪方式",
    "- action_items：必须提供完整的操作步骤清单",
    "- reading_time：估算实际操作所需时间（分钟）",
  ].join("\n"),
  temperature: 0.3,
  getSummaryLength: (len) => scaledLength(len, 0.1, 60, 250),
};

// ============================================================================
// 导出
// ============================================================================

/**
 * 全部内容类型 Prompt 配置，按类型标识索引
 */
export const CONTENT_TYPE_CONFIGS: Record<string, ContentTypePromptConfig> = {
  article: ARTICLE_CONFIG,
  tutorial: TUTORIAL_CONFIG,
  news: NEWS_CONFIG,
  opinion: OPINION_CONFIG,
  video: VIDEO_CONFIG,
  tool: TOOL_CONFIG,
  case_study: CASE_STUDY_CONFIG,
  reference: REFERENCE_CONFIG,
  research: RESEARCH_CONFIG,
  comparison: COMPARISON_CONFIG,
  social_post: SOCIAL_POST_CONFIG,
  recipe: RECIPE_CONFIG,
};

/**
 * 获取指定内容类型的 Prompt 配置
 *
 * 如果指定类型不存在，回退到 article 配置。
 *
 * @param contentType - 内容类型标识
 * @returns 对应的 Prompt 配置
 *
 * @example
 * ```typescript
 * const config = getContentTypeConfig("tutorial");
 * console.log(config.systemRole);
 * // "你是一位技术教育专家..."
 *
 * const lengthRange = config.getSummaryLength(5000);
 * console.log(lengthRange);
 * // { min: 400, max: 600 }
 * ```
 */
export function getContentTypeConfig(
  contentType: string,
): ContentTypePromptConfig {
  return CONTENT_TYPE_CONFIGS[contentType] ?? CONTENT_TYPE_CONFIGS["article"];
}
