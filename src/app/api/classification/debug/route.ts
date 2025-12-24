/**
 * 智能分类调试 API（合并版）
 *
 * 合并 debug + test + trace 三个端点
 *
 * GET /api/classification/debug?type=health - 健康检查（无需认证）
 * GET /api/classification/debug?type=test - 运行集成测试
 * GET /api/classification/debug?type=trace&traceId=xxx - 查询单个追踪
 * GET /api/classification/debug?type=trace&recent=50 - 查询最近追踪列表
 * POST /api/classification/debug - 调试分类（可传递配置参数）
 *
 * @version 2.0.0 (Phase 1 合并)
 * @since 2025-12-24
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ClassificationContainer } from "@/lib/classification";
import { TieredClassificationService } from "@/lib/classification/services/advanced";
import { WeightedScoreAggregator } from "@/lib/classification/strategies";
import { createTraceStorageService } from "@/lib/classification/services/advanced";
import {
  runIntegrationTests,
  runHealthCheck,
} from "@/lib/classification/testing/integration-test";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  badRequestError,
  notFoundError,
  forbiddenError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

// ============================================
// Schema 定义
// ============================================

/**
 * 调试分类请求 Schema
 */
const debugClassifySchema = z.object({
  // 书签数据
  title: z.string().min(1, "标题不能为空").max(500),
  summary: z.string().max(1000).optional().default(""),
  tags: z.array(z.string()).max(20).optional().default([]),
  url: z.string().url().optional(),
  embedding: z.array(z.number()).optional(),

  // 配置覆盖
  config: z
    .object({
      highConfidenceThreshold: z.number().min(0).max(100).optional(),
      mediumConfidenceThreshold: z.number().min(0).max(100).optional(),
      autoCreateConfidenceThreshold: z.number().min(0).max(100).optional(),
      tieredOptimizationEnabled: z.boolean().optional(),
      metricsEnabled: z.boolean().optional(),
    })
    .optional(),
});

// ============================================
// GET 处理器
// ============================================

/**
 * GET /api/classification/debug
 *
 * Query params:
 * - type: 'health' | 'test' | 'trace'
 * - traceId: string (当 type=trace)
 * - recent: number (当 type=trace)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "health";

    // 健康检查（无需认证）
    if (type === "health") {
      const health = runHealthCheck();
      return successResponse({
        type: "health_check",
        ...health,
      });
    }

    // 其他操作需要认证
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError("请先登录");
    }

    // 集成测试
    if (type === "test") {
      const report = await runIntegrationTests(user.id);

      logger.info(
        {
          userId: user.id,
          totalTests: report.totalTests,
          passed: report.passed,
          failed: report.failed,
          duration: report.duration,
        },
        "Integration tests completed",
      );

      return successResponse({
        type: "integration_test",
        ...report,
      });
    }

    // 追踪查询
    if (type === "trace") {
      const traceId = searchParams.get("traceId");
      const recent = searchParams.get("recent");
      const traceService = createTraceStorageService(supabase);

      // 查询单个追踪
      if (traceId) {
        const trace = await traceService.getTrace(traceId);

        if (!trace) {
          return notFoundError("追踪记录不存在");
        }

        // 验证用户权限
        if (trace.userId !== user.id) {
          return forbiddenError("无权访问此追踪记录");
        }

        return successResponse({
          type: "trace",
          data: trace,
        });
      }

      // 查询最近的追踪列表
      if (recent) {
        const limit = Math.min(parseInt(recent, 10) || 50, 100);
        const traces = await traceService.getRecentTraces(user.id, limit);

        return successResponse({
          type: "trace_list",
          data: traces,
          count: traces.length,
        });
      }

      return badRequestError("缺少 traceId 或 recent 参数");
    }

    return badRequestError(`未知的调试类型: ${type}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { error: errorMessage },
      "GET /api/classification/debug error",
    );
    return internalError("调试查询失败");
  }
}

// ============================================
// POST 处理器
// ============================================

/**
 * POST /api/classification/debug
 *
 * 调试分类，可传递配置参数测试分类结果
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

    // 2. 解析请求
    const body = await request.json();
    const validation = debugClassifySchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { title, summary, tags, url, embedding, config } = validation.data;

    // 3. 初始化容器和获取匹配器
    const container = ClassificationContainer.initialize(supabase);
    const matchers = container.getV3Matchers();
    const aggregator = new WeightedScoreAggregator();

    // 4. 创建 TieredClassificationService 实例 (专门用于调试)
    const service = new TieredClassificationService(
      supabase,
      matchers,
      aggregator,
      config, // 注入配置覆盖
    );

    // 5. 生成 embedding（如果未提供）
    const { generateEmbedding, buildEmbeddingText } = await import(
      "@/lib/utils/embedding-generator"
    );

    let finalEmbedding = embedding;
    if (!finalEmbedding || finalEmbedding.length === 0) {
      try {
        const text = buildEmbeddingText(title, summary, tags);
        finalEmbedding = await generateEmbedding(text);
      } catch {
        logger.warn("Embedding generation failed in debug mode");
        finalEmbedding = [];
      }
    }

    // 6. 准备上下文
    const context = {
      userId: user.id,
      bookmarkId: -1, // 调试模式，无具体书签 ID
      title,
      summary: summary || "",
      tags: tags || [],
      embedding: finalEmbedding || [],
      url,
    };

    // 7. 执行分类
    const result = await service.classify(
      user.id,
      {
        id: -1,
        title,
        summary,
        tags,
        url,
        embedding: finalEmbedding,
      },
      context,
    );

    // 8. 获取指标 (如果有)
    const metrics = service.getMetrics();

    return successResponse({
      type: "debug_classify",
      classification: result,
      metrics,
      usedConfig: service.getConfig(),
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Debug classification failed",
    );
    return internalError("调试分类失败");
  }
}
