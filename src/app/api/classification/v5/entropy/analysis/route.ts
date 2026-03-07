/**
 * 智能分类 v5.0 - 熵值分析 API
 * GET /api/classification/v5/entropy/analysis
 *
 * 功能说明：
 * - 计算所有文件夹的熵值
 * - 识别高熵文件夹
 * - 生成熵减少建议
 *
 * @updated 2026-03-07 - 迁移到 withAuthMiddleware
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EntropyReductionService } from "@/lib/classification/strategies/modern/entropy-reduction";
import { createLogger } from "@/lib/classification/infrastructure/shared-services/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";

/**
 * GET /api/classification/v5/entropy/analysis
 * 获取熵值分析报告
 */
export const GET = withAuthMiddleware(async (_request, { userId }) => {
  const logger = createLogger("EntropyAnalysisAPI");

  // 1. 创建 Supabase 客户端
  const supabase = await createClient();

  // 2. 创建 EntropyReductionService
  const entropyService = new EntropyReductionService(supabase, logger);

  // 3. 计算所有文件夹的熵值
  logger.info("Calculating entropy for all folders", { userId });
  const allEntropyResults = await entropyService.calculateAllFolderEntropy();

  // 4. 识别高熵文件夹
  const highEntropyFolders = await entropyService.identifyHighEntropyFolders(5);

  // 5. 为高熵文件夹生成建议
  const suggestions = await Promise.all(
    highEntropyFolders
      .slice(0, 5)
      .map((folder) => entropyService.suggestEntropyReduction(folder.folderId)),
  );

  const flattenedSuggestions = suggestions.flat();

  logger.info("Entropy analysis completed", {
    userId,
    totalFolders: allEntropyResults.length,
    highEntropyCount: highEntropyFolders.length,
    suggestionsCount: flattenedSuggestions.length,
  });

  // 6. 返回分析报告
  return NextResponse.json({
    success: true,
    data: {
      summary: {
        totalFolders: allEntropyResults.length,
        highEntropyCount: highEntropyFolders.length,
        avgEntropy:
          allEntropyResults.length > 0
            ? allEntropyResults.reduce((sum, r) => sum + r.entropyScore, 0) /
              allEntropyResults.length
            : 0,
      },
      highEntropyFolders,
      suggestions: flattenedSuggestions,
      allFolders: allEntropyResults,
    },
  });
});
