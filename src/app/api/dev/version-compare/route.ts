/**
 * v3对比v4 API
 *
 * POST /api/dev/version-compare
 *
 * 支持 V3 / V4.1 / V4.2 版本对比
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CompareRequest,
  CompareResponse,
  VersionResult,
  VersionDiff,
  SelectedVersions,
} from "@/features/version-compare/types";

// 复用现有的分类执行器
import { executeClassification } from "@/features/classification-debugger/services/executor.service";
import type { ExecutionParams } from "@/features/classification-debugger/services/executor.service";
import { getMockContext } from "@/features/classification-debugger/services/mock-context.service";
import { getPresetConfig } from "@/features/classification-debugger/constants/presets";
import type { DebugScenario } from "@/features/classification-debugger/types";

export async function POST(request: Request) {
  try {
    // 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, error: "请先登录" },
        { status: 401 },
      );
    }

    // 解析请求
    const body: CompareRequest = await request.json();
    const { bookmark, scenario, versions } = body;

    // 验证输入
    if (!bookmark?.url || !bookmark?.title) {
      return Response.json(
        { success: false, error: "请填写 URL 和标题" },
        { status: 400 },
      );
    }

    const selectedVersions = getSelectedVersionKeys(versions);
    if (selectedVersions.length < 2) {
      return Response.json(
        { success: false, error: "请至少选择两个版本进行对比" },
        { status: 400 },
      );
    }

    logger.info(
      {
        userId: user.id,
        scenario,
        versions: selectedVersions,
        bookmarkTitle: bookmark.title,
      },
      "[VersionCompare] Starting comparison",
    );

    // 生成 Mock 数据
    const debugScenario: DebugScenario =
      scenario === "cold-start"
        ? "cold-start"
        : scenario === "mature"
          ? "mature"
          : "learning";
    const mockContext = getMockContext(debugScenario);

    // 并行执行所有选中版本的分类
    const results = await Promise.all(
      selectedVersions.map((version) =>
        executeVersionClassification(
          supabase,
          user.id,
          bookmark,
          version,
          mockContext,
        ),
      ),
    );

    // 生成差异分析
    const diffs = generateDiffs(results);

    const response: CompareResponse = {
      success: true,
      results,
      diffs,
    };

    logger.info(
      {
        userId: user.id,
        resultCount: results.length,
        diffCount: diffs.length,
      },
      "[VersionCompare] Comparison completed",
    );

    return Response.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error({ error: errorMessage }, "[VersionCompare] Route error");

    return Response.json(
      { success: false, error: "服务器错误: " + errorMessage },
      { status: 500 },
    );
  }
}

/**
 * 获取选中的版本列表
 */
function getSelectedVersionKeys(
  versions: SelectedVersions,
): Array<"v3" | "v4.1" | "v4.2"> {
  const result: Array<"v3" | "v4.1" | "v4.2"> = [];
  if (versions.v3) result.push("v3");
  if (versions.v41) result.push("v4.1");
  if (versions.v42) result.push("v4.2");
  return result;
}

/**
 * 执行单个版本的分类
 */
async function executeVersionClassification(
  supabase: SupabaseClient,
  userId: string,
  bookmark: CompareRequest["bookmark"],
  version: "v3" | "v4.1" | "v4.2",
  mockContext: ReturnType<typeof getMockContext>,
): Promise<VersionResult> {
  // 映射版本到执行器版本
  const executorVersion: "v3" | "v4" | "v41" =
    version === "v3" ? "v3" : version === "v4.1" ? "v41" : "v41"; // V4.2 暂时使用 V4.1 执行器

  const params: ExecutionParams = {
    bookmark: {
      url: bookmark.url,
      title: bookmark.title,
      description: bookmark.description,
      tags: bookmark.tags,
    },
    userId,
    config: getPresetConfig("default"),
    folders: mockContext.folders,
    history: mockContext.history,
    version: executorVersion,
    dryRun: true,
  };

  const result = await executeClassification(supabase, params);

  // 确定是否调用了 AI
  const aiCalled =
    result.v4Details?.tieredDetails?.aiCalled ||
    result.v41Details?.aiCalled ||
    result.tier === "T2" ||
    result.tier === "T3";

  return {
    version,
    folderId: result.folderId,
    folderName: result.folderName,
    confidence: result.confidence,
    executionTime: result.executionTime,
    tier: result.tier,
    action: result.action,
    aiCalled: aiCalled ?? false,
    details: {
      matchType: result.v41Details?.matchType,
      tagBoost: result.v41Details?.tagBoost,
      reasoning: result.reasoning,
    },
  };
}

/**
 * 生成版本间差异分析
 */
function generateDiffs(results: VersionResult[]): VersionDiff[] {
  const diffs: VersionDiff[] = [];

  // 如果有 V3，生成与其他版本的对比
  const v3Result = results.find((r) => r.version === "v3");
  const v41Result = results.find((r) => r.version === "v4.1");
  const v42Result = results.find((r) => r.version === "v4.2");

  if (v3Result && v41Result) {
    diffs.push(createDiff(v3Result, v41Result));
  }

  if (v3Result && v42Result) {
    diffs.push(createDiff(v3Result, v42Result));
  }

  if (v41Result && v42Result) {
    diffs.push(createDiff(v41Result, v42Result));
  }

  return diffs;
}

/**
 * 创建两个版本间的差异
 */
function createDiff(from: VersionResult, to: VersionResult): VersionDiff {
  const confidenceDiff = to.confidence - from.confidence;
  const timeDiff = to.executionTime - from.executionTime;
  const sameFolder =
    from.folderId === to.folderId && from.folderName === to.folderName;

  // 分层变化
  let tierChange: string | null = null;
  if (from.tier !== to.tier) {
    tierChange = `${from.tier} → ${to.tier}`;
  }

  // 改进点
  const improvements: string[] = [];

  if (confidenceDiff > 0) {
    improvements.push(`置信度提升 +${confidenceDiff}%`);
  }

  if (timeDiff < 0) {
    improvements.push(`耗时减少 ${Math.abs(timeDiff)}ms`);
  }

  if (from.aiCalled && !to.aiCalled) {
    improvements.push("跳过 AI 调用（节省成本）");
  }

  const tierOrder = { T1: 1, T2: 2, T3: 3 };
  if (tierOrder[to.tier] < tierOrder[from.tier]) {
    improvements.push(`分层优化 ${tierChange}`);
  }

  return {
    from: from.version.toUpperCase(),
    to: to.version.toUpperCase(),
    sameFolder,
    confidenceDiff,
    timeDiff,
    tierChange,
    improvements,
  };
}
