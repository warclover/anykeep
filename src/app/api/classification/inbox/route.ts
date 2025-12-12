/**
 * 待整理智能整理 API
 * GET /api/classification/inbox - 分析待整理文件夹
 * POST /api/classification/inbox - 应用整理建议
 * DELETE /api/classification/inbox - 拒绝整理建议
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ClassificationContainer } from "@/lib/classification";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  notFoundError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { PerformanceMonitor } from "@/lib/utils/performance-monitor";

/**
 * V4.2.1: HTTP 缓存配置
 * - private: 仅客户端缓存，不共享
 * - max-age=60: 60 秒内使用缓存
 * - stale-while-revalidate=30: 缓存过期后 30 秒内仍可使用旧数据，同时后台更新
 */
const CACHE_CONTROL_HEADER = "private, max-age=60, stale-while-revalidate=30";

/**
 * 应用建议 Schema
 */
const applySuggestionSchema = z.object({
  suggestionId: z.number().int().positive(),
});

/**
 * 拒绝建议 Schema
 */
const rejectSuggestionSchema = z.object({
  suggestionId: z.number().int().positive(),
});

/**
 * GET /api/classification/inbox
 * 分析待整理文件夹，生成整理建议
 */
export async function GET() {
  const monitor = new PerformanceMonitor("InboxAnalysis");

  try {
    // 1. 验证用户身份
    const supabase = await monitor.measure("Auth", async () => {
      const client = await createClient();
      return client;
    });

    const {
      data: { user },
      error: authError,
    } = await monitor.measure("GetUser", () => supabase.auth.getUser());

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    monitor.mark("AuthComplete", { userId: user.id });

    // 2. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const inboxOrganizerService = container.getInboxOrganizerService();
    monitor.mark("ContainerInitialized");

    // 3. 分析待整理文件夹（主要耗时操作）
    const analysis = await monitor.measure(
      "InboxAnalyze",
      () => inboxOrganizerService.analyze(user.id),
      { userId: user.id },
    );

    // V4.2: 获取聚类处理状态
    const clusterStatus = await monitor.measure("GetClusterStatus", () =>
      inboxOrganizerService.getClusterProcessingStatus(user.id),
    );

    // 输出性能报告
    const perfReport = monitor.getReport();
    logger.info(
      {
        userId: user.id,
        inboxCount: analysis.inboxCount,
        suggestionCount: analysis.suggestions.length,
        pendingClusterCount: clusterStatus.pendingClusterCount,
        performance: {
          totalMs: Math.round(perfReport.totalDuration),
          stages: perfReport.entries.map((e) => ({
            name: e.name,
            ms: Math.round(e.duration),
          })),
          slowOperations: perfReport.slowEntries.map((e) => e.name),
        },
      },
      "Inbox analysis completed",
    );

    // 4. 返回分析结果（包含聚类状态和性能数据）
    // V4.2.1: 添加 HTTP 缓存头以减少重复请求
    const responseData = {
      success: true,
      data: {
        ...analysis,
        clusterStatus,
        // 开发环境返回性能数据
        ...(process.env.NODE_ENV === "development" && {
          _performance: monitor.toJSON(),
        }),
      },
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        "Cache-Control": CACHE_CONTROL_HEADER,
      },
    });
  } catch (error) {
    const perfReport = monitor.getReport();
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        performance: {
          totalMs: Math.round(perfReport.totalDuration),
          failedAt: perfReport.entries[perfReport.entries.length - 1]?.name,
        },
      },
      "GET /api/classification/inbox error",
    );
    return internalError("分析待整理文件夹失败");
  }
}

/**
 * POST /api/classification/inbox
 * 应用整理建议
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = applySuggestionSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { suggestionId } = validation.data;

    // 3. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const inboxOrganizerService = container.getInboxOrganizerService();

    // 4. 应用建议
    try {
      await inboxOrganizerService.applySuggestion(user.id, suggestionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found") || message.includes("Unauthorized")) {
        return notFoundError("建议不存在或已过期");
      }
      throw error;
    }

    logger.info(
      {
        userId: user.id,
        suggestionId,
      },
      "Suggestion applied",
    );

    // 5. 返回成功
    return successResponse({ success: true });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "POST /api/classification/inbox error",
    );
    return internalError("应用建议失败");
  }
}

/**
 * DELETE /api/classification/inbox
 * 拒绝整理建议
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = rejectSuggestionSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { suggestionId } = validation.data;

    // 3. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase);
    const inboxOrganizerService = container.getInboxOrganizerService();

    // 4. 拒绝建议
    try {
      await inboxOrganizerService.rejectSuggestion(user.id, suggestionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found") || message.includes("Unauthorized")) {
        return notFoundError("建议不存在或已过期");
      }
      throw error;
    }

    logger.info(
      {
        userId: user.id,
        suggestionId,
      },
      "Suggestion rejected",
    );

    // 5. 返回成功
    return successResponse({ success: true });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "DELETE /api/classification/inbox error",
    );
    return internalError("拒绝建议失败");
  }
}
