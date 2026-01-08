/**
 * 标题生成 API
 *
 * POST /api/ai/generate-title
 * 根据内容自动生成简洁的中文标题
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import type { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateText } from "ai";
import { getModelByTask } from "@/lib/ai-providers/get-model-by-task";
import { logger } from "@/lib/logger";
import { extractFallbackTitle } from "@/features/md-collections/lib";

// =============================================================================
// Schema 定义
// =============================================================================

const generateTitleSchema = z.object({
  /** 内容（最多 2000 字符用于生成标题） */
  content: z.string().min(10).max(5000),
});

// =============================================================================
// Prompt 模板
// =============================================================================

const TITLE_GENERATION_PROMPT = `根据以下内容生成一个简洁的中文标题。

要求：
1. 标题长度不超过 20 个字
2. 突出内容的核心主题
3. 不要使用"关于"、"浅谈"等套话开头
4. 如果是建议类内容，可以用"XX建议"、"XX方案"
5. 如果是总结类内容，可以用"XX要点"、"XX总结"
6. 如果是代码类内容，可以用"XX实现"、"XX代码"
7. 如果是分析类内容，可以用"XX分析"、"XX解析"

内容：
{content}

只输出标题，不要任何解释、引号或其他内容。`;

// =============================================================================
// API Handler
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "未授权" }, { status: 401 });
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = generateTitleSchema.safeParse(body);

    if (!validation.success) {
      return Response.json(
        { error: "内容无效", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { content } = validation.data;

    // 3. 获取模型（使用 fast 层级，标题生成是简单任务）
    const model = getModelByTask("simple-query");

    if (!model) {
      logger.error("Failed to get model for title generation");
      return Response.json({ error: "AI 服务暂时不可用" }, { status: 503 });
    }

    // 4. 生成标题
    const truncatedContent = content.slice(0, 1000); // 只取前 1000 字符
    const prompt = TITLE_GENERATION_PROMPT.replace(
      "{content}",
      truncatedContent,
    );

    const { text } = await generateText({
      model,
      prompt,
      maxOutputTokens: 50,
      temperature: 0.3,
    });

    // 5. 清理标题（移除可能的引号和多余空白）
    const title = text
      .trim()
      .replace(/^["'「」『』]|["'「」『』]$/g, "")
      .replace(/\n.*/g, "") // 只取第一行
      .trim();

    // 6. 验证标题长度
    if (title.length < 2 || title.length > 50) {
      logger.warn(
        { generatedTitle: title, length: title.length },
        "Generated title has unexpected length",
      );

      // 回退方案：从内容提取
      const fallbackTitle = extractFallbackTitle(content);
      return Response.json({ title: fallbackTitle });
    }

    logger.info(
      {
        userId: user.id.slice(0, 8) + "...",
        contentLength: content.length,
        title,
      },
      "Title generated successfully",
    );

    return Response.json({ title });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Generate title API error",
    );

    return Response.json({ error: "生成标题失败" }, { status: 500 });
  }
}
