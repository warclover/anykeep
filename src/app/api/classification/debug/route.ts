/**
 * 智能分类调试 API
 * POST /api/classification/debug
 * 允许传递配置参数进行分类测试
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ClassificationContainer } from "@/lib/classification";
import { TieredClassificationService } from "@/lib/classification/v3/services/tiered-classification.service";
import { WeightedScoreAggregator } from "@/lib/classification/strategies";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";

/**
 * 调试请求 Schema
 */
const debugSchema = z.object({
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
    const validation = debugSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { title, summary, tags, url, embedding, config } = validation.data;

    // 3. 初始化容器和获取匹配器
    const container = ClassificationContainer.initialize(supabase);
    const matchers = container.getV3Matchers();
    const aggregator = new WeightedScoreAggregator();

    // 4. 创建 TieredClassificationService 实例 (专门用于调试)
    // 这里我们显式使用 TieredClassificationService 而不是通过 container 获取默认服务
    // 以便我们可以注入自定义配置
    const service = new TieredClassificationService(
      supabase,
      matchers,
      aggregator,
      config, // 注入配置覆盖
    );

    // 5. 准备上下文
    // 注意：我们需要手动准备上下文，因为 TieredClassificationService.classify 需要它
    // 但 TieredClassificationService 内部并没有 prepareContext 方法 (它是 ClassificationService 的私有方法)
    // 让我们看看 TieredClassificationService.classify 的签名
    // classify(userId, bookmark, context) -> Promise<ClassificationResult>

    // 我们需要构建 context。
    // 这稍微有点麻烦，因为生成 embedding 的逻辑在 ClassificationService 中。
    // 我们可以复用 embedding-generator 工具。

    // 导入 helper (需要动态导入或者直接使用)
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

    const context = {
      userId: user.id,
      bookmarkId: -1, // 调试模式，无具体书签 ID
      title,
      summary: summary || "",
      tags: tags || [],
      embedding: finalEmbedding || [],
      url,
    };

    // 6. 执行分类
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

    // 7. 获取指标 (如果有)
    const metrics = service.getMetrics();

    return successResponse({
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
