/**
 * AI Provider 诊断端点
 * @route GET /api/debug/ai-test
 * @description 测试 AI Provider 是否正常工作
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateText } from "ai";
import { aiProviderRouter } from "@/lib/ai-providers";
import { createLogger } from "@/lib/logger";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";

const logger = createLogger("api:debug:ai-test");

// 模拟 outline-generator 的 system prompt
const OUTLINE_SYSTEM_PROMPT = `你是一位专业的内容架构师。请用 JSON 格式输出大纲。`;

/**
 * @security 使用 internal auth 保护（调试工具路由）
 */
export async function GET(request: NextRequest) {
  const auth = verifyInternalRequest(request);
  if (!auth.authorized) {
    return internalUnauthorizedResponse(auth.error);
  }

  const results: {
    provider: string;
    model: string;
    testType: "simple" | "outline-style";
    status: "success" | "error" | "timeout";
    latencyMs: number;
    response?: string;
    error?: string;
  }[] = [];

  // 获取可用 Provider
  const providers = aiProviderRouter.getAvailableProviders();

  logger.info(
    {
      availableProviders: providers.map((p) => ({
        name: p.name,
        model: p.defaultModel,
        enabled: p.enabled,
      })),
    },
    "[AI-TEST] Starting AI provider diagnostics",
  );

  if (providers.length === 0) {
    return NextResponse.json({
      status: "error",
      message: "No AI providers available",
      healthStatus: aiProviderRouter.getHealthStatus(),
    });
  }

  // 测试每个 Provider - 两种调用模式
  for (const provider of providers) {
    const model = aiProviderRouter.getModel(provider.name);
    if (!model) {
      results.push({
        provider: provider.name,
        model: provider.defaultModel,
        testType: "simple",
        status: "error",
        latencyMs: 0,
        error: "Failed to get model instance",
      });
      continue;
    }

    // 测试 1: 简单调用（单一 prompt）
    {
      const startTime = performance.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        logger.info(
          { provider: provider.name, testType: "simple" },
          "[AI-TEST] Testing simple prompt...",
        );

        const result = await generateText({
          model,
          prompt: "Say 'Hello' in one word.",
          maxOutputTokens: 50,
          temperature: 0,
          abortSignal: controller.signal,
        });

        clearTimeout(timeoutId);
        const latencyMs = Math.round(performance.now() - startTime);

        results.push({
          provider: provider.name,
          model: provider.defaultModel,
          testType: "simple",
          status: "success",
          latencyMs,
          response: result.text.slice(0, 50),
        });
      } catch (error) {
        const latencyMs = Math.round(performance.now() - startTime);
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        results.push({
          provider: provider.name,
          model: provider.defaultModel,
          testType: "simple",
          status: errorMessage.includes("abort") ? "timeout" : "error",
          latencyMs,
          error: errorMessage,
        });
      }
    }

    // 测试 2: outline-style 调用（system + prompt 分离）
    {
      const startTime = performance.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        logger.info(
          { provider: provider.name, testType: "outline-style" },
          "[AI-TEST] Testing outline-style prompt...",
        );

        // 模拟 outline-generator 的调用模式
        const result = await generateText({
          model,
          system: OUTLINE_SYSTEM_PROMPT,
          prompt: `为"测试文章"生成简单大纲，只需要2个章节。输出 JSON 格式：{"title":"...", "nodes":[]}`,
          maxOutputTokens: 500,
          temperature: 0.7,
          abortSignal: controller.signal,
        });

        clearTimeout(timeoutId);
        const latencyMs = Math.round(performance.now() - startTime);

        results.push({
          provider: provider.name,
          model: provider.defaultModel,
          testType: "outline-style",
          status: "success",
          latencyMs,
          response: result.text.slice(0, 200),
        });
      } catch (error) {
        const latencyMs = Math.round(performance.now() - startTime);
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        results.push({
          provider: provider.name,
          model: provider.defaultModel,
          testType: "outline-style",
          status: errorMessage.includes("abort") ? "timeout" : "error",
          latencyMs,
          error: errorMessage,
        });
      }
    }
  }

  const summary = {
    total: results.length,
    success: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status !== "success").length,
    byProvider: providers.map((p) => ({
      name: p.name,
      model: p.defaultModel,
      simple: results.find(
        (r) => r.provider === p.name && r.testType === "simple",
      )?.status,
      outlineStyle: results.find(
        (r) => r.provider === p.name && r.testType === "outline-style",
      )?.status,
    })),
  };

  logger.info({ summary }, "[AI-TEST] Diagnostics complete");

  return NextResponse.json({
    status: "complete",
    timestamp: new Date().toISOString(),
    results,
    summary,
  });
}
