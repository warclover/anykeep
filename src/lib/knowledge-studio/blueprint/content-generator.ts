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
import { LENGTH_MODE_CONFIG } from "../v2/constants";
import { RateLimitError, isRateLimitError } from "./errors";

// Re-export for backwards compatibility
export { RateLimitError } from "./errors";

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
  /** Phase 3.1: 平台风格 */
  platformStyle?: "wechat" | "xiaohongshu" | "general";
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
 * 支持多 Provider 自动故障转移（429 速率限制、超时等）。
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
  const timeoutMs = options.timeoutMs ?? 300000; // 默认 5 分钟超时（长内容生成需要更多时间）

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
    platformStyle: options.platformStyle, // Phase 3.1
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

  // 获取可用的 Provider 列表（按优先级排序）
  const availableProviders = aiProviderRouter.getAvailableProviders();

  if (availableProviders.length === 0) {
    yield {
      type: "error",
      data: {
        message: "没有可用的 AI 服务，请检查 API Key 配置",
        retryable: false,
        suggestion: "请配置至少一个 AI 服务的 API Key",
      },
    };
    throw new Error("没有可用的 AI 服务，请检查 API Key 配置");
  }

  let lastError: Error | null = null;
  const attemptedProviders: string[] = [];
  const rateLimitRetryAfters: number[] = []; // 记录所有 Provider 的 retryAfter 时间

  // 尝试每个可用的 Provider
  for (const providerConfig of availableProviders) {
    const providerName = providerConfig.name;
    attemptedProviders.push(providerName);

    // 获取模型
    const model = aiProviderRouter.getModel(providerName);
    if (!model) {
      logger.warn({ provider: providerName }, "Failed to get model, skipping");
      continue;
    }

    logger.info(
      {
        provider: providerName,
        model: providerConfig.defaultModel,
        attempt: attemptedProviders.length,
        totalAvailable: availableProviders.length,
      },
      "Attempting content generation with provider",
    );

    // 如果不是第一个 Provider，发送切换通知
    if (attemptedProviders.length > 1) {
      yield {
        type: "progress",
        data: {
          step: "content",
          percent: 10,
          message: `切换到 ${providerName}，继续生成...`,
          timestamp: Date.now(),
        },
      };
    }

    try {
      // 创建超时控制器
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        logger.warn(
          {
            blueprintId: options.blueprintId,
            timeoutMs,
            provider: providerName,
          },
          "Content generation timeout - aborting request",
        );
        controller.abort();
      }, timeoutMs);

      logger.debug(
        {
          blueprintId: options.blueprintId,
          provider: providerName,
          model: providerConfig.defaultModel,
          promptLength: prompt.user.length,
          timeoutMs,
        },
        "Starting AI model call for content generation",
      );

      // 调用模型（流式）
      // 严格限制 maxOutputTokens：使用字数上限 * 1.3（中文 1 字约等于 1-1.5 tokens）
      // 这确保模型物理上无法生成超过字数限制太多的内容
      const lengthConfig = LENGTH_MODE_CONFIG[options.targetLength];
      const maxTokens = Math.ceil(lengthConfig.maxWords * 1.3);
      const stream = await streamText({
        model,
        system: prompt.system,
        prompt: prompt.user,
        maxOutputTokens: maxTokens,
        temperature: 0.7,
        abortSignal: controller.signal,
      });

      let fullContent = "";
      let chunkCount = 0;
      // 使用预估总字数计算进度（中文字符约等于字数，英文单词×2）
      const estimatedChars = estimateTotalWords(options.outline) * 2; // 字数→字符数
      let lastProgressPercent = 10;

      // 流式输出（未进入此循环或循环为空 = 模型未产出内容，需排查 provider/outline/网络）
      for await (const chunk of stream.textStream) {
        fullContent += chunk;
        chunkCount++;
        if (chunkCount === 1) {
          logger.info(
            { blueprintId: options.blueprintId, provider: providerName },
            "First content chunk received from model",
          );
        }

        // 基于已生成字符数与预估字符数的比例计算进度（10% - 90%）
        const rawProgress = (fullContent.length / estimatedChars) * 80;
        const progress = Math.min(10 + Math.floor(rawProgress), 90);

        // 每增加 5% 发送进度更新，或每 50 个 chunks 发送一次
        if (progress >= lastProgressPercent + 5 || chunkCount % 50 === 0) {
          lastProgressPercent = progress;
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
      aiProviderRouter.recordSuccess(providerName, durationMs);

      logger.info(
        {
          durationMs,
          contentLength: fullContent.length,
          tokensUsed: usage?.totalTokens,
          chunkCount,
          provider: providerName,
          attemptedProviders,
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
        modelUsed: providerConfig.defaultModel,
        outline: options.outline,
      };
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);

      // 记录失败
      aiProviderRouter.recordFailure(
        providerName,
        error instanceof Error ? error.message : "Unknown error",
      );

      // 检测是否为 429 速率限制错误
      const rateLimitInfo = isRateLimitError(error);

      // 检测是否为超时/中止错误
      const isAbortError =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.includes("aborted") ||
          error.message.includes("timeout"));

      // 如果是速率限制，记录 retryAfter 时间
      if (rateLimitInfo.isRateLimit && rateLimitInfo.retryAfter) {
        rateLimitRetryAfters.push(rateLimitInfo.retryAfter);
      }

      logger.warn(
        {
          error: error instanceof Error ? error.message : "Unknown error",
          errorName: error instanceof Error ? error.name : "Unknown",
          isRateLimitError: rateLimitInfo.isRateLimit,
          retryAfter: rateLimitInfo.retryAfter,
          isAbortError,
          durationMs,
          provider: providerName,
          attemptedProviders,
          remainingProviders:
            availableProviders.length - attemptedProviders.length,
        },
        rateLimitInfo.isRateLimit
          ? "Rate limited, trying next provider"
          : isAbortError
            ? "Request timed out, trying next provider"
            : "Provider failed, trying next provider",
      );

      lastError = error instanceof Error ? error : new Error(String(error));

      // 如果所有 Provider 都遇到速率限制，不再继续尝试
      if (
        rateLimitInfo.isRateLimit &&
        attemptedProviders.length === availableProviders.length &&
        rateLimitRetryAfters.length === availableProviders.length
      ) {
        // 所有 Provider 都遇到速率限制，等待最长的 retryAfter 时间
        const maxRetryAfter = Math.max(...rateLimitRetryAfters);
        logger.warn(
          {
            attemptedProviders,
            maxRetryAfter,
            rateLimitRetryAfters,
          },
          "All providers rate limited, stopping retry attempts",
        );
        break; // 停止尝试，直接抛出错误
      }

      // 继续尝试下一个 Provider（非速率限制错误，或还有未尝试的 Provider）
      continue;
    }
  }

  // 所有 Provider 都失败了
  const durationMs = Math.round(performance.now() - startTime);
  const rateLimitInfo = lastError
    ? isRateLimitError(lastError)
    : { isRateLimit: false };

  logger.error(
    {
      attemptedProviders,
      durationMs,
      blueprintId: options.blueprintId,
      lastError: lastError?.message,
      isRateLimitError: rateLimitInfo.isRateLimit,
    },
    "All providers failed for content generation",
  );

  // 构建友好的错误消息（便于排查为何未调用模型）
  let friendlyMessage: string;
  if (rateLimitInfo.isRateLimit) {
    const retryMsg = rateLimitInfo.retryAfter
      ? `请等待 ${rateLimitInfo.retryAfter} 秒后重试`
      : "请稍后重试";
    friendlyMessage = `AI 服务繁忙（已尝试 ${attemptedProviders.join("、")}）。${retryMsg}`;
  } else if (!lastError && attemptedProviders.length > 0) {
    friendlyMessage =
      "没有可用的 AI 模型（已尝试的 Provider 均未返回有效模型），请检查设置中的 API Key 与模型配置";
    logger.warn(
      { blueprintId: options.blueprintId, attemptedProviders },
      "No provider returned valid model (getModel returned null for all)",
    );
  } else {
    friendlyMessage = lastError?.message || "内容生成失败，请稍后重试";
  }

  // 发送错误
  yield {
    type: "error",
    data: {
      message: friendlyMessage,
      retryable: true,
      suggestion: rateLimitInfo.isRateLimit
        ? "AI 服务访问频率过高，请稍后重试"
        : "请重试或检查网络连接",
    },
  };

  if (rateLimitInfo.isRateLimit) {
    throw new RateLimitError(
      friendlyMessage,
      rateLimitInfo.retryAfter,
      attemptedProviders[attemptedProviders.length - 1],
    );
  }

  throw lastError || new Error("内容生成失败，请稍后重试");
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
