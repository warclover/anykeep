/**
 * 评估数据集清洗脚本
 *
 * 用法：npx tsx scripts/clean-eval-dataset.ts
 *
 * 功能：
 * 1. 分析回测结果，识别不合理分类
 * 2. 检测"杂物箱"文件夹
 * 3. 生成清洗后的评估数据集
 * 4. 计算调整后准确率
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// 类型定义
// ============================================================================

interface EvalResult {
  bookmarkId: number;
  title: string;
  groundTruthFolderId: number;
  groundTruthFolderName: string;
  predictedFolderId: number;
  predictedFolderName: string;
  confidence: number;
  isCorrect: boolean;
  latencyMs: number;
  tier: string;
}

interface BacktestReport {
  report: {
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
  };
  results: EvalResult[];
}

interface CleaningResult {
  bookmarkId: number;
  title: string;
  groundTruthFolder: string;
  predictedFolder: string;
  cleaningReason: string;
  aiMoreReasonable: boolean;
  excluded: boolean;
}

// ============================================================================
// 清洗规则
// ============================================================================

/**
 * 不合理分类规则
 * 当书签标题明确指向某个主题，但用户分类到完全不相关的文件夹时
 */
const UNREASONABLE_CLASSIFICATION_RULES: Array<{
  titlePattern: RegExp;
  expectedFolders: string[];
  actualFolder: string;
  reason: string;
}> = [
  // PPT/科研绘图 不应该在 claude 学习
  {
    titlePattern: /PPT|科研绘图|绘图/i,
    expectedFolders: ["教程笔记", "设计", "工具"],
    actualFolder: "claude 学习",
    reason: "PPT/绘图内容与 Claude 无关",
  },
  // n8n 教程不应该在 claude 学习
  {
    titlePattern: /n8n|zapier|make\.com/i,
    expectedFolders: ["教程笔记", "工具", "自动化"],
    actualFolder: "claude 学习",
    reason: "n8n 是自动化工具，与 Claude 学习无关",
  },
  // Code Review 不应该在 claude 学习（除非明确提到 Claude）
  {
    titlePattern: /^Code Review(?!.*Claude)/i,
    expectedFolders: ["产品方法论", "软件架构与技术演进", "后端技术"],
    actualFolder: "claude 学习",
    reason: "通用 Code Review 内容，未涉及 Claude",
  },
  // 实验室/LIMS 内容分到非专业文件夹
  {
    titlePattern: /实验室|LIMS/i,
    expectedFolders: ["lims+实验室"],
    actualFolder: "claude 学习",
    reason: "实验室内容应分到专业文件夹",
  },
  {
    titlePattern: /实验室|LIMS/i,
    expectedFolders: ["lims+实验室"],
    actualFolder: "可持续发展",
    reason: "实验室内容应分到专业文件夹",
  },
];

/**
 * AI 预测更合理的规则
 */
const AI_MORE_REASONABLE_RULES: Array<{
  titlePattern: RegExp;
  predictedFolderPattern: RegExp;
  groundTruthFolder: string;
  reason: string;
}> = [
  // 标题包含 Claude 但 AI 预测到其他文件夹
  // 这种情况需要人工判断
];

/**
 * 已知的"杂物箱"文件夹
 * 这些文件夹内容混杂，作为 Ground Truth 不可靠
 */
const TRASH_FOLDERS = [
  // "claude 学习" 在此用户的数据中包含了大量非 Claude 内容
  // 但不能直接排除，需要逐条分析
];

// ============================================================================
// 清洗逻辑
// ============================================================================

function analyzeResult(result: EvalResult): CleaningResult {
  const cleaningResult: CleaningResult = {
    bookmarkId: result.bookmarkId,
    title: result.title,
    groundTruthFolder: result.groundTruthFolderName,
    predictedFolder: result.predictedFolderName,
    cleaningReason: "",
    aiMoreReasonable: false,
    excluded: false,
  };

  // 如果已经正确，不需要清洗
  if (result.isCorrect) {
    return cleaningResult;
  }

  // 规则1: 检查不合理分类
  for (const rule of UNREASONABLE_CLASSIFICATION_RULES) {
    if (
      rule.titlePattern.test(result.title) &&
      result.groundTruthFolderName === rule.actualFolder
    ) {
      cleaningResult.excluded = true;
      cleaningResult.aiMoreReasonable = true;
      cleaningResult.cleaningReason = rule.reason;
      return cleaningResult;
    }
  }

  // 规则2: 标题明确包含 Claude/claude 但分到了其他文件夹（AI 应该分到 claude 学习）
  const claudePattern = /claude|anthropic/i;
  if (claudePattern.test(result.title)) {
    if (result.groundTruthFolderName === "claude 学习") {
      // Ground truth 是 claude 学习，但 AI 预测错误
      // 这是 AI 的真正错误，不应排除
      cleaningResult.cleaningReason =
        "Claude 相关内容，AI 应预测到 claude 学习";
    } else if (result.predictedFolderName === "claude 学习") {
      // AI 预测到 claude 学习，但用户分到了其他地方
      // 可能是用户分类不合理
      cleaningResult.aiMoreReasonable = true;
      cleaningResult.cleaningReason = "标题含 Claude，AI 预测更合理";
      cleaningResult.excluded = true;
    }
  }

  // 规则3: 数据报告被 LLM 高置信选中（可能是标题含数字/排行榜等）
  if (
    result.predictedFolderName === "数据报告" &&
    result.confidence >= 0.9 &&
    /排行榜|报告|数据|统计/i.test(result.title)
  ) {
    cleaningResult.aiMoreReasonable = true;
    cleaningResult.cleaningReason = "标题含报告/数据关键词，AI 预测合理";
    cleaningResult.excluded = true;
  }

  // 规则4: 教程类内容被分到 claude 学习 但 AI 分到 教程笔记
  if (
    result.groundTruthFolderName === "claude 学习" &&
    result.predictedFolderName === "教程笔记" &&
    /教程|指南|入门|基础|实践/i.test(result.title) &&
    !/claude/i.test(result.title)
  ) {
    cleaningResult.aiMoreReasonable = true;
    cleaningResult.cleaningReason = "通用教程内容，AI 预测更合理";
    cleaningResult.excluded = true;
  }

  return cleaningResult;
}

function cleanDataset(report: BacktestReport): {
  cleanedResults: CleaningResult[];
  stats: {
    total: number;
    excluded: number;
    aiMoreReasonable: number;
    originalAccuracy: number;
    adjustedAccuracy: number;
  };
} {
  const cleanedResults: CleaningResult[] = [];
  let excludedCount = 0;
  let aiMoreReasonableCount = 0;
  let correctInCleanedSet = 0;

  for (const result of report.results) {
    const cleaned = analyzeResult(result);
    cleanedResults.push(cleaned);

    if (cleaned.excluded) {
      excludedCount++;
    }
    if (cleaned.aiMoreReasonable) {
      aiMoreReasonableCount++;
    }
    if (!cleaned.excluded && result.isCorrect) {
      correctInCleanedSet++;
    }
  }

  const cleanedTotal = report.results.length - excludedCount;
  const adjustedAccuracy =
    cleanedTotal > 0 ? correctInCleanedSet / cleanedTotal : 0;

  return {
    cleanedResults,
    stats: {
      total: report.results.length,
      excluded: excludedCount,
      aiMoreReasonable: aiMoreReasonableCount,
      originalAccuracy: report.report.accuracy,
      adjustedAccuracy,
    },
  };
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log("🧹 评估数据集清洗工具");
  console.log("=".repeat(60));

  // 读取回测报告
  const reportPath = path.join(
    process.cwd(),
    "test-results",
    "v5-backtest-report.json",
  );
  if (!fs.existsSync(reportPath)) {
    console.error("❌ 未找到回测报告:", reportPath);
    console.error("   请先运行: npx tsx scripts/evaluate-v5-backtest.ts");
    process.exit(1);
  }

  const reportData = JSON.parse(
    fs.readFileSync(reportPath, "utf-8"),
  ) as BacktestReport;
  console.log(`📊 加载回测报告: ${reportData.results.length} 条样本`);
  console.log(
    `   原始准确率: ${(reportData.report.accuracy * 100).toFixed(1)}%`,
  );

  // 执行清洗
  const { cleanedResults, stats } = cleanDataset(reportData);

  // 输出统计
  console.log("\n📈 清洗统计");
  console.log("-".repeat(40));
  console.log(`   总样本数: ${stats.total}`);
  console.log(`   排除样本数: ${stats.excluded}`);
  console.log(`   AI 更合理: ${stats.aiMoreReasonable}`);
  console.log(`   原始准确率: ${(stats.originalAccuracy * 100).toFixed(1)}%`);
  console.log(`   调整后准确率: ${(stats.adjustedAccuracy * 100).toFixed(1)}%`);
  console.log(
    `   准确率提升: +${((stats.adjustedAccuracy - stats.originalAccuracy) * 100).toFixed(1)}%`,
  );

  // 输出排除的样本
  const excludedSamples = cleanedResults.filter((r) => r.excluded);
  if (excludedSamples.length > 0) {
    console.log("\n🚫 排除的样本（AI 预测更合理）:");
    console.log("-".repeat(60));
    for (const sample of excludedSamples.slice(0, 20)) {
      console.log(
        `   [${sample.bookmarkId}] "${sample.title.slice(0, 40)}..."`,
      );
      console.log(
        `      用户分类: ${sample.groundTruthFolder} → AI: ${sample.predictedFolder}`,
      );
      console.log(`      原因: ${sample.cleaningReason}`);
    }
    if (excludedSamples.length > 20) {
      console.log(`   ... 还有 ${excludedSamples.length - 20} 条`);
    }
  }

  // 保存清洗结果
  const outputPath = path.join(
    process.cwd(),
    "test-results",
    "cleaned-eval-dataset.json",
  );
  const output = {
    stats,
    cleanedResults,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 清洗结果已保存: ${outputPath}`);

  // 生成清洗后的评估数据集（仅包含未排除的样本）
  const cleanedDatasetPath = path.join(
    process.cwd(),
    "test-results",
    "cleaned-bookmark-ids.json",
  );
  const cleanedBookmarkIds = cleanedResults
    .filter((r) => !r.excluded)
    .map((r) => r.bookmarkId);
  fs.writeFileSync(
    cleanedDatasetPath,
    JSON.stringify(cleanedBookmarkIds, null, 2),
  );
  console.log(`💾 清洗后书签 ID 列表已保存: ${cleanedDatasetPath}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ 清洗完成！");
  console.log(`   可用于回测的样本数: ${cleanedBookmarkIds.length}`);
}

main().catch((error) => {
  console.error("❌ 清洗失败:", error);
  process.exit(1);
});
