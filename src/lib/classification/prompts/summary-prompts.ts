/**
 * Type-Specific Summary Prompts
 * Customized prompts for different content types
 *
 * Each content type has:
 * - System prompt with role and expertise
 * - User prompt template with type-specific structure
 * - API parameters (temperature, maxTokens)
 * - Summary length guidelines
 */

import type { ContentType } from "../content-type-detector";

/**
 * Summary length configuration based on content length
 */
export interface SummaryLengthConfig {
  min: number;
  max: number;
}

/**
 * Prompt configuration for each content type
 */
export interface TypePromptConfig {
  systemPrompt: string;
  summaryStructure: string;
  tagRequirements: string;
  temperature: number;
  getSummaryLength: (contentLength: number) => SummaryLengthConfig;
}

// ============================================================
// Article Type Prompt (Default)
// ============================================================

const ARTICLE_PROMPT: TypePromptConfig = {
  systemPrompt: `你是一个专业的内容编辑，擅长提炼文章核心观点和关键信息。你的摘要清晰、准确、有洞察力。
请严格按照 JSON 格式返回结果。重要：确保摘要是完整的句子，绝对不要在句子中间截断。`,

  summaryStructure: `【摘要结构要求】
请按以下逻辑组织摘要内容（无需添加标题标记，系统会自动识别结构）：

1. 第一句话：概括文章的核心观点或主要结论
2. 后续内容：列举2-4个支撑论据或关键信息点，用数字编号格式（如"1）xxx；2）xxx"）

【输出格式示例】
本文揭示了开源AI模型的真实使用场景与公众认知存在巨大差异。1）角色扮演类应用占据了开源AI模型使用量的至少50%；2）这一现象颠覆了公众对AI主要用于代码、邮件、资料查询等工具性场景的普遍认知；3）它凸显了AI在满足人类情感陪伴、娱乐和创意表达等非工具性需求方面的巨大市场潜力。

【输出风格】
- 使用书面语，保持客观
- 优先保留具体信息（数据、案例、专业术语）
- 避免笼统描述（如"作者认为很重要"）
- 关键信息点用数字编号+括号格式（如"1）"、"2）"），用分号分隔`,

  tagRequirements: `【标签要求 - 文章类】
1. 必须包含：1个领域标签（如"前端开发"、"产品设计"、"商业分析"）
2. 推荐包含：1-2个主题标签（如"用户增长"、"技术架构"）
3. 可选包含：1个价值标签（如"深度分析"、"案例研究"、"行业洞察"）`,

  temperature: 0.7,

  getSummaryLength: (contentLength: number): SummaryLengthConfig => {
    if (contentLength < 1000) return { min: 100, max: 200 };
    if (contentLength <= 3000) return { min: 200, max: 350 };
    if (contentLength <= 5000) return { min: 300, max: 500 };
    return { min: 400, max: 700 };
  },
};

// ============================================================
// Tutorial Type Prompt
// ============================================================

const TUTORIAL_PROMPT: TypePromptConfig = {
  systemPrompt: `你是一个技术文档专家，擅长总结教程和指南的核心步骤。你的摘要结构清晰、步骤明确、便于快速回顾。
请严格按照 JSON 格式返回结果。重要：确保摘要是完整的句子，绝对不要在句子中间截断。`,

  summaryStructure: `【摘要结构要求】
请按以下逻辑组织摘要内容（无需添加标题标记，系统会自动识别结构）：

1. 第一句话：说明本教程教什么、实现什么目标
2. 后续内容：列举3-5个关键步骤，用数字编号格式（如"1）xxx；2）xxx"）

【输出格式示例】
本教程讲解如何使用Docker部署Next.js应用到生产环境。1）创建Dockerfile配置多阶段构建；2）编写docker-compose.yml定义服务；3）配置Nginx反向代理；4）使用GitHub Actions实现自动部署。

【重要】
- 保留具体的技术栈名称（如 React、Node.js、Docker）
- 步骤描述要具体可操作，避免模糊表述
- 关键步骤用数字编号+括号格式（如"1）"、"2）"），用分号分隔`,

  tagRequirements: `【标签要求 - 教程类】
1. 必须包含：具体技术栈标签（如"React"、"Python"、"Docker"）
2. 必须包含：学习阶段标签（如"入门"、"进阶"、"实战"）
3. 推荐包含：应用场景标签（如"项目搭建"、"性能优化"、"部署运维"）`,

  temperature: 0.3, // Lower temperature for accuracy

  getSummaryLength: (contentLength: number): SummaryLengthConfig => {
    if (contentLength < 1000) return { min: 150, max: 250 };
    if (contentLength <= 3000) return { min: 250, max: 400 };
    return { min: 350, max: 550 };
  },
};

// ============================================================
// Video Type Prompt
// ============================================================

const VIDEO_PROMPT: TypePromptConfig = {
  systemPrompt: `你是一个视频内容分析师，擅长从视频标题、描述和字幕中提炼核心信息。你的摘要简洁、重点突出、便于快速了解视频内容。
请严格按照 JSON 格式返回结果。重要：确保摘要是完整的句子，绝对不要在句子中间截断。`,

  summaryStructure: `【摘要结构要求】
请按以下逻辑组织摘要内容（无需添加标题标记，系统会自动识别结构）：

1. 第一句话：说明这个视频讲什么主题
2. 后续内容：列举2-4个核心信息点，用数字编号格式（如"1）xxx；2）xxx"）

【输出格式示例】
本视频详细评测了M3 Max MacBook Pro的性能表现和日常使用体验。1）CPU多核性能提升40%，适合视频剪辑；2）续航达到22小时，全天使用无压力；3）发热控制优秀，重负载下仍保持安静。

【输出风格】
- 视频内容可能口语化，请用书面语总结
- 忽略开场白、结尾彩蛋、赞助广告等非核心内容
- 关键信息点用数字编号+括号格式（如"1）"、"2）"），用分号分隔`,

  tagRequirements: `【标签要求 - 视频类】
1. 必须包含：视频主题的核心关键词
2. 如果是技术视频：包含具体技术栈标签
3. 推荐包含：视频类型标签（如"教程"、"评测"、"访谈"、"Vlog"）
4. 可选包含：适合人群标签（如"初学者"、"进阶"）`,

  temperature: 0.5, // Balanced for video content

  getSummaryLength: (contentLength: number): SummaryLengthConfig => {
    // Video descriptions are usually shorter
    if (contentLength < 500) return { min: 80, max: 150 };
    if (contentLength <= 2000) return { min: 150, max: 250 };
    return { min: 200, max: 350 };
  },
};

// ============================================================
// Tool Type Prompt
// ============================================================

const TOOL_PROMPT: TypePromptConfig = {
  systemPrompt: `你是一个产品分析师，擅长评估工具和服务的核心价值。你的摘要客观、结构化、便于快速了解工具特点和适用场景。
请严格按照 JSON 格式返回结果。重要：确保摘要是完整的句子，绝对不要在句子中间截断。`,

  summaryStructure: `【摘要结构要求】
请按以下逻辑组织摘要内容（无需添加标题标记，系统会自动识别结构）：

1. 第一句话：说明这是什么工具，解决什么问题
2. 后续内容：列举3-5个核心功能或特点，用数字编号格式（如"1）xxx；2）xxx"）

【输出格式示例】
Cursor是一款基于VSCode的AI编程IDE，将GPT-4深度集成到代码编辑体验中。1）智能代码补全，支持多行预测；2）内置AI对话，可直接询问代码问题；3）一键重构和Bug修复；4）免费版每月2000次补全，Pro版$20/月。

【重要】
- 保持客观，不夸大功能
- 如果有明确的定价信息，请保留
- 关键信息点用数字编号+括号格式（如"1）"、"2）"），用分号分隔`,

  tagRequirements: `【标签要求 - 工具类】
1. 必须包含：工具类型标签（如"效率工具"、"设计工具"、"开发工具"、"AI工具"）
2. 必须包含：具体用途标签（如"笔记管理"、"原型设计"、"代码编辑"）
3. 推荐包含：平台标签（如"跨平台"、"Web"、"Mac"、"iOS"）
4. 可选包含：定价标签（如"免费"、"付费"、"订阅制"、"开源"）`,

  temperature: 0.3, // Lower temperature for objectivity

  getSummaryLength: (contentLength: number): SummaryLengthConfig => {
    if (contentLength < 500) return { min: 100, max: 180 };
    if (contentLength <= 2000) return { min: 180, max: 300 };
    return { min: 250, max: 400 };
  },
};

// ============================================================
// Prompt Configuration Map
// ============================================================

const PROMPT_CONFIGS: Record<ContentType, TypePromptConfig> = {
  article: ARTICLE_PROMPT,
  tutorial: TUTORIAL_PROMPT,
  video: VIDEO_PROMPT,
  tool: TOOL_PROMPT,
};

/**
 * Get prompt configuration for a content type
 */
export function getPromptConfig(contentType: ContentType): TypePromptConfig {
  return PROMPT_CONFIGS[contentType] || PROMPT_CONFIGS.article;
}

/**
 * Build the complete user prompt for AI
 */
export function buildTypeSpecificPrompt(
  contentType: ContentType,
  title: string,
  description?: string,
  content?: string,
  existingFolderNames?: string[],
): string {
  const config = getPromptConfig(contentType);

  // Calculate content length for summary limits
  const contentLength =
    (title?.length || 0) + (description?.length || 0) + (content?.length || 0);
  const { min, max } = config.getSummaryLength(contentLength);

  // Build folder context
  let folderContext = "";
  if (existingFolderNames && existingFolderNames.length > 0) {
    const meaningfulFolders = existingFolderNames
      .filter((name) => name.length <= 20 && !name.includes("待整理"))
      .slice(0, 10);

    if (meaningfulFolders.length > 0) {
      folderContext = `\n\n【用户现有文件夹】\n${meaningfulFolders.join("、")}\n参考这些文件夹名称生成相关标签，便于自动归类`;
    }
  }

  // Build prompt
  let prompt = `请对以下内容进行深度分析，生成高质量摘要。

【内容信息】
标题：${title}`;

  if (description) {
    prompt += `\n描述：${description}`;
  }

  if (content) {
    // Truncate content to 5000 chars
    const truncatedContent = content.substring(0, 5000);
    prompt += `\n\n正文内容：\n${truncatedContent}`;
  }

  if (folderContext) {
    prompt += folderContext;
  }

  // Add type-specific structure requirements
  prompt += `\n\n【摘要长度】${min}-${max}字

${config.summaryStructure}

${config.tagRequirements}

【返回格式】（严格 JSON）
{
  "summary": "完整摘要内容",
  "tags": ["标签1", "标签2", "标签3"]
}

【重要提醒】
1. 摘要必须是完整的句子，以句号、问号或感叹号结尾
2. 如果内容较长，优先保证核心观点的完整表达
3. 返回前请检查 JSON 格式是否完整闭合

只返回 JSON，不要任何额外说明。`;

  return prompt;
}
