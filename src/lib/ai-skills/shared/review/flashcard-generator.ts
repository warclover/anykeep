/**
 * Flashcard 生成器
 * 使用 LLM 从书签内容生成问答对
 *
 * @module shared/review/flashcard-generator
 */

import { generateText } from "ai";
import { logger } from "@/lib/logger";
import { aiProviderRouter } from "@/lib/ai-providers";
import type {
  FlashcardGenerationInput,
  FlashcardGenerationResult,
  GeneratedFlashcard,
  FlashcardDifficulty,
} from "./types";

/**
 * Flashcard 生成 Prompt 模板
 */
const FLASHCARD_GENERATION_PROMPT = `你是一位教育学专家，擅长将复杂知识转化为可记忆的知识点。

根据以下内容，生成 {count} 个高质量的复习问答对（Flashcards）。

## 要求
1. 问题必须是开放式的（如"为什么..."、"如何..."、"什么是..."、"解释..."）
2. 避免是非题或简单选择题
3. 答案简洁但完整，通常 2-4 句话
4. 每个问题聚焦一个核心知识点
5. 难度等级：{difficulty}
6. 提取与问题相关的原文片段作为 sourceParagraph（不超过100字）

## 难度说明
- easy: 基础概念，定义类问题
- medium: 需要理解和分析的问题
- hard: 需要综合应用或比较分析的问题

## 内容
标题：{title}
摘要：{summary}
原文：{content}

## 输出格式（严格 JSON 数组，不要有其他内容）
\`\`\`json
[
  {
    "question": "问题内容",
    "answer": "参考答案",
    "sourceParagraph": "原文相关片段"
  }
]
\`\`\`

请只输出 JSON 数组，不要有任何额外的解释或文字。`;

/**
 * 难度对应的描述
 */
const DIFFICULTY_DESCRIPTIONS: Record<FlashcardDifficulty, string> = {
  easy: "简单（基础概念和定义）",
  medium: "中等（需要理解和分析）",
  hard: "困难（需要综合应用和深度理解）",
};

/**
 * 生成 Flashcards
 * @param input 生成参数
 * @returns 生成结果
 */
export async function generateFlashcards(
  input: FlashcardGenerationInput,
): Promise<FlashcardGenerationResult> {
  const { title, summary, content, count, difficulty } = input;

  // 限制内容长度，避免超出 token 限制
  const maxContentLength = 4000;
  const truncatedContent =
    content.length > maxContentLength
      ? content.slice(0, maxContentLength) + "..."
      : content;

  // 构建 prompt
  const prompt = FLASHCARD_GENERATION_PROMPT.replace(
    "{count}",
    count.toString(),
  )
    .replace("{difficulty}", DIFFICULTY_DESCRIPTIONS[difficulty])
    .replace("{title}", title)
    .replace("{summary}", summary || "无摘要")
    .replace("{content}", truncatedContent);

  try {
    // 使用 AI Provider Router 获取模型
    const selection = aiProviderRouter.selectProvider({ taskType: "chat" });

    if (!selection || !selection.model) {
      logger.error(
        { title },
        "Flashcard generation failed: No model available",
      );
      return {
        success: false,
        flashcards: [],
        error: "No AI model available for flashcard generation",
      };
    }

    const { text } = await generateText({
      model: selection.model,
      prompt,
      temperature: 0.7,
    });

    // 解析 JSON 响应
    const flashcards = parseFlashcardsResponse(text);

    if (flashcards.length === 0) {
      logger.warn(
        { title, responsePreview: text.slice(0, 200) },
        "Flashcard generation returned empty result",
      );
      return {
        success: false,
        flashcards: [],
        error: "Failed to generate flashcards: empty response",
      };
    }

    logger.info(
      { title, count: flashcards.length },
      "Flashcards generated successfully",
    );

    return {
      success: true,
      flashcards,
    };
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), title },
      "Flashcard generation failed",
    );
    return {
      success: false,
      flashcards: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 解析 LLM 响应中的 Flashcards JSON
 * @param text LLM 响应文本
 * @returns 解析后的 Flashcards 数组
 */
function parseFlashcardsResponse(text: string): GeneratedFlashcard[] {
  try {
    // 尝试提取 JSON 数组
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn(
        { textPreview: text.slice(0, 200) },
        "No JSON array found in response",
      );
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      logger.warn(
        { parsedType: typeof parsed },
        "Parsed result is not an array",
      );
      return [];
    }

    // 验证和清理每个 flashcard
    return parsed
      .filter((fc): fc is GeneratedFlashcard => {
        return (
          fc &&
          typeof fc.question === "string" &&
          typeof fc.answer === "string" &&
          fc.question.trim().length > 0 &&
          fc.answer.trim().length > 0
        );
      })
      .map((fc) => ({
        question: fc.question.trim(),
        answer: fc.answer.trim(),
        sourceParagraph: fc.sourceParagraph?.trim() || "",
      }));
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        textPreview: text.slice(0, 500),
      },
      "Failed to parse flashcards JSON",
    );
    return [];
  }
}

/**
 * 验证 Flashcard 内容质量
 * @param flashcard 要验证的 flashcard
 * @returns 是否通过质量验证
 */
export function validateFlashcardQuality(
  flashcard: GeneratedFlashcard,
): boolean {
  // 问题长度检查
  if (flashcard.question.length < 10 || flashcard.question.length > 500) {
    return false;
  }

  // 答案长度检查
  if (flashcard.answer.length < 10 || flashcard.answer.length > 1000) {
    return false;
  }

  // 检查是否是有效的问题（包含疑问词或问号）
  const questionPatterns = [
    /\?$/,
    /^(什么|为什么|如何|怎么|怎样|哪些|哪个|是否|能否|可以|是不是)/,
    /^(what|why|how|which|when|where|who|can|could|should|is|are|do|does)/i,
  ];

  const isValidQuestion = questionPatterns.some((pattern) =>
    pattern.test(flashcard.question),
  );

  return isValidQuestion;
}

/**
 * 批量验证 Flashcards
 * @param flashcards Flashcard 数组
 * @returns 通过验证的 Flashcards
 */
export function filterValidFlashcards(
  flashcards: GeneratedFlashcard[],
): GeneratedFlashcard[] {
  return flashcards.filter(validateFlashcardQuality);
}
