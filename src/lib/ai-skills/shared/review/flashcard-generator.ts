/**
 * Flashcard 生成器
 * 使用 LLM 从书签内容生成问答对
 *
 * @module shared/review/flashcard-generator
 * @version 2.0.0
 * @updated 2026-01-01 - 添加 v2 深度问题生成
 */

import { generateText } from "ai";
import { logger } from "@/lib/logger";
import { aiProviderRouter } from "@/lib/ai-providers";
import type {
  FlashcardGenerationInput,
  FlashcardGenerationResult,
  FlashcardGenerationResultV2,
  GeneratedFlashcard,
  GeneratedFlashcardV2,
  FlashcardDifficulty,
  QuestionDepth,
} from "./types";

// ============================================================================
// v2 深度问题生成（新版）
// ============================================================================

/**
 * v2 Prompt 模板 - 深度问题生成
 */
const FLASHCARD_GENERATION_PROMPT_V2 = `你是一位擅长促进深度思考的导师，专门帮助高认知群体真正理解和内化知识。

## 任务
基于以下内容，生成 {count} 个能促进深度理解的复习题。

## 内容信息
标题：{title}
摘要：{summary}
原文：{content}

## 问题生成规则

### 问题层次要求（必须覆盖多种层次）

**L1 - understand（理解层）** - 必须至少 1 题
- 问题模式："用你自己的话解释..."、"如果要向非专业人士说明..."
- 目的：检验是否真正理解，而非死记硬背
- 示例："用你自己的话解释为什么 MoE 选择只激活部分专家，假设对方没有技术背景"

**L2 - apply（应用层）** - 必须至少 1 题
- 问题模式："在...场景下如何应用..."、"如果要在...中使用，需要考虑什么"
- 目的：从理论到实践的思考
- 示例："如果你要在一个延迟敏感的在线服务中应用 MoE 架构，会面临什么挑战？"

**L3 - analyze（分析层）** - 可选
- 问题模式："...的前提假设是什么"、"...在什么情况下会失效"
- 目的：批判性思考，理解边界
- 示例："MoE 架构的有效性依赖于哪些前提假设？如果这些假设不成立会怎样？"

**L4 - evaluate（评价层）** - 可选
- 问题模式："与...相比，优劣势是什么"、"如何评估...的效果"
- 目的：比较和判断
- 示例："与传统的稠密模型相比，MoE 在训练和推理上各有什么 trade-off？"

### 每道题必须包含

1. **questionDepth**: 问题层次（understand/apply/analyze/evaluate）
2. **question**: 问题本身（开放式，需要思考才能回答）
3. **thinkingHint**: 思考方向提示（不是答案，是引导思考的方向，1-2句话）
4. **keyPoints**: 参考要点数组（用户思考后可对照，3-5 个要点）
5. **sourceParagraph**: 相关原文片段（不超过 100 字）

### 禁止生成的问题类型

- ❌ 可直接从原文复制答案的问题
- ❌ 是非题、选择题、填空题
- ❌ "列举 N 个..."这类清单记忆题
- ❌ 只需要背诵定义的问题
- ❌ 答案唯一确定的问题

### 质量标准

- ✅ 问题需要用户调动思考才能回答
- ✅ 答案可以有多种合理解读
- ✅ 思考提示是方向性的，不是直接答案
- ✅ 要点是对照参考，不是标准答案

## 输出格式（严格 JSON 数组，不要有其他内容）

\`\`\`json
[
  {
    "questionDepth": "understand",
    "question": "用你自己的话解释...",
    "thinkingHint": "思考方向：考虑...和...的关系",
    "keyPoints": ["要点1", "要点2", "要点3"],
    "sourceParagraph": "原文相关片段..."
  },
  {
    "questionDepth": "apply",
    "question": "在...场景下如何应用...",
    "thinkingHint": "思考方向：关注...约束",
    "keyPoints": ["要点1", "要点2", "要点3"],
    "sourceParagraph": "原文相关片段..."
  }
]
\`\`\`

请只输出 JSON 数组，不要有任何额外的解释或文字。`;

/**
 * 生成深度问题 Flashcards (v2)
 * @param input 生成参数
 * @returns 生成结果
 */
export async function generateFlashcardsV2(
  input: FlashcardGenerationInput,
): Promise<FlashcardGenerationResultV2> {
  const { title, summary, content, count, difficulty } = input;

  // 限制内容长度
  const maxContentLength = 4000;
  const truncatedContent =
    content.length > maxContentLength
      ? content.slice(0, maxContentLength) + "..."
      : content;

  // 构建 prompt
  const prompt = FLASHCARD_GENERATION_PROMPT_V2.replace(
    "{count}",
    count.toString(),
  )
    .replace("{title}", title)
    .replace("{summary}", summary || "无摘要")
    .replace("{content}", truncatedContent);

  try {
    const selection = aiProviderRouter.selectProvider({ taskType: "chat" });

    if (!selection?.model) {
      logger.error(
        { title },
        "Flashcard v2 generation failed: No model available",
      );
      return {
        success: false,
        flashcards: [],
        error: "No AI model available",
      };
    }

    const { text } = await generateText({
      model: selection.model,
      prompt,
      temperature: 0.7,
    });

    const flashcards = parseFlashcardsResponseV2(text);

    if (flashcards.length === 0) {
      logger.warn(
        { title, responsePreview: text.slice(0, 200) },
        "Flashcard v2 generation returned empty result",
      );
      return {
        success: false,
        flashcards: [],
        error: "Failed to generate flashcards",
      };
    }

    // 验证层次分布
    const validatedFlashcards = validateDepthDistribution(
      flashcards,
      difficulty,
    );

    logger.info(
      { title, count: validatedFlashcards.length },
      "Flashcards v2 generated successfully",
    );

    return {
      success: true,
      flashcards: validatedFlashcards,
    };
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Flashcard v2 generation failed",
    );
    return {
      success: false,
      flashcards: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 解析 LLM 响应 (v2)
 */
function parseFlashcardsResponseV2(text: string): GeneratedFlashcardV2[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn(
        { textPreview: text.slice(0, 200) },
        "No JSON array found in v2 response",
      );
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    const validDepths: QuestionDepth[] = [
      "understand",
      "apply",
      "analyze",
      "evaluate",
    ];

    return parsed
      .filter((fc): fc is GeneratedFlashcardV2 => {
        return (
          fc &&
          typeof fc.questionDepth === "string" &&
          validDepths.includes(fc.questionDepth as QuestionDepth) &&
          typeof fc.question === "string" &&
          fc.question.trim().length > 10 &&
          typeof fc.thinkingHint === "string" &&
          Array.isArray(fc.keyPoints) &&
          fc.keyPoints.length >= 2
        );
      })
      .map((fc) => ({
        questionDepth: fc.questionDepth as QuestionDepth,
        question: fc.question.trim(),
        thinkingHint: fc.thinkingHint.trim(),
        keyPoints: fc.keyPoints
          .map((p: string) => String(p).trim())
          .filter(Boolean),
        sourceParagraph: fc.sourceParagraph?.trim() || "",
      }));
  } catch (error) {
    logger.error({ error }, "Failed to parse flashcards v2 JSON");
    return [];
  }
}

/**
 * 验证层次分布
 */
function validateDepthDistribution(
  flashcards: GeneratedFlashcardV2[],
  _difficulty: FlashcardDifficulty,
): GeneratedFlashcardV2[] {
  const hasUnderstand = flashcards.some(
    (f) => f.questionDepth === "understand",
  );
  const hasApply = flashcards.some((f) => f.questionDepth === "apply");

  if (!hasUnderstand || !hasApply) {
    logger.warn(
      { hasUnderstand, hasApply },
      "Flashcards v2 missing required depth levels",
    );
  }

  return flashcards;
}

/**
 * 验证单个 Flashcard 质量 (v2)
 */
export function validateFlashcardQualityV2(
  flashcard: GeneratedFlashcardV2,
): boolean {
  // 问题长度检查
  if (flashcard.question.length < 15 || flashcard.question.length > 500) {
    return false;
  }

  // 思考提示检查
  if (!flashcard.thinkingHint || flashcard.thinkingHint.length < 10) {
    return false;
  }

  // 要点数量检查
  if (flashcard.keyPoints.length < 2 || flashcard.keyPoints.length > 7) {
    return false;
  }

  // 检查是否是有效的开放式问题
  const openQuestionPatterns = [
    /^(用你|如果|在.*场景|假设|为什么|如何|怎么|什么情况|与.*相比)/,
    /\?$/,
  ];

  return openQuestionPatterns.some((pattern) =>
    pattern.test(flashcard.question),
  );
}

// ============================================================================
// v1 兼容版本（保留原有功能）
// ============================================================================

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
