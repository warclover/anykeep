/**
 * AI 内容生成工具
 * 使用 DeepSeek API 生成摘要和标签
 */

import { logger } from "@/lib/logger";

export interface AIGenerateResult {
  summary: string;
  tags: string[];
}

export interface FolderRecommendation {
  folderId: number | null; // null 表示建议新建文件夹
  folderName: string; // 推荐的文件夹名称（已有或建议新建）
  confidence: number; // 置信度 0-100
  reason: string; // 推荐理由
  suggestNew: boolean; // 是否建议新建文件夹
}

interface ExistingFolder {
  id: number;
  name: string;
}

interface AIGenerateRequest {
  title: string;
  description?: string;
  content?: string;
  existingFolderNames?: string[]; // 用户现有文件夹名称（用于标签参考）
}

/**
 * 根据原文字数计算摘要上限
 * - < 1000 字：100-200 字摘要
 * - 1000-5000 字：300-500 字摘要
 * - > 5000 字：500-800 字摘要
 */
function getSummaryLimit(contentLength: number): { min: number; max: number } {
  if (contentLength < 1000) {
    return { min: 100, max: 200 };
  } else if (contentLength <= 5000) {
    return { min: 300, max: 500 };
  } else {
    return { min: 500, max: 800 };
  }
}

/**
 * 调用 DeepSeek API 生成摘要和标签
 */
async function callDeepSeekAPI(
  title: string,
  description?: string,
  content?: string,
  existingFolderNames?: string[],
): Promise<AIGenerateResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 环境变量未配置");
  }

  // 构建提示词
  const prompt = buildPrompt(title, description, content, existingFolderNames);

  try {
    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "你是一个专业的内容分析助手，擅长提取关键信息、生成结构化摘要和精准标签。请严格按照 JSON 格式返回结果。",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000, // 从 500 提升到 1000，支持更完整的摘要
        }),
        signal: AbortSignal.timeout(15000), // 15秒超时
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API 错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiContent = data.choices[0]?.message?.content;

    if (!aiContent) {
      throw new Error("AI 未返回内容");
    }

    // 解析 JSON 响应
    const result = parseAIResponse(aiContent);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(
        {
          error: error.message,
          action: "deepseek_api_call",
        },
        "AI Generator: DeepSeek API error",
      );
      throw new Error(`AI 生成失败: ${error.message}`);
    }
    throw new Error("AI 生成失败");
  }
}

/**
 * 识别内容类型
 */
function detectContentType(
  title: string,
  description?: string,
): "article" | "tutorial" | "video" | "tool" | "course" {
  const text = `${title} ${description || ""}`.toLowerCase();

  // 教程类
  if (
    text.includes("教程") ||
    text.includes("如何") ||
    text.includes("实战") ||
    text.includes("入门") ||
    text.includes("step by step") ||
    text.includes("手把手")
  ) {
    return "tutorial";
  }

  // 视频类
  if (
    title.includes("视频") ||
    text.includes("bilibili") ||
    text.includes("b站") ||
    text.includes("youtube") ||
    text.includes("【") || // 视频标题常用括号
    text.includes("bilibili.com")
  ) {
    return "video";
  }

  // 工具类
  if (
    text.includes("工具") ||
    text.includes("插件") ||
    text.includes("软件") ||
    text.includes("app") ||
    text.includes("应用")
  ) {
    return "tool";
  }

  // 课程类
  if (
    text.includes("课程") ||
    text.includes("训练营") ||
    text.includes("专栏")
  ) {
    return "course";
  }

  return "article";
}

/**
 * 根据内容类型生成定制化标签要求
 */
function getTagRequirementsByType(
  type: "tutorial" | "video" | "tool" | "course" | "article",
): string {
  const requirements: Record<
    "tutorial" | "video" | "tool" | "course" | "article",
    string
  > = {
    tutorial: `
【教程内容特定要求】
- 必须包含技术栈标签（如"React"、"Python"、"Figma"）
- 必须包含学习阶段标签（如"入门"、"进阶"、"实战"）
- 推荐包含应用场景标签（如"项目实战"、"代码重构"）`,

    video: `
【视频内容特定要求】
- 必须包含视频主题的核心关键词
- 如果是技术视频，包含具体技术栈
- 推荐包含适合人群标签（如"初学者友好"、"深度解析"）`,

    tool: `
【工具类特定要求】
- 必须包含工具类型标签（如"效率工具"、"设计工具"、"开发工具"）
- 必须包含具体用途标签（如"笔记管理"、"原型设计"、"代码编辑"）
- 推荐包含平台标签（如"跨平台"、"Web工具"、"Mac专属"）`,

    course: `
【课程类特定要求】
- 必须包含课程主题的领域标签
- 必须包含学习类型标签（如"系统课程"、"专题讲座"）
- 推荐包含课程深度标签（如"基础课程"、"高级课程"）`,

    article: `
【文章类特定要求】
- 必须包含文章主题的领域标签
- 推荐包含内容深度标签（如"深度分析"、"快速上手"、"案例研究"）
- 推荐包含应用价值标签（如"最佳实践"、"避坑指南"）`,
  };

  return requirements[type] || requirements.article;
}

/**
 * 构建 AI 提示词
 * 根据内容长度动态调整摘要上限
 */
function buildPrompt(
  title: string,
  description?: string,
  content?: string,
  existingFolderNames?: string[],
): string {
  // 计算总内容长度
  const contentLength =
    (title?.length || 0) + (description?.length || 0) + (content?.length || 0);
  const { min, max } = getSummaryLimit(contentLength);

  // 识别内容类型
  const contentType = detectContentType(title, description);
  const typeSpecificRequirements = getTagRequirementsByType(contentType);

  // 构建文件夹参考信息
  let folderContext = "";
  if (existingFolderNames && existingFolderNames.length > 0) {
    // 过滤掉系统文件夹和过长的名称，只保留有意义的文件夹名
    const meaningfulFolders = existingFolderNames
      .filter((name) => name.length <= 20 && !name.includes("待整理"))
      .slice(0, 10); // 最多10个，避免 Prompt 过长

    if (meaningfulFolders.length > 0) {
      folderContext = `\n\n【用户现有文件夹】\n${meaningfulFolders.join("、")}\n💡 参考这些文件夹名称生成相关标签，便于自动归类`;
    }
  }

  let prompt = `你是一个专业的内容分析助手。请对以下内容进行深度分析，生成高质量摘要。

【内容信息】
标题：${title}`;

  if (description) {
    prompt += `\n描述：${description}`;
  }

  if (content) {
    // 提高到5000字符，确保关键信息不丢失
    const truncatedContent = content.substring(0, 5000);
    prompt += `\n\n正文内容：\n${truncatedContent}`;
  }

  // 添加文件夹参考信息
  if (folderContext) {
    prompt += folderContext;
  }

  prompt += `

【摘要要求】
1. **长度**：${min}-${max}字，根据内容丰富度灵活调整
2. **结构**：
   - 核心主旨（用一句话概括）
   - 关键信息点（2-4个要点）
   - 适用场景或价值（可选）
3. **完整性**：
   - 保留所有关键信息和数据
   - 包含重要的专业术语
   - 如果有方法论/步骤，必须保留
4. **可读性**：
   - 使用清晰的逻辑结构
   - 避免笼统描述，优先具体信息

【标签要求】
1. **数量**：生成3-5个精准标签
2. **层次结构**：
   - 必须包含：1个领域标签（如"前端开发"、"产品设计"、"数据分析"）
   - 可选包含：1-2个技术标签（如"React"、"TypeScript"、"Figma"）
   - 可选包含：1-2个场景标签（如"性能优化"、"用户研究"、"团队协作"）
3. **准确性**：
   - 标签必须基于内容实际讨论的主题
   - 避免过于宽泛的标签（如"技术"、"学习"）
   - 使用行业标准术语（如"前端"而非"网页开发"）
4. **优先级**：
   - 如果内容提到具体技术栈，必须作为标签（如React、Vue、Python）
   - 如果内容有明确应用场景，必须作为标签（如"面试准备"、"项目实战"）
${typeSpecificRequirements}

【标签示例】
- 前端技术文章 → ["前端开发", "React", "性能优化"]
- 产品设计教程 → ["产品设计", "Figma", "用户体验", "设计系统"]
- Python数据分析 → ["数据分析", "Python", "Pandas", "可视化"]
- 面试准备资料 → ["职业发展", "面试准备", "算法题解"]
- 个人效率工具 → ["效率工具", "个人管理", "自动化"]

【返回格式】（严格JSON）
{
  "summary": "完整摘要内容",
  "tags": ["领域标签", "技术标签", "场景标签"]
}

只返回JSON，不要任何额外说明。`;

  return prompt;
}

/**
 * 解析 AI 返回的内容
 */
function parseAIResponse(content: string): AIGenerateResult {
  try {
    // 移除可能的 markdown 代码块标记
    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(cleaned);

    // 验证结果格式
    if (!result.summary || typeof result.summary !== "string") {
      throw new Error("Invalid summary format");
    }

    if (!Array.isArray(result.tags) || result.tags.length === 0) {
      throw new Error("Invalid tags format");
    }

    // 确保标签是字符串数组
    const tags = (result.tags as unknown[])
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    if (tags.length === 0) {
      throw new Error("No valid tags found");
    }

    return {
      summary: result.summary.trim(),
      tags: tags.slice(0, 5), // 最多5个标签
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        rawContent: content,
        action: "parse_ai_response",
      },
      "AI Generator: Parse response error",
    );
    throw new Error("解析 AI 响应失败");
  }
}

/**
 * 生成基于规则的简单摘要和标签（回退方案）
 * 根据内容长度动态调整摘要上限
 */
function generateFallbackContent(
  title: string,
  description?: string,
  content?: string,
): AIGenerateResult {
  // 计算总内容长度，确定摘要上限
  const contentLength =
    (title?.length || 0) + (description?.length || 0) + (content?.length || 0);
  const { max } = getSummaryLimit(contentLength);

  // 简单摘要：使用标题或描述的前 max 个字符
  let summary = title;

  if (description && description.length > title.length) {
    summary =
      description.length > max
        ? description.substring(0, max) + "..."
        : description;
  }

  // 简单标签：从标题中提取关键词
  const tags: string[] = [];
  const keywords = [
    "学习",
    "技术",
    "产品",
    "设计",
    "运营",
    "营销",
    "管理",
    "创业",
    "投资",
    "生活",
  ];

  keywords.forEach((keyword) => {
    if (title.includes(keyword) || description?.includes(keyword)) {
      tags.push(keyword);
    }
  });

  // 如果没有匹配的关键词，使用默认标签
  if (tags.length === 0) {
    tags.push("收藏", "阅读");
  }

  return {
    summary: summary.substring(0, max),
    tags: tags.slice(0, 5),
  };
}

/**
 * 生成 AI 摘要和标签
 * @param request - 包含标题、描述和内容的请求对象
 * @returns AI 生成的摘要和标签
 */
export async function generateAIContent(
  request: AIGenerateRequest,
): Promise<AIGenerateResult> {
  const { title, description, content, existingFolderNames } = request;

  // 验证输入
  if (!title || title.trim().length === 0) {
    throw new Error("标题不能为空");
  }

  try {
    logger.info(
      {
        title,
        folderCount: existingFolderNames?.length || 0,
        action: "generate_start",
      },
      "AI Generator: Generating content",
    );
    const result = await callDeepSeekAPI(
      title,
      description,
      content,
      existingFolderNames,
    );
    logger.info(
      {
        summary: result.summary,
        tagCount: result.tags.length,
        action: "generate_success",
      },
      "AI Generator: Success",
    );
    return result;
  } catch (error) {
    // AI 生成失败时使用回退方案
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        title,
        action: "generate_failed",
      },
      "AI Generator: Failed, using fallback",
    );
    const fallback = generateFallbackContent(title, description, content);
    logger.info(
      {
        summary: fallback.summary,
        tagCount: fallback.tags.length,
        action: "fallback_used",
      },
      "AI Generator: Fallback",
    );
    return fallback;
  }
}

/**
 * 推荐文件夹
 * 基于内容和现有文件夹列表，AI 推荐最合适的文件夹
 */
export async function recommendFolder(
  title: string,
  summary: string,
  tags: string[],
  existingFolders: ExistingFolder[],
): Promise<FolderRecommendation> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  // 如果没有 API Key 或没有现有文件夹，使用智能回退
  if (!apiKey || existingFolders.length === 0) {
    return generateFallbackFolderRecommendation(title, tags, existingFolders);
  }

  try {
    const prompt = buildFolderRecommendationPrompt(
      title,
      summary,
      tags,
      existingFolders,
    );

    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "你是一个内容分类助手。你的任务是根据内容特征，推荐最合适的文件夹。请严格按照 JSON 格式返回结果。",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3, // 较低的温度以获得更一致的结果
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(10000), // 10秒超时
      },
    );

    if (!response.ok) {
      throw new Error(`DeepSeek API 错误: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices[0]?.message?.content;

    if (!aiContent) {
      throw new Error("AI 未返回内容");
    }

    return parseFolderRecommendation(aiContent, existingFolders);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        title,
        action: "folder_recommendation_failed",
      },
      "AI Generator: Folder recommendation failed",
    );
    return generateFallbackFolderRecommendation(title, tags, existingFolders);
  }
}

/**
 * 构建文件夹推荐提示词
 */
function buildFolderRecommendationPrompt(
  title: string,
  summary: string,
  tags: string[],
  existingFolders: ExistingFolder[],
): string {
  const folderList = existingFolders
    .map((f) => `- ${f.name} (ID: ${f.id})`)
    .join("\n");

  return `请根据以下内容，从现有文件夹中选择最合适的一个，或建议创建新文件夹。

内容信息：
- 标题：${title}
- 摘要：${summary}
- 标签：${tags.join("、")}

现有文件夹：
${folderList || "（暂无文件夹）"}

请以 JSON 格式返回：
{
  "recommendedFolderId": 123,  // 推荐的文件夹 ID，如建议新建则为 null
  "folderName": "文件夹名称",  // 推荐的文件夹名（已有的或建议新建的）
  "confidence": 85,           // 置信度 0-100
  "reason": "推荐理由",       // 简短说明为什么推荐这个文件夹
  "suggestNew": false         // 是否建议新建文件夹
}

要求：
1. 如果现有文件夹中有匹配的，优先推荐现有文件夹
2. 只有内容主题与现有文件夹都不匹配时，才建议新建
3. 建议新建时，给出简洁有意义的文件夹名称
4. 只返回 JSON，不要额外说明`;
}

/**
 * 解析文件夹推荐响应
 */
function parseFolderRecommendation(
  content: string,
  existingFolders: ExistingFolder[],
): FolderRecommendation {
  try {
    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const result = JSON.parse(cleaned);

    // 验证推荐的文件夹 ID 是否存在
    let folderId: number | null = null;
    let folderName = result.folderName || "未分类";
    const suggestNew = result.suggestNew === true;

    if (!suggestNew && result.recommendedFolderId) {
      const folder = existingFolders.find(
        (f) => f.id === result.recommendedFolderId,
      );
      if (folder) {
        folderId = folder.id;
        folderName = folder.name;
      }
    }

    return {
      folderId,
      folderName,
      confidence: Math.min(100, Math.max(0, result.confidence || 50)),
      reason: result.reason || "基于内容主题分析",
      suggestNew,
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        rawContent: content,
        action: "parse_folder_recommendation",
      },
      "AI Generator: Parse folder recommendation error",
    );

    // 返回默认推荐
    return {
      folderId: existingFolders[0]?.id || null,
      folderName: existingFolders[0]?.name || "未分类",
      confidence: 30,
      reason: "基于默认规则",
      suggestNew: existingFolders.length === 0,
    };
  }
}

/**
 * 智能回退：基于标签和语义的文件夹推荐算法
 */
function generateFallbackFolderRecommendation(
  title: string,
  tags: string[],
  existingFolders: ExistingFolder[],
): FolderRecommendation {
  // 如果没有文件夹，建议新建
  if (existingFolders.length === 0) {
    const suggestedName = tags[0] || extractKeyword(title) || "我的收藏";
    return {
      folderId: null,
      folderName: suggestedName,
      confidence: 40,
      reason: "暂无文件夹，建议创建新文件夹",
      suggestNew: true,
    };
  }

  // 优化的匹配算法
  let bestMatch: ExistingFolder | null = null;
  let bestScore = 0;
  let matchReason = "";

  for (const folder of existingFolders) {
    const folderNameLower = folder.name.toLowerCase();
    let score = 0;
    const matchDetails: string[] = [];

    // 1. 标签完全匹配（最高权重：80分）
    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      if (folderNameLower === tagLower) {
        score += 80;
        matchDetails.push(`标签"${tag}"完全匹配`);
        break; // 完全匹配后不再计算其他匹配
      } else if (folderNameLower.includes(tagLower)) {
        // 标签部分匹配（权重：50分）
        score += 50;
        matchDetails.push(`标签"${tag}"部分匹配`);
      } else if (
        tagLower.includes(folderNameLower) &&
        folderNameLower.length > 1
      ) {
        // 文件夹名包含在标签中（权重：40分）
        score += 40;
        matchDetails.push(`文件夹名包含在标签"${tag}"中`);
      }
    }

    // 2. 标题关键词匹配（次要权重：15分每个关键词）
    const titleWords = title
      .toLowerCase()
      .split(/[\s,，、]+/)
      .filter((w) => w.length > 1);
    let titleMatchCount = 0;
    for (const word of titleWords) {
      if (folderNameLower.includes(word)) {
        score += 15;
        titleMatchCount++;
        if (titleMatchCount >= 2) break; // 最多计算2个关键词匹配
      }
    }
    if (titleMatchCount > 0) {
      matchDetails.push(`标题关键词匹配(${titleMatchCount}个)`);
    }

    // 3. 语义相似度匹配（基于领域关键词：25分）
    const semanticScore = calculateSemanticSimilarity(folderNameLower, tags);
    if (semanticScore > 0) {
      score += semanticScore;
      matchDetails.push(`语义关联匹配`);
    }

    // 更新最佳匹配
    if (score > bestScore) {
      bestScore = score;
      bestMatch = folder;
      matchReason = matchDetails.join("；");
    }
  }

  // 根据得分决定推荐策略
  if (bestMatch && bestScore >= 40) {
    return {
      folderId: bestMatch.id,
      folderName: bestMatch.name,
      confidence: Math.min(95, bestScore),
      reason: matchReason || "基于标签匹配",
      suggestNew: false,
    };
  }

  // 得分不足，建议新建文件夹
  const suggestedName = tags[0] || extractKeyword(title) || "未分类";
  return {
    folderId: null,
    folderName: suggestedName,
    confidence: 30,
    reason: "没有找到高度匹配的文件夹，建议新建",
    suggestNew: true,
  };
}

/**
 * 计算语义相似度得分
 */
function calculateSemanticSimilarity(
  folderName: string,
  tags: string[],
): number {
  // 领域关键词映射表
  const semanticKeywords: Record<string, string[]> = {
    前端: [
      "react",
      "vue",
      "angular",
      "javascript",
      "typescript",
      "css",
      "html",
      "web",
      "next.js",
      "nuxt",
      "webpack",
      "vite",
    ],
    后端: [
      "java",
      "python",
      "node",
      "golang",
      "php",
      "api",
      "database",
      "server",
      "spring",
      "django",
      "express",
      "mysql",
      "postgresql",
    ],
    设计: [
      "figma",
      "sketch",
      "ui",
      "ux",
      "用户体验",
      "交互",
      "界面",
      "视觉",
      "adobe",
      "photoshop",
    ],
    产品: [
      "需求",
      "功能",
      "用户研究",
      "pm",
      "prd",
      "产品经理",
      "竞品",
      "迭代",
      "用户体验",
    ],
    数据: [
      "分析",
      "sql",
      "pandas",
      "可视化",
      "bi",
      "excel",
      "tableau",
      "统计",
      "机器学习",
    ],
    移动: [
      "ios",
      "android",
      "flutter",
      "react native",
      "swift",
      "kotlin",
      "小程序",
      "移动开发",
    ],
    运维: [
      "docker",
      "kubernetes",
      "devops",
      "ci/cd",
      "linux",
      "部署",
      "监控",
      "nginx",
    ],
    AI: [
      "机器学习",
      "深度学习",
      "chatgpt",
      "openai",
      "神经网络",
      "自然语言",
      "llm",
      "prompt",
    ],
  };

  let maxScore = 0;

  // 遍历每个领域
  for (const [category, keywords] of Object.entries(semanticKeywords)) {
    // 文件夹名是否匹配领域
    if (folderName.includes(category.toLowerCase())) {
      // 检查标签是否包含该领域的关键词
      for (const tag of tags) {
        const tagLower = tag.toLowerCase();
        for (const keyword of keywords) {
          if (tagLower.includes(keyword) || keyword.includes(tagLower)) {
            maxScore = Math.max(maxScore, 25);
            break;
          }
        }
      }
    } else {
      // 文件夹名直接包含关键词
      for (const keyword of keywords) {
        if (folderName.includes(keyword)) {
          // 检查标签是否匹配该领域
          if (
            tags.some((t) => t.toLowerCase().includes(category.toLowerCase()))
          ) {
            maxScore = Math.max(maxScore, 20);
          }
          break;
        }
      }
    }
  }

  return maxScore;
}

/**
 * 从标题提取关键词作为文件夹名建议
 */
function extractKeyword(title: string): string {
  // 常见分类关键词
  const keywords = [
    "前端",
    "后端",
    "编程",
    "技术",
    "AI",
    "人工智能",
    "产品",
    "设计",
    "UI",
    "UX",
    "运营",
    "营销",
    "管理",
    "创业",
    "投资",
    "理财",
    "生活",
    "健康",
    "学习",
    "教程",
    "读书",
    "影视",
    "音乐",
    "游戏",
    "美食",
    "旅行",
    "时尚",
    "科技",
    "新闻",
  ];

  for (const keyword of keywords) {
    if (title.includes(keyword)) {
      return keyword;
    }
  }

  return "";
}
