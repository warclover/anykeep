/**
 * DeepSeek API 客户端
 *
 * 封装 DeepSeek API 调用逻辑
 *
 * @module ai-generator/api/deepseek-client
 * @version 1.0.0
 */

import { logger } from "@/lib/logger";
import type { ContentTypeResult } from "@/lib/classification/content-type-detector";
import {
  getPromptConfig,
  buildTypeSpecificPrompt,
  getPromptConfigV2,
  buildTypeSpecificPromptV2,
} from "@/lib/classification/prompts";
import { isJsonOutputEnabled } from "@/lib/classification/config/ai-summary-config";
import type { AIGenerateResult, GenerateWithAIOptions } from "../types";
import { parseAIResponse, parseAIResponseV2 } from "./response-parser";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEFAULT_TIMEOUT = 15000;

/**
 * 简单 AI 生成函数
 *
 * 用于 V4.1 分类等场景的简单文本生成
 */
export async function generateWithAI(
  prompt: string,
  options?: GenerateWithAIOptions,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 环境变量未配置");
  }

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("DeepSeek API 返回空内容");
    }

    return content.trim();
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "generateWithAI: API call failed",
    );
    throw error;
  }
}

/**
 * 调用 DeepSeek API 生成摘要和标签
 *
 * V2: 支持内容类型自适应 Prompt
 * V2.1: 支持 JSON 结构化输出（通过配置开关控制）
 */
export async function callDeepSeekAPI(
  title: string,
  contentTypeResult: ContentTypeResult,
  description?: string,
  content?: string,
  existingFolderNames?: string[],
): Promise<AIGenerateResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY 环境变量未配置");
  }

  const useJsonOutput = isJsonOutputEnabled();

  logger.debug(
    {
      useJsonOutput,
      configVersion: "2.1",
      action: "ai_config_check",
    },
    "AI Generator: Config check",
  );

  let systemPrompt: string;
  let userPrompt: string;
  let temperature: number;

  if (useJsonOutput) {
    const promptConfigV2 = getPromptConfigV2(contentTypeResult.type);
    systemPrompt = promptConfigV2.systemPrompt;
    userPrompt = buildTypeSpecificPromptV2(
      contentTypeResult.type,
      title,
      description,
      content,
      existingFolderNames,
    );
    temperature = promptConfigV2.temperature;
  } else {
    const promptConfig = getPromptConfig(contentTypeResult.type);
    systemPrompt = promptConfig.systemPrompt;
    userPrompt = buildTypeSpecificPrompt(
      contentTypeResult.type,
      title,
      description,
      content,
      existingFolderNames,
    );
    temperature = promptConfig.temperature;
  }

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: temperature,
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API 错误: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiContent = data.choices[0]?.message?.content;

    if (!aiContent) {
      throw new Error("AI 未返回内容");
    }

    let result: AIGenerateResult;

    if (useJsonOutput) {
      result = parseAIResponseV2(aiContent);
    } else {
      result = parseAIResponse(aiContent);
    }

    result.contentType = contentTypeResult.type;
    result.contentTypeConfidence = contentTypeResult.confidence;

    return result;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(
        {
          error: error.message,
          useJsonOutput,
          action: "deepseek_api_call",
        },
        "AI Generator: DeepSeek API error",
      );
      throw new Error(`AI 生成失败: ${error.message}`);
    }
    throw new Error("AI 生成失败");
  }
}
