/**
 * AI 摘要调试 API
 *
 * 仅在开发环境可用
 * 支持使用调试配置测试 AI 摘要效果
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateAIContent } from "@/lib/utils/ai-generator";
import { detectContentType } from "@/lib/classification/content-type-detector";
import { logger } from "@/lib/logger";

/**
 * 检查是否为开发环境
 */
function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * POST /api/debug/ai-summary
 *
 * 测试 AI 摘要生成
 */
export async function POST(request: NextRequest) {
  // 仅开发环境可用
  if (!isDevEnvironment()) {
    return NextResponse.json(
      { error: "Debug API is only available in development" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { url, title, description, content, useDebugConfig } = body;

    if (!url && !title) {
      return NextResponse.json(
        { error: "URL or title is required" },
        { status: 400 },
      );
    }

    // 如果只提供了 URL，先尝试获取页面信息
    let pageTitle = title;
    let pageDescription = description;
    const pageContent = content;

    if (url && !title) {
      try {
        // 简单获取页面标题
        const pageInfo = await fetchPageInfo(url);
        pageTitle = pageInfo.title || url;
        pageDescription = pageInfo.description;
      } catch {
        pageTitle = url;
      }
    }

    logger.info(
      {
        url,
        title: pageTitle,
        useDebugConfig,
        action: "debug_ai_summary_request",
      },
      "Debug AI Summary: Request received",
    );

    // 检测内容类型
    const contentTypeResult = detectContentType({
      url,
      title: pageTitle,
      description: pageDescription,
      content: pageContent,
    });

    // 调用 AI 生成
    const startTime = Date.now();
    const result = await generateAIContent({
      title: pageTitle,
      url,
      description: pageDescription,
      content: pageContent,
    });
    const latency = Date.now() - startTime;

    logger.info(
      {
        contentType: result.contentType,
        confidence: result.contentTypeConfidence,
        latency,
        tagsCount: result.tags.length,
        summaryLength: result.summary.length,
        action: "debug_ai_summary_complete",
      },
      "Debug AI Summary: Generation complete",
    );

    return NextResponse.json({
      success: true,
      url,
      title: pageTitle,
      contentType: result.contentType || contentTypeResult.type,
      confidence: result.contentTypeConfidence || contentTypeResult.confidence,
      summary: result.summary,
      tags: result.tags,
      latency,
      signals: contentTypeResult.signals,
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        action: "debug_ai_summary_error",
      },
      "Debug AI Summary: Error",
    );

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Generation failed",
      },
      { status: 500 },
    );
  }
}

/**
 * 获取页面基本信息
 */
async function fetchPageInfo(
  url: string,
): Promise<{ title?: string; description?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {};
    }

    const html = await response.text();

    // 提取标题
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // 提取 description
    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
    );
    const description = descMatch ? descMatch[1].trim() : undefined;

    return { title, description };
  } catch {
    return {};
  }
}

/**
 * GET /api/debug/ai-summary
 *
 * 获取调试 API 状态
 */
export async function GET() {
  if (!isDevEnvironment()) {
    return NextResponse.json(
      { error: "Debug API is only available in development" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    status: "ok",
    environment: process.env.NODE_ENV,
    features: {
      jsonOutput: process.env.AI_SUMMARY_JSON_OUTPUT === "true",
      jinaReader: process.env.AI_SUMMARY_USE_JINA === "true",
      modelRouting: process.env.AI_SUMMARY_MODEL_ROUTING === "true",
    },
  });
}
