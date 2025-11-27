/**
 * Supabase Edge Function: generate-ai-content
 * 使用 AI 生成收藏内容的摘要和标签
 *
 * 请求格式: POST
 * Body: {
 *   "title": "文章标题",
 *   "description": "文章描述（可选）",
 *   "content": "文章内容（可选）"
 * }
 *
 * 响应格式:
 * {
 *   "success": true,
 *   "data": {
 *     "summary": "AI 生成的摘要",
 *     "tags": ["标签1", "标签2", "标签3"]
 *   }
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface GenerateRequest {
  title: string;
  description?: string;
  content?: string;
}

interface GenerateResult {
  summary: string;
  tags: string[];
}

/**
 * 调用 DeepSeek API 生成摘要和标签
 */
async function generateAIContent(
  title: string,
  description?: string,
  content?: string,
): Promise<GenerateResult> {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  // 构建提示词
  const prompt = buildPrompt(title, description, content);

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
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from AI");
    }

    // 解析 JSON 响应
    const result = parseAIResponse(content);
    return result;
  } catch (error) {
    console.error("AI generation error:", error);
    throw new Error("生成 AI 内容失败");
  }
}

/**
 * 根据原文字数计算摘要上限
 * - < 1000 字：100 字摘要
 * - 1000-5000 字：200 字摘要
 * - > 5000 字：300 字摘要
 */
function getSummaryLimit(contentLength: number): { min: number; max: number } {
  if (contentLength < 1000) {
    return { min: 50, max: 100 };
  } else if (contentLength <= 5000) {
    return { min: 100, max: 200 };
  } else {
    return { min: 150, max: 300 };
  }
}

/**
 * 构建 AI 提示词
 */
function buildPrompt(
  title: string,
  description?: string,
  content?: string,
): string {
  // 计算总内容长度
  const contentLength =
    (title?.length || 0) + (description?.length || 0) + (content?.length || 0);
  const { min, max } = getSummaryLimit(contentLength);

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
function parseAIResponse(content: string): GenerateResult {
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
    const tags = result.tags
      .filter((tag: any) => typeof tag === "string")
      .map((tag: string) => tag.trim())
      .filter((tag: string) => tag.length > 0);

    if (tags.length === 0) {
      throw new Error("No valid tags found");
    }

    return {
      summary: result.summary.trim(),
      tags: tags.slice(0, 5), // 最多5个标签
    };
  } catch (error) {
    console.error("Parse AI response error:", error);
    console.error("Raw content:", content);

    // 回退方案：基于标题生成简单摘要和标签
    throw new Error("解析 AI 响应失败");
  }
}

/**
 * Edge Function 入口
 */
serve(async (req) => {
  // CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // 只接受 POST 请求
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    // 解析请求体
    const { title, description, content }: GenerateRequest = await req.json();

    if (!title || title.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Title is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // 生成 AI 内容
    const data = await generateAIContent(title, description, content);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Edge function error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "生成 AI 内容失败",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
