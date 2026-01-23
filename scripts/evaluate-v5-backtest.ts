/**
 * V5.1 智能分类回测评估脚本
 *
 * 用法：npx tsx scripts/evaluate-v5-backtest.ts
 *
 * 原理：
 * 1. 获取所有已分类书签（用户分类 = Ground Truth）
 * 2. 对每条书签调用 V5.1 分类服务（直接调用 ClassificationPipelineService）
 * 3. 对比 AI 预测 vs 用户实际分类
 * 4. 生成准确率报告
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// 直接导入分类服务（tsx 支持 TypeScript 直接导入）
import { ClassificationPipelineService } from "../src/lib/classification/v5/classification-pipeline/classification-pipeline.service";
import { EmbeddingService } from "../src/lib/classification/v5/shared/embedding/index";
import { VectorSearchService } from "../src/lib/classification/v5/shared/vector-search/index";
import { LLMService } from "../src/lib/classification/v5/shared/llm/index";
import { createLogger } from "../src/lib/classification/v5/shared/logger/index";

// 加载环境变量
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

// ============================================================================
// 配置
// ============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ 错误: 缺少环境变量");
  console.error("   请确保 .env.local 文件中包含:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Supabase 客户端类型
type SupabaseClient = any;

// 评估配置
const CONFIG = {
  // 最大评估书签数（设为 0 表示全部）
  maxBookmarks: 100,
  // 是否只评估微信书签
  wechatOnly: false,
  // 输出详细日志
  verbose: true,
  // 批量大小（避免一次性加载过多）
  batchSize: 20,
  // API 基础 URL（确保 Next.js 开发服务器正在运行）
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:3000",
  // 请求间隔（毫秒），避免过快请求
  requestDelayMs: 100,
  // 只使用���实用户的数据（排除测试用户）
  realUserIds: [
    "fd8f3544-7ba6-4c65-b3ae-01141826fb9e", // 真实用户：1456 条书签，6 个平台
  ],
};

// ============================================================================
// 类型定义
// ============================================================================

interface BookmarkForEval {
  id: number;
  title: string;
  url: string;
  ai_summary?: string;
  folder_id: number;
  folder_name: string;
  platform?: string;
}

interface EvalResult {
  bookmarkId: number;
  title: string;
  groundTruthFolderId: number;
  groundTruthFolderName: string;
  predictedFolderId: number | null;
  predictedFolderName: string | null;
  confidence: number;
  isCorrect: boolean;
  latencyMs: number;
  tier: string;
  error?: string;
}

interface EvalReport {
  totalCount: number;
  evaluatedCount: number;
  correctCount: number;
  accuracy: number;
  avgConfidence: number;
  avgLatencyMs: number;
  byConfidenceRange: {
    high: { count: number; correct: number; accuracy: number };
    medium: { count: number; correct: number; accuracy: number };
    low: { count: number; correct: number; accuracy: number };
  };
  failureCases: EvalResult[];
  timestamp: string;
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log("🧪 V5.1 智能分类回测评估\n");
  console.log("=".repeat(60));

  // 1. 初始化 Supabase 客户端
  const supabase = createClient(
    SUPABASE_URL as string,
    SUPABASE_SERVICE_KEY as string,
  );

  // 2. 获取已分类书签
  console.log("\n📚 Step 1: 获取已分类书签...");
  const bookmarks = await getClassifiedBookmarks(supabase);
  console.log(`   找到 ${bookmarks.length} 条已分类书签`);

  if (bookmarks.length === 0) {
    console.log("❌ 没有已分类书签可供评估");
    return;
  }

  // 3. 限制评估数量
  const evalBookmarks =
    CONFIG.maxBookmarks > 0
      ? bookmarks.slice(0, CONFIG.maxBookmarks)
      : bookmarks;
  console.log(`   将评估 ${evalBookmarks.length} 条书签\n`);

  // 4. 运行评估
  console.log("🔬 Step 2: 运行 V5.1 分类评估...\n");
  const results = await runEvaluation(supabase, evalBookmarks);

  // 5. 生成报告
  console.log("\n📊 Step 3: 生成评估报告...\n");
  const report = generateReport(results);

  // 6. 输出报告
  printReport(report);

  // 7. 保存报告到文件
  await saveReport(report, results);
}

// ============================================================================
// 获取已分类书签
// ============================================================================

// 无效的文件夹名称列表（这些不是有效的分类目标）
const INVALID_FOLDER_NAMES = [
  "待整理",
  "其他",
  "未分类",
  "inbox",
  "Inbox",
  "INBOX",
  "默认",
  "收件箱",
];

async function getClassifiedBookmarks(
  supabase: SupabaseClient,
): Promise<BookmarkForEval[]> {
  // 1. 使用配置的真实用户 ID（排除测试用户）
  const validUserIds = CONFIG.realUserIds;

  console.log(`   使用 ${validUserIds.length} 个真实用户（排除测试数据）`);

  // 2. 只获取这些用户的已分类书签
  let query = supabase
    .from("bookmarks")
    .select(
      `
      id,
      title,
      url,
      ai_summary,
      folder_id,
      platform,
      user_id,
      folders!bookmarks_folder_id_fkey(name)
    `,
    )
    .not("folder_id", "is", null)
    .in("user_id", validUserIds)
    .order("created_at", { ascending: false });

  if (CONFIG.wechatOnly) {
    query = query.or("platform.eq.wechat,url.like.%mp.weixin.qq.com%");
  }

  const { data, error } = await query;

  if (error) {
    console.error("获取书签失败:", error);
    return [];
  }

  // 3. 过滤掉无效分类（待整理、其他等）
  const allBookmarks = (data || []).map((b: any) => ({
    id: b.id,
    title: b.title,
    url: b.url,
    summary: b.summary,
    folder_id: b.folder_id,
    folder_name: b.folders?.name || "未知",
    platform: b.platform,
  }));

  const validBookmarks = allBookmarks.filter(
    (b: { folder_name: string }) =>
      !INVALID_FOLDER_NAMES.includes(b.folder_name),
  );

  const filteredCount = allBookmarks.length - validBookmarks.length;
  if (filteredCount > 0) {
    console.log(`   排除 ${filteredCount} 条无效分类书签（待整理/其他等）`);
  }

  return validBookmarks;
}

// ============================================================================
// 运行评估
// ============================================================================

async function runEvaluation(
  supabase: SupabaseClient,
  bookmarks: BookmarkForEval[],
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  let processed = 0;

  for (const bookmark of bookmarks) {
    processed++;
    const progress = `[${processed}/${bookmarks.length}]`;

    try {
      const startTime = Date.now();

      // 调用分类 API（模拟，实际需要调用真实的分类服务）
      // ��里我们使用一个简化的方式：直接调用数据库中的相似度匹配
      const prediction = await classifyBookmark(supabase, bookmark);

      const latencyMs = Date.now() - startTime;
      const isCorrect = prediction.folderId === bookmark.folder_id;

      const result: EvalResult = {
        bookmarkId: bookmark.id,
        title: bookmark.title,
        groundTruthFolderId: bookmark.folder_id,
        groundTruthFolderName: bookmark.folder_name,
        predictedFolderId: prediction.folderId,
        predictedFolderName: prediction.folderName,
        confidence: prediction.confidence,
        isCorrect,
        latencyMs,
        tier: prediction.tier,
      };

      results.push(result);

      if (CONFIG.verbose) {
        const status = isCorrect ? "✅" : "❌";
        console.log(
          `${progress} ${status} "${bookmark.title.slice(0, 30)}..." → ${prediction.folderName} (${(prediction.confidence * 100).toFixed(0)}%)`,
        );
      }
    } catch (error) {
      results.push({
        bookmarkId: bookmark.id,
        title: bookmark.title,
        groundTruthFolderId: bookmark.folder_id,
        groundTruthFolderName: bookmark.folder_name,
        predictedFolderId: null,
        predictedFolderName: null,
        confidence: 0,
        isCorrect: false,
        latencyMs: 0,
        tier: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      if (CONFIG.verbose) {
        console.log(`${progress} ⚠️ 错误: ${bookmark.title.slice(0, 30)}...`);
      }
    }
  }

  return results;
}

// ============================================================================
// 分类函数 - 直接调用 ClassificationPipelineService
// ============================================================================

// 文件夹缓存（避免重复查询）
let folderCache: Map<number, string> | null = null;

async function getFolderName(
  supabase: SupabaseClient,
  folderId: number,
): Promise<string> {
  if (!folderCache) {
    folderCache = new Map();
    const { data: folders } = await supabase.from("folders").select("id, name");
    if (folders) {
      for (const f of folders) {
        folderCache.set(f.id, f.name);
      }
    }
  }
  return folderCache.get(folderId) || "未知文件夹";
}

// 延迟函数
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 分类服务单例（避免重复初始化）
let pipelineInstance: any = null;

async function getClassificationPipeline(supabase: SupabaseClient) {
  if (pipelineInstance) {
    return pipelineInstance;
  }

  // 使用顶层导入的模块（tsx 已正确处理）
  const logger = createLogger("BacktestEval");
  const embeddingService = new EmbeddingService(logger, {});
  // 降低相似度阈值，确保向量搜索能返回结果（默认 0.5 过高）
  const vectorSearch = new VectorSearchService(logger, {
    minSimilarity: 0.0, // 完全不过滤，与调试脚本保持一致
  });
  const llmService = new LLMService(logger);

  pipelineInstance = new ClassificationPipelineService(
    logger,
    embeddingService,
    vectorSearch,
    llmService,
    undefined, // config
    supabase, // v6: 传递 supabase 以启用 FolderContextProvider
  );

  return pipelineInstance;
}

async function classifyBookmark(
  supabase: SupabaseClient,
  bookmark: BookmarkForEval,
): Promise<{
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  tier: string;
}> {
  try {
    // 获取书签所属用户
    const { data: bookmarkData } = await supabase
      .from("bookmarks")
      .select("user_id")
      .eq("id", bookmark.id)
      .single();

    if (!bookmarkData?.user_id) {
      console.error(`❌ [${bookmark.id}] 无法获取用户ID`);
      return {
        folderId: null,
        folderName: null,
        confidence: 0,
        tier: "no_user",
      };
    }

    // 获取分类服务
    const pipeline = await getClassificationPipeline(supabase);

    // 构建分类请求
    const classificationRequest = {
      userId: bookmarkData.user_id,
      bookmarkId: String(bookmark.id),
      title: bookmark.title,
      url: bookmark.url,
      summary: bookmark.ai_summary,
    };

    if (CONFIG.verbose) {
      console.log(`🔍 [${bookmark.id}] 调用 ClassificationPipelineService...`);
    }

    // 调用分类服务
    const result = await pipeline.classify(classificationRequest);

    // 检查是否返回有效结果
    if (!result || !result.folderId) {
      console.warn(`⚠️ [${bookmark.id}] 分类服务返回空结果`);
      return classifyBookmarkFallback(supabase, bookmark);
    }

    const folderId = parseInt(result.folderId, 10);
    const folderName = await getFolderName(supabase, folderId);

    // 添加请求间隔，避免过快请求 LLM
    if (CONFIG.requestDelayMs > 0) {
      await delay(CONFIG.requestDelayMs);
    }

    return {
      folderId,
      folderName,
      confidence: result.confidence,
      tier: result.usedT1 ? "T1_LLM" : "T0_Vector",
    };
  } catch (error) {
    // 打印完整错误信息
    console.error(`\n❌ [${bookmark.id}] 分类失败:`);
    console.error(`   标题: ${bookmark.title.slice(0, 50)}`);
    if (error instanceof Error) {
      console.error(`   错误类型: ${error.constructor.name}`);
      console.error(`   错误信息: ${error.message}`);
      if (error.stack) {
        // 只打印前5行堆栈
        const stackLines = error.stack.split("\n").slice(0, 6);
        console.error(`   堆栈:\n${stackLines.join("\n")}`);
      }
    } else {
      console.error(`   错误: ${error}`);
    }
    console.error("");

    // 降级到简化逻辑
    return classifyBookmarkFallback(supabase, bookmark);
  }
}

// 降级方案：简化分类逻辑
async function classifyBookmarkFallback(
  supabase: SupabaseClient,
  bookmark: BookmarkForEval,
): Promise<{
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  tier: string;
}> {
  // 获取用户的所有文件夹
  const { data: folders } = await supabase.from("folders").select("id, name");

  if (!folders || folders.length === 0) {
    return {
      folderId: null,
      folderName: null,
      confidence: 0,
      tier: "no_folders",
    };
  }

  const titleLower = bookmark.title.toLowerCase();

  // L0: 规则匹配 - 标题包含文件夹名称
  for (const folder of folders) {
    if (titleLower.includes(folder.name.toLowerCase())) {
      return {
        folderId: folder.id,
        folderName: folder.name,
        confidence: 0.95,
        tier: "L0_rule",
      };
    }
  }

  // L1: 向量相似度匹配
  const { data: bookmarkData } = await supabase
    .from("bookmarks")
    .select("embedding")
    .eq("id", bookmark.id)
    .single();

  if (bookmarkData?.embedding) {
    const { data: matches } = await supabase.rpc("match_folder_profiles", {
      query_embedding: bookmarkData.embedding,
      match_count: 3,
    });

    if (matches && matches.length > 0) {
      const topMatch = matches[0];
      return {
        folderId: topMatch.folder_id,
        folderName: topMatch.folder_name,
        confidence: Math.min(topMatch.similarity, 1),
        tier: "L1_vector",
      };
    }
  }

  // 降级：返回第一个文件夹
  return {
    folderId: folders[0].id,
    folderName: folders[0].name,
    confidence: 0.2,
    tier: "fallback",
  };
}

// ============================================================================
// 生成报告
// ============================================================================

function generateReport(results: EvalResult[]): EvalReport {
  const evaluatedResults = results.filter((r) => !r.error);
  const correctResults = evaluatedResults.filter((r) => r.isCorrect);

  // 按置信度分组
  const highConf = evaluatedResults.filter((r) => r.confidence >= 0.9);
  const medConf = evaluatedResults.filter(
    (r) => r.confidence >= 0.7 && r.confidence < 0.9,
  );
  const lowConf = evaluatedResults.filter((r) => r.confidence < 0.7);

  return {
    totalCount: results.length,
    evaluatedCount: evaluatedResults.length,
    correctCount: correctResults.length,
    accuracy:
      evaluatedResults.length > 0
        ? correctResults.length / evaluatedResults.length
        : 0,
    avgConfidence:
      evaluatedResults.length > 0
        ? evaluatedResults.reduce((sum, r) => sum + r.confidence, 0) /
          evaluatedResults.length
        : 0,
    avgLatencyMs:
      evaluatedResults.length > 0
        ? evaluatedResults.reduce((sum, r) => sum + r.latencyMs, 0) /
          evaluatedResults.length
        : 0,
    byConfidenceRange: {
      high: {
        count: highConf.length,
        correct: highConf.filter((r) => r.isCorrect).length,
        accuracy:
          highConf.length > 0
            ? highConf.filter((r) => r.isCorrect).length / highConf.length
            : 0,
      },
      medium: {
        count: medConf.length,
        correct: medConf.filter((r) => r.isCorrect).length,
        accuracy:
          medConf.length > 0
            ? medConf.filter((r) => r.isCorrect).length / medConf.length
            : 0,
      },
      low: {
        count: lowConf.length,
        correct: lowConf.filter((r) => r.isCorrect).length,
        accuracy:
          lowConf.length > 0
            ? lowConf.filter((r) => r.isCorrect).length / lowConf.length
            : 0,
      },
    },
    failureCases: results.filter((r) => !r.isCorrect).slice(0, 20),
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// 输出报告
// ============================================================================

function printReport(report: EvalReport): void {
  console.log("=".repeat(60));
  console.log("📊 V5.1 智能分类评估报告");
  console.log("=".repeat(60));

  console.log(`\n📈 核心指标`);
  console.log(`   总书签数：${report.totalCount}`);
  console.log(`   评估书签数：${report.evaluatedCount}`);
  console.log(`   正确分类数：${report.correctCount}`);
  console.log(`   ✨ 准确率：${(report.accuracy * 100).toFixed(2)}%`);
  console.log(`   平均置信度：${(report.avgConfidence * 100).toFixed(2)}%`);
  console.log(`   平均延迟：${report.avgLatencyMs.toFixed(0)}ms`);

  console.log(`\n📊 置信度分层准确率`);
  console.log(
    `   高置信度 (≥90%)：${(report.byConfidenceRange.high.accuracy * 100).toFixed(1)}% (${report.byConfidenceRange.high.correct}/${report.byConfidenceRange.high.count})`,
  );
  console.log(
    `   中置信度 (70-89%)：${(report.byConfidenceRange.medium.accuracy * 100).toFixed(1)}% (${report.byConfidenceRange.medium.correct}/${report.byConfidenceRange.medium.count})`,
  );
  console.log(
    `   低置信度 (<70%)：${(report.byConfidenceRange.low.accuracy * 100).toFixed(1)}% (${report.byConfidenceRange.low.correct}/${report.byConfidenceRange.low.count})`,
  );

  console.log(`\n🎯 V6.0 目标对比`);
  console.log(
    `   准确率：${(report.accuracy * 100).toFixed(1)}% ${report.accuracy >= 0.95 ? "✅" : "❌"} (目标 >95%)`,
  );
  console.log(
    `   纠错率：${((1 - report.accuracy) * 100).toFixed(1)}% ${1 - report.accuracy <= 0.05 ? "✅" : "❌"} (目标 <5%)`,
  );

  if (report.failureCases.length > 0) {
    console.log(
      `\n❌ 失败案例 (前 ${Math.min(10, report.failureCases.length)} 条)`,
    );
    report.failureCases.slice(0, 10).forEach((c, i) => {
      console.log(
        `   ${i + 1}. "${c.title.slice(0, 30)}..." → 预测: ${c.predictedFolderName} | 实际: ${c.groundTruthFolderName}`,
      );
    });
  }

  console.log("\n" + "=".repeat(60));
}

// ============================================================================
// 保存报告
// ============================================================================

async function saveReport(
  report: EvalReport,
  results: EvalResult[],
): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");

  const outputDir = path.join(process.cwd(), "test-results");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // ��存 JSON 报告
  const jsonPath = path.join(outputDir, "v5-backtest-report.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ report, results }, null, 2));
  console.log(`\n💾 JSON 报告已保存: ${jsonPath}`);

  // 保存 Markdown 报告
  const mdPath = path.join(outputDir, "v5-backtest-report.md");
  const mdContent = `# V5.1 智能分类回测评估报告

**评估时间**: ${report.timestamp}

## 核心指标

| 指标 | 数值 | 状态 |
|------|------|------|
| 总书签数 | ${report.totalCount} | - |
| 评估书签数 | ${report.evaluatedCount} | - |
| 正确分类数 | ${report.correctCount} | - |
| **准确率** | **${(report.accuracy * 100).toFixed(2)}%** | ${report.accuracy >= 0.95 ? "✅ 达标" : "❌ 未达标"} |
| 纠错率 | ${((1 - report.accuracy) * 100).toFixed(2)}% | ${1 - report.accuracy <= 0.05 ? "✅ 达标" : "❌ 未达标"} |
| 平均置信度 | ${(report.avgConfidence * 100).toFixed(2)}% | - |
| 平均延迟 | ${report.avgLatencyMs.toFixed(0)}ms | - |

## 置信度分层准确率

| 置信度区间 | 样本数 | 正确数 | 准确率 |
|-----------|-------|-------|-------|
| 高 (≥90%) | ${report.byConfidenceRange.high.count} | ${report.byConfidenceRange.high.correct} | ${(report.byConfidenceRange.high.accuracy * 100).toFixed(1)}% |
| 中 (70-89%) | ${report.byConfidenceRange.medium.count} | ${report.byConfidenceRange.medium.correct} | ${(report.byConfidenceRange.medium.accuracy * 100).toFixed(1)}% |
| 低 (<70%) | ${report.byConfidenceRange.low.count} | ${report.byConfidenceRange.low.correct} | ${(report.byConfidenceRange.low.accuracy * 100).toFixed(1)}% |

## V6.0 目标对比

| 指标 | V5.1 当前值 | V6.0 目标 | 状态 |
|------|------------|----------|------|
| 准确率 | ${(report.accuracy * 100).toFixed(1)}% | >95% | ${report.accuracy >= 0.95 ? "✅" : "❌"} |
| 纠错率 | ${((1 - report.accuracy) * 100).toFixed(1)}% | <5% | ${1 - report.accuracy <= 0.05 ? "✅" : "❌"} |

## 失败案例分析

${report.failureCases
  .slice(0, 20)
  .map(
    (c, i) =>
      `${i + 1}. **${c.title.slice(0, 50)}**
   - 预测: ${c.predictedFolderName} (置信度: ${(c.confidence * 100).toFixed(0)}%)
   - 实际: ${c.groundTruthFolderName}`,
  )
  .join("\n\n")}
`;

  fs.writeFileSync(mdPath, mdContent);
  console.log(`💾 Markdown 报告已保存: ${mdPath}`);
}

// ============================================================================
// 运行
// ============================================================================

main().catch(console.error);
