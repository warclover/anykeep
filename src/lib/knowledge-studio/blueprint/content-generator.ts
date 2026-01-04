/**
 * 基于大纲的内容生成器 (Story 2.4)
 * @module knowledge-studio/blueprint
 *
 * 使用确认后的大纲作为约束，生成符合结构的完整内容。
 * AC:
 * - Prompt 包含完整大纲结构作为约束
 * - 生成内容的标题层级与大纲一致
 * - 支持 SSE 流式输出
 */

import { streamText } from "ai";
import { createLogger } from "@/lib/logger";
import { aiProviderRouter } from "@/lib/ai-providers";
import type { OrchestrationStreamChunk } from "../../ai-skills/output/types";
import type { BlueprintOutline, BriefingContext, MaterialInput } from "./types";
import {
  buildContentPrompt,
  estimateTotalWords,
  countSections,
  type ContentGenerationConfig,
} from "./prompts/content.prompt";

// ============================================================
// Logger
// ============================================================

const logger = createLogger("blueprint:content-generator");

// ============================================================
// Types
// ============================================================

/**
 * 内容生成选项
 */
export interface ContentGeneratorOptions {
  /** 蓝图 ID */
  blueprintId: string;
  /** 蓝图名称 */
  blueprintName: string;
  /** 蓝图特定指令 */
  blueprintInstructions?: string;
  /** 确认后的大纲 */
  outline: BlueprintOutline;
  /** 目标长度 */
  targetLength: "short" | "medium" | "long";
  /** 输出语言 */
  outputLanguage?: "zh" | "en" | "auto";
  /** 写作风格 */
  writingStyle?: "formal" | "casual" | "academic" | "creative";
  /** 生成超时（毫秒） */
  timeoutMs?: number;
}

/**
 * 内容生成结果
 */
export interface ContentGenerationResult {
  /** 生成的内容 */
  content: string;
  /** 生成耗时（毫秒） */
  durationMs: number;
  /** 使用的 Token 数 */
  tokensUsed?: number;
  /** 使用的模型 */
  modelUsed: string;
  /** 使用的大纲 */
  outline: BlueprintOutline;
}

/**
 * 流式内容块
 */
export interface ContentStreamChunk {
  /** 内容片段 */
  text: string;
  /** 是否完成 */
  done: boolean;
  /** 当前进度（0-100） */
  progress?: number;
}

// ============================================================
// Content Generator
// ============================================================

/**
 * 生成内容（流式）
 *
 * 基于确认的大纲结构，使用 LLM 生成完整内容。
 *
 * @param materials - 素材列表
 * @param options - 生成选项
 * @param briefingContext - Briefing 上下文（可选）
 * @yields OrchestrationStreamChunk - 流式输出块
 * @returns 生成的内容
 *
 * @example
 * ```typescript
 * const generator = generateContentStream(materials, {
 *   blueprintId: 'geek-arxiv',
 *   blueprintName: '论文解读',
 *   outline: confirmedOutline,
 *   targetLength: 'medium',
 * });
 *
 * let content = '';
 * for await (const chunk of generator) {
 *   if (chunk.type === 'text') {
 *     content += chunk.data.text;
 *   }
 * }
 *
 * const result = await generator.next();
 * if (result.done) {
 *   console.log('Final content:', result.value);
 * }
 * ```
 */
export async function* generateContentStream(
  materials: MaterialInput[],
  options: ContentGeneratorOptions,
  briefingContext?: BriefingContext,
): AsyncGenerator<OrchestrationStreamChunk, ContentGenerationResult, unknown> {
  const startTime = performance.now();
  const timeoutMs = options.timeoutMs ?? 120000; // 默认 2 分钟超时（内容生成较慢）

  logger.info(
    {
      blueprintId: options.blueprintId,
      materialsCount: materials.length,
      targetLength: options.targetLength,
      outlineTitle: options.outline.title,
      outlineSections: countSections(options.outline),
      estimatedWords: estimateTotalWords(options.outline),
    },
    "Starting content generation",
  );

  // 进度 5%：开始分析
  yield {
    type: "progress",
    data: {
      step: "content",
      percent: 5,
      message: "准备生成内容...",
      timestamp: Date.now(),
    },
  };

  // 构建配置
  const config: ContentGenerationConfig = {
    blueprintId: options.blueprintId,
    blueprintName: options.blueprintName,
    blueprintInstructions: options.blueprintInstructions,
    outline: options.outline,
    targetLength: options.targetLength,
    outputLanguage: options.outputLanguage,
    writingStyle: options.writingStyle,
  };

  // 构建 Prompt
  const prompt = buildContentPrompt(config, materials, briefingContext);

  // 进度 10%：Prompt 构建完成
  yield {
    type: "progress",
    data: {
      step: "content",
      percent: 10,
      message: "开始生成内容...",
      timestamp: Date.now(),
    },
  };

  // 获取 DeepSeek 模型（优先使用 DeepSeek）
  const selection = aiProviderRouter.selectProvider({
    taskType: "chat",
    preferredProvider: "deepseek",
    requiresStreaming: true,
  });

  if (!selection) {
    yield {
      type: "error",
      data: {
        message: "没有可用的 AI 服务",
        retryable: true,
        suggestion: "请检查 AI 服务配置",
      },
    };
    throw new Error("No AI provider available for content generation");
  }

  logger.debug(
    {
      provider: selection.provider.name,
      model: selection.provider.defaultModel,
    },
    "Using AI provider",
  );

  try {
    // 创建超时控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // 调用模型（流式）
    const stream = await streamText({
      model: selection.model,
      system: prompt.system,
      prompt: prompt.user,
      maxOutputTokens: 8192, // 内容生成需要更多 Token
      temperature: 0.7,
      abortSignal: controller.signal,
    });

    let fullContent = "";
    let chunkCount = 0;
    const estimatedChunks = estimateTotalWords(options.outline) / 10; // 估算 chunk 数量

    // 流式输出
    for await (const chunk of stream.textStream) {
      fullContent += chunk;
      chunkCount++;

      // 计算进度（10% - 90%）
      const progress = Math.min(
        10 + Math.floor((chunkCount / estimatedChunks) * 80),
        90,
      );

      // 每隔一定数量的 chunk 发送进度更新
      if (chunkCount % 20 === 0) {
        yield {
          type: "progress",
          data: {
            step: "content",
            percent: progress,
            message: `正在生成内容... (${Math.floor(fullContent.length / 2)}字)`,
            timestamp: Date.now(),
          },
        };
      }

      // 发送文本块
      yield {
        type: "text",
        data: {
          text: chunk,
        },
      };
    }

    // 清除超时
    clearTimeout(timeoutId);

    const durationMs = Math.round(performance.now() - startTime);

    // 获取使用统计
    const usage = await stream.usage;

    // 记录成功
    aiProviderRouter.recordSuccess(selection.provider.name, durationMs);

    logger.info(
      {
        durationMs,
        contentLength: fullContent.length,
        tokensUsed: usage?.totalTokens,
        chunkCount,
      },
      "Content generation completed",
    );

    // 进度 95%：内容生成完成
    yield {
      type: "progress",
      data: {
        step: "content",
        percent: 95,
        message: "内容生成完成，正在整理...",
        timestamp: Date.now(),
      },
    };

    // 进度 100%：完成
    yield {
      type: "progress",
      data: {
        step: "content",
        percent: 100,
        message: `内容生成完成（${durationMs}ms, ${Math.floor(fullContent.length / 2)}字）`,
        timestamp: Date.now(),
      },
    };

    return {
      content: fullContent,
      durationMs,
      tokensUsed: usage?.totalTokens,
      modelUsed: selection.provider.defaultModel,
      outline: options.outline,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);

    // 记录失败
    aiProviderRouter.recordFailure(
      selection.provider.name,
      error instanceof Error ? error.message : "Unknown error",
    );

    logger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs,
        blueprintId: options.blueprintId,
      },
      "Content generation failed",
    );

    // 发送错误
    yield {
      type: "error",
      data: {
        message: error instanceof Error ? error.message : "内容生成失败",
        retryable: true,
        suggestion: "请重试或检查网络连接",
      },
    };

    throw error;
  }
}

/**
 * 生成内容（非流式）
 *
 * 便捷方法，收集所有流式输出后返回完整结果。
 *
 * @param materials - 素材列表
 * @param options - 生成选项
 * @param briefingContext - Briefing 上下文（可选）
 * @returns 内容生成结果
 */
export async function generateContent(
  materials: MaterialInput[],
  options: ContentGeneratorOptions,
  briefingContext?: BriefingContext,
): Promise<ContentGenerationResult> {
  const generator = generateContentStream(materials, options, briefingContext);

  let result: IteratorResult<OrchestrationStreamChunk, ContentGenerationResult>;

  do {
    result = await generator.next();
  } while (!result.done);

  return result.value;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 验证生成的内容是否符合大纲结构
 *
 * 检查生成的 Markdown 内容是否包含大纲中的所有标题。
 *
 * @param content - 生成的内容
 * @param outline - 参考大纲
 * @returns 验证结果
 */
export function validateContentStructure(
  content: string,
  outline: BlueprintOutline,
): {
  isValid: boolean;
  missingTitles: string[];
  matchedTitles: string[];
} {
  const missingTitles: string[] = [];
  const matchedTitles: string[] = [];

  function checkNode(node: {
    title: string;
    children?: { title: string; children?: unknown[] }[];
  }) {
    // 检查标题是否存在于内容中
    const titlePattern = new RegExp(
      `^#{1,3}\\s*${escapeRegExp(node.title)}`,
      "m",
    );

    if (titlePattern.test(content)) {
      matchedTitles.push(node.title);
    } else {
      missingTitles.push(node.title);
    }

    // 递归检查子节点
    if (node.children) {
      for (const child of node.children) {
        checkNode(
          child as {
            title: string;
            children?: { title: string; children?: unknown[] }[];
          },
        );
      }
    }
  }

  for (const node of outline.nodes) {
    checkNode(node);
  }

  return {
    isValid: missingTitles.length === 0,
    missingTitles,
    matchedTitles,
  };
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 从内容中提取标题结构
 *
 * @param content - Markdown 内容
 * @returns 提取的标题列表
 */
export function extractHeadingsFromContent(content: string): Array<{
  level: number;
  title: string;
  position: number;
}> {
  const headingPattern = /^(#{1,3})\s+(.+)$/gm;
  const headings: Array<{ level: number; title: string; position: number }> =
    [];

  let match;
  while ((match = headingPattern.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      title: match[2].trim(),
      position: match.index,
    });
  }

  return headings;
}
