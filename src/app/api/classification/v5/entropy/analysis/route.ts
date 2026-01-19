/**
 * 智能分类 v5.0 - 熵值分析 API
 * GET /api/classification/v5/entropy/analysis
 *
 * 功能说明：
 * - 计算所有文件夹的熵值
 * - 识别高熵文件夹
 * - 生成熵减少建议
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EntropyReductionService } from "@/lib/classification/v5/entropy-reduction";
import { createLogger } from "@/lib/classification/v5/shared/logger";

/**
 * GET /api/classification/v5/entropy/analysis
 * 获取熵值分析报告
 */
export async function GET(_request: NextRequest) {
  const logger = createLogger("EntropyAnalysisAPI");

  try {
    // 1. 创建 Supabase 客户端
    const supabase = await createClient();

    // 2. 验证用户认证
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    // 3. 创建 EntropyReductionService
    const entropyService = new EntropyReductionService(supabase, logger);

    // 4. 计算所有文件夹的熵值
    logger.info("Calculating entropy for all folders", { userId: user.id });
    const allEntropyResults = await entropyService.calculateAllFolderEntropy();

    // 5. 识别高熵文件夹
    const highEntropyFolders =
      await entropyService.identifyHighEntropyFolders(5);

    // 6. 为高熵文件夹生成建议
    const suggestions = await Promise.all(
      highEntropyFolders
        .slice(0, 5)
        .map((folder) =>
          entropyService.suggestEntropyReduction(folder.folderId),
        ),
    );

    const flattenedSuggestions = suggestions.flat();

    logger.info("Entropy analysis completed", {
      userId: user.id,
      totalFolders: allEntropyResults.length,
      highEntropyCount: highEntropyFolders.length,
      suggestionsCount: flattenedSuggestions.length,
    });

    // 7. 返回分析报告
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
  } catch (error) {
    logger.error(
      "Entropy analysis API error",
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
