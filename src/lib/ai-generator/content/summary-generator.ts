/**
 * 摘要生成器
 *
 * 主要的摘要生成逻辑，整合 API 调用和服务切换
 *
 * @module ai-generator/content/summary-generator
 * @version 1.0.0
 */

import { logger } from "@/lib/logger";
import {
  detectContentType,
  type ContentTypeResult,
} from "@/lib/classification/content-type-detector";
import {
  getSummaryService,
  isNewSummaryServiceEnabled,
  type SummaryInput,
  type SummaryResult,
} from "@/lib/summary";
import { callDeepSeekAPI } from "../api/deepseek-client";
import { generateFallbackContent } from "./fallback-generator";
import type {
  AIGenerateResult,
  AIGenerateRequest,
  AIGenerateOptions,
} from "../types";

/**
 * 使用新的 SummaryService 生成摘要
 */
async function generateWithNewService(
  request: AIGenerateRequest,
  contentTypeResult: ContentTypeResult,
  bookmarkId: number,
  userId: string,
): Promise<AIGenerateResult> {
  const { title, url, description, content } = request;

  logger.info(
    {
      bookmarkId,
      userId,
      contentType: contentTypeResult.type,
      action: "new_service_start",
    },
    "AI Generator: Using new SummaryService (V2.0)",
  );

  const summaryService = getSummaryService();

  const summaryInput: SummaryInput = {
    bookmarkId,
    userId,
    title,
    url,
    description,
    content,
    contentType: contentTypeResult.type,
  };

  const result: SummaryResult = await summaryService.generate(summaryInput, {
    needsClassification: true,
  });

  logger.info(
    {
      bookmarkId,
      provider: result.providerUsed,
      latencyMs: result.latencyMs,
      tagsCount: result.tags.length,
      action: "new_service_success",
    },
    "AI Generator: New SummaryService success",
  );

  return {
    summary: result.summary,
    tags: result.tags,
    contentType: result.contentType || contentTypeResult.type,
    contentTypeConfidence:
      result.contentTypeConfidence || contentTypeResult.confidence,
  };
}

/**
 * 生成 AI 摘要和标签
 *
 * V2: 支持内容类型自适应摘要
 * V2.0: 支持新 SummaryService（通过 AI_SUMMARY_V2 特性开关控制）
 *
 * @param request - 包含标题、URL、描述和内容的请求对象
 * @param options - 额外选项
 * @returns AI 生成的摘要、标签和内容类型
 */
export async function generateAIContent(
  request: AIGenerateRequest,
  options?: AIGenerateOptions,
): Promise<AIGenerateResult> {
  const { title, url, description, content, existingFolderNames } = request;

  if (!title || title.trim().length === 0) {
    throw new Error("标题不能为空");
  }

  const contentTypeResult = detectContentType({
    url,
    title,
    description,
    content,
  });

  const useNewService =
    !options?.forceLegacy &&
    isNewSummaryServiceEnabled() &&
    options?.bookmarkId &&
    options?.userId;

  if (useNewService) {
    try {
      return await generateWithNewService(
        request,
        contentTypeResult,
        options.bookmarkId!,
        options.userId!,
      );
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          bookmarkId: options.bookmarkId,
          action: "new_service_fallback",
        },
        "AI Generator: New service failed, falling back to legacy",
      );
    }
  }

  try {
    logger.info(
      {
        title,
        url,
        contentType: contentTypeResult.type,
        contentTypeConfidence: contentTypeResult.confidence,
        folderCount: existingFolderNames?.length || 0,
        useNewService: false,
        action: "generate_start",
      },
      "AI Generator: Generating content with type detection",
    );

    const result = await callDeepSeekAPI(
      title,
      contentTypeResult,
      description,
      content,
      existingFolderNames,
    );

    logger.info(
      {
        summary: result.summary.substring(0, 100),
        tagCount: result.tags.length,
        contentType: result.contentType,
        action: "generate_success",
      },
      "AI Generator: Success",
    );
    return result;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        title,
        contentType: contentTypeResult.type,
        action: "generate_failed",
      },
      "AI Generator: Failed, using fallback",
    );
    const fallback = generateFallbackContent(title, description, content);

    fallback.contentType = contentTypeResult.type;
    fallback.contentTypeConfidence = contentTypeResult.confidence;

    logger.info(
      {
        summary: fallback.summary,
        tagCount: fallback.tags.length,
        contentType: fallback.contentType,
        action: "fallback_used",
      },
      "AI Generator: Fallback",
    );
    return fallback;
  }
}
