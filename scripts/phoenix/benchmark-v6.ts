/**
 * 🦅 Project Phoenix - v6.0 性能基准测试
 *
 * 测试目标：
 * - L1 客户端推理延迟 (P50/P90/P99)
 * - L1 命中率
 * - 端到端分类延迟
 * - API 调用量对比
 */

import { performance } from "perf_hooks";
import { createClient } from "@supabase/supabase-js";
import { ClientBayesianEngine } from "@/lib/classification/v6/client/bayesian-engine";

// ==================== 配置 ====================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const TEST_CONFIG = {
  sampleSize: 1000, // 测试样本数量
  userId: process.env.TEST_USER_ID!, // 测试用户 ID
};

// ==================== 测试数据 ====================

const TEST_BOOKMARKS = [
  {
    title: "React 18 新特性详解",
    content: "React 18 引入了并发渲染、自动批处理等新特性...",
    expectedFolder: "技术/前端",
  },
  {
    title: "空气炸锅烤鸡翅做法",
    content: "无油烹饪，健康美味，只需要...",
    expectedFolder: "生活/美食",
  },
  {
    title: "基金定投策略分析",
    content: "定期定额投资策略在震荡市场中的优势...",
    expectedFolder: "理财",
  },
  // ... 可以添加更多测试样本
];

// ==================== 性能指标 ====================

interface BenchmarkResult {
  l1: {
    latency: {
      p50: number;
      p90: number;
      p99: number;
      avg: number;
    };
    hitRate: number;
    accuracy: number;
  };
  e2e: {
    latency: {
      p50: number;
      p90: number;
      p99: number;
      avg: number;
    };
    apiCallReduction: number;
  };
  summary: {
    pass: boolean;
    details: string[];
  };
}

// ==================== 测试执行器 ====================

async function runBenchmark(): Promise<BenchmarkResult> {
  console.log("🚀 Project Phoenix - v6.0 性能基准测试");
  console.log("=========================================\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const engine = new ClientBayesianEngine();

  // 1. 加载索引
  console.log("📥 加载贝叶斯索引...");
  const indexLoadStart = performance.now();
  await engine.loadIndex(TEST_CONFIG.userId);
  const indexLoadTime = performance.now() - indexLoadStart;
  console.log(`   索引加载耗时: ${indexLoadTime.toFixed(2)}ms\n`);

  // 2. L1 延迟测试
  console.log("⚡ 测试 L1 客户端推理性能...");
  const l1Latencies: number[] = [];
  let l1Hits = 0;
  let l1Correct = 0;

  for (let i = 0; i < TEST_CONFIG.sampleSize; i++) {
    const bookmark = TEST_BOOKMARKS[i % TEST_BOOKMARKS.length];

    const start = performance.now();
    const result = engine.predict(bookmark.title, bookmark.content);
    const latency = performance.now() - start;

    l1Latencies.push(latency);

    if (result.success) {
      l1Hits++;
      // 简单验证准确性（实际应该与真实标签对比）
      if (result.folderName?.includes(bookmark.expectedFolder.split("/")[0])) {
        l1Correct++;
      }
    }

    if ((i + 1) % 100 === 0) {
      console.log(`   已测试: ${i + 1}/${TEST_CONFIG.sampleSize}`);
    }
  }

  const l1HitRate = (l1Hits / TEST_CONFIG.sampleSize) * 100;
  const l1Accuracy = (l1Correct / l1Hits) * 100;

  console.log(`   L1 命中率: ${l1HitRate.toFixed(1)}%`);
  console.log(`   L1 准确率: ${l1Accuracy.toFixed(1)}%\n`);

  // 3. 端到端延迟测试（包含网络 RTT）
  console.log("🌐 测试端到端分类性能...");
  const e2eLatencies: number[] = [];
  let apiCalls = 0;

  for (let i = 0; i < Math.min(100, TEST_CONFIG.sampleSize); i++) {
    const bookmark = TEST_BOOKMARKS[i % TEST_BOOKMARKS.length];

    const start = performance.now();

    // 1. 先尝试 L1
    const l1Result = engine.predict(bookmark.title, bookmark.content);

    if (l1Result.success) {
      // L1 成功，无需 API 调用
      const latency = performance.now() - start;
      e2eLatencies.push(latency);
    } else {
      // L1 失败，调用服务端 API
      apiCalls++;
      try {
        const response = await fetch("/api/classification/v6/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: TEST_CONFIG.userId,
            bookmark,
            l1Result: {
              confidence: l1Result.confidence,
              topCandidates: l1Result.topCandidates,
            },
          }),
        });
        await response.json();
        const latency = performance.now() - start;
        e2eLatencies.push(latency);
      } catch (error) {
        console.error(`   API 调用失败: ${error}`);
      }
    }
  }

  const apiCallReduction = (1 - apiCalls / 100) * 100;
  console.log(`   API 调用减少: ${apiCallReduction.toFixed(1)}%\n`);

  // 4. 计算百分位数
  const calculatePercentile = (arr: number[], p: number) => {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((sorted.length * p) / 100) - 1;
    return sorted[index];
  };

  const l1P50 = calculatePercentile(l1Latencies, 50);
  const l1P90 = calculatePercentile(l1Latencies, 90);
  const l1P99 = calculatePercentile(l1Latencies, 99);
  const l1Avg = l1Latencies.reduce((a, b) => a + b, 0) / l1Latencies.length;

  const e2eP50 = calculatePercentile(e2eLatencies, 50);
  const e2eP90 = calculatePercentile(e2eLatencies, 90);
  const e2eP99 = calculatePercentile(e2eLatencies, 99);
  const e2eAvg = e2eLatencies.reduce((a, b) => a + b, 0) / e2eLatencies.length;

  // 5. 验收判定
  const details: string[] = [];
  let pass = true;

  if (l1P99 > 20) {
    details.push(`❌ L1 P99 延迟 ${l1P99.toFixed(2)}ms > 20ms (目标)`);
    pass = false;
  } else {
    details.push(`✅ L1 P99 延迟 ${l1P99.toFixed(2)}ms < 20ms`);
  }

  if (l1HitRate < 70) {
    details.push(`❌ L1 命中率 ${l1HitRate.toFixed(1)}% < 70% (目标)`);
    pass = false;
  } else {
    details.push(`✅ L1 命中率 ${l1HitRate.toFixed(1)}% ≥ 70%`);
  }

  if (e2eP99 > 50) {
    details.push(`❌ 端到端 P99 延迟 ${e2eP99.toFixed(2)}ms > 50ms (目标)`);
    pass = false;
  } else {
    details.push(`✅ 端到端 P99 延迟 ${e2eP99.toFixed(2)}ms < 50ms`);
  }

  if (apiCallReduction < 60) {
    details.push(
      `❌ API 调用减少 ${apiCallReduction.toFixed(1)}% < 60% (目标)`,
    );
    pass = false;
  } else {
    details.push(`✅ API 调用减少 ${apiCallReduction.toFixed(1)}% ≥ 60%`);
  }

  // 6. 返回结果
  return {
    l1: {
      latency: {
        p50: l1P50,
        p90: l1P90,
        p99: l1P99,
        avg: l1Avg,
      },
      hitRate: l1HitRate,
      accuracy: l1Accuracy,
    },
    e2e: {
      latency: {
        p50: e2eP50,
        p90: e2eP90,
        p99: e2eP99,
        avg: e2eAvg,
      },
      apiCallReduction,
    },
    summary: {
      pass,
      details,
    },
  };
}

// ==================== 报告生成 ====================

function printReport(result: BenchmarkResult) {
  console.log("\n📊 性能测试报告");
  console.log("=========================================");

  console.log("\n🚀 L1 客户端层性能:");
  console.log(`   P50 延迟: ${result.l1.latency.p50.toFixed(2)}ms`);
  console.log(`   P90 延迟: ${result.l1.latency.p90.toFixed(2)}ms`);
  console.log(`   P99 延迟: ${result.l1.latency.p99.toFixed(2)}ms`);
  console.log(`   平均延迟: ${result.l1.latency.avg.toFixed(2)}ms`);
  console.log(`   命中率: ${result.l1.hitRate.toFixed(1)}%`);
  console.log(`   准确率: ${result.l1.accuracy.toFixed(1)}%`);

  console.log("\n🌐 端到端性能:");
  console.log(`   P50 延迟: ${result.e2e.latency.p50.toFixed(2)}ms`);
  console.log(`   P90 延迟: ${result.e2e.latency.p90.toFixed(2)}ms`);
  console.log(`   P99 延迟: ${result.e2e.latency.p99.toFixed(2)}ms`);
  console.log(`   API 调用减少: ${result.e2e.apiCallReduction.toFixed(1)}%`);

  console.log("\n✅ 验收标准:");
  result.summary.details.forEach((detail) => console.log(`   ${detail}`));

  console.log("\n=========================================");
  if (result.summary.pass) {
    console.log("🎉 所有性能指标达标！");
  } else {
    console.log("⚠️  部分性能指标未达标，请优化后重测。");
  }
  console.log("=========================================\n");
}

// ==================== 主函数 ====================

async function main() {
  try {
    const result = await runBenchmark();
    printReport(result);

    // 保存报告到文件
    const fs = require("fs");
    const reportPath = `reports/phoenix-benchmark-${new Date().toISOString().split("T")[0]}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`📄 报告已保存: ${reportPath}\n`);

    process.exit(result.summary.pass ? 0 : 1);
  } catch (error) {
    console.error("❌ 测试失败:", error);
    process.exit(1);
  }
}

main();
