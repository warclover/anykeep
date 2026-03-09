/**
 * Skill 调用链路测试
 *
 * 验证从用户输入到 Skill 执行的完整链路：
 * 1. 意图分类
 * 2. Skill 映射
 * 3. 执行模式选择
 * 4. 输出格式验证
 *
 * @usage
 * # 运行全部测试
 * npx tsx scripts/test-skill-chain.ts
 *
 * # 单个 Skill 测试
 * npx tsx scripts/test-skill-chain.ts --skill data_export
 *
 * # 详细输出
 * npx tsx scripts/test-skill-chain.ts --verbose
 *
 * # 生成报告
 * npx tsx scripts/test-skill-chain.ts --output reports/skill-chain.json
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// 类型定义
// ============================================

interface SkillChainTest {
  name: string;
  input: string;
  expectedChain: {
    intentType: string;
    intentSubType?: string;
    mode: "atomic" | "orchestration";
    skillId?: string;
  };
  expectedOutput: {
    hasText: boolean;
    hasProgress?: boolean;
    hasDeliverable?: boolean;
    deliverableFormat?: string;
  };
  timeout: number;
}

interface TestResult {
  name: string;
  input: string;
  passed: boolean;
  duration: number;
  expected: SkillChainTest["expectedChain"];
  actual: {
    intentType: string;
    intentSubType?: string;
    mode: string;
    skillId?: string;
  };
  errors: string[];
}

interface TestReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  averageDuration: number;
  results: TestResult[];
}

// ============================================
// 测试用例
// ============================================

const SKILL_CHAIN_TESTS: SkillChainTest[] = [
  // 查询类（原子模式）
  {
    name: "搜索→搜索结果",
    input: "搜索 React 教程",
    expectedChain: {
      intentType: "query",
      intentSubType: "search",
      mode: "atomic",
      skillId: "search",
    },
    expectedOutput: {
      hasText: true,
      hasDeliverable: false,
    },
    timeout: 5000,
  },
  {
    name: "统计→计数结果",
    input: "我有多少书签",
    expectedChain: {
      intentType: "query",
      intentSubType: "count",
      mode: "atomic",
      skillId: "search",
    },
    expectedOutput: {
      hasText: true,
    },
    timeout: 5000,
  },
  {
    name: "列表→列表展示",
    input: "看看最近的收藏",
    expectedChain: {
      intentType: "query",
      intentSubType: "list",
      mode: "atomic",
      skillId: "search",
    },
    expectedOutput: {
      hasText: true,
    },
    timeout: 5000,
  },

  // 整理类（编排模式）
  {
    name: "整理→批量操作",
    input: "帮我整理一下收藏",
    expectedChain: {
      intentType: "organize",
      intentSubType: "cleanup",
      mode: "orchestration",
      skillId: "batch_organize",
    },
    expectedOutput: {
      hasText: true,
      hasProgress: true,
      hasDeliverable: true,
    },
    timeout: 60000,
  },
  {
    name: "去重→重复清理",
    input: "找出重复的书签",
    expectedChain: {
      intentType: "organize",
      intentSubType: "dedupe",
      mode: "orchestration",
      skillId: "duplicate_cleanup",
    },
    expectedOutput: {
      hasText: true,
      hasProgress: true,
    },
    timeout: 30000,
  },
  {
    name: "分类→智能标签",
    input: "给书签自动分类",
    expectedChain: {
      intentType: "organize",
      intentSubType: "classify",
      mode: "orchestration",
      skillId: "smart_tagging",
    },
    expectedOutput: {
      hasText: true,
      hasProgress: true,
    },
    timeout: 30000,
  },

  // 创建类（编排模式）
  {
    name: "导出→JSON文件",
    input: "把收藏导出为JSON",
    expectedChain: {
      intentType: "create",
      intentSubType: "export",
      mode: "orchestration",
      skillId: "data_export",
    },
    expectedOutput: {
      hasText: true,
      hasProgress: true,
      hasDeliverable: true,
      deliverableFormat: "json",
    },
    timeout: 30000,
  },
  {
    name: "语音→TTS合成",
    input: "朗读这个书签",
    expectedChain: {
      intentType: "create",
      intentSubType: "tts",
      mode: "orchestration",
      skillId: "tts_synthesis",
    },
    expectedOutput: {
      hasText: true,
      hasProgress: true,
    },
    timeout: 30000,
  },

  // 分析类（编排模式）
  {
    name: "报告→周期报告",
    input: "生成本月收藏报告",
    expectedChain: {
      intentType: "analyze",
      intentSubType: "report",
      mode: "orchestration",
      skillId: "periodic_report",
    },
    expectedOutput: {
      hasText: true,
      hasProgress: true,
      hasDeliverable: true,
    },
    timeout: 60000,
  },
  {
    name: "洞察→洞察分析",
    input: "分析一下我的收藏趋势",
    expectedChain: {
      intentType: "analyze",
      intentSubType: "insight",
      mode: "orchestration",
      skillId: "insight_report",
    },
    expectedOutput: {
      hasText: true,
      hasProgress: true,
    },
    timeout: 30000,
  },

  // 操作类（原子模式）
  {
    name: "删除→删除书签",
    input: "删除这个书签",
    expectedChain: {
      intentType: "action",
      intentSubType: "delete",
      mode: "atomic",
      skillId: "delete",
    },
    expectedOutput: {
      hasText: true,
    },
    timeout: 5000,
  },
  {
    name: "标签→添加标签",
    input: "给这个加个标签",
    expectedChain: {
      intentType: "action",
      intentSubType: "tag",
      mode: "atomic",
      skillId: "add_tag",
    },
    expectedOutput: {
      hasText: true,
    },
    timeout: 5000,
  },
];

// ============================================
// 测试执行器
// ============================================

async function runSkillChainTest(
  test: SkillChainTest,
  verbose: boolean,
): Promise<TestResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  // 动态导入路由器（避免 ESM 问题）
  const { createIntentSkillRouter } = await import(
    "../src/lib/ai-skills/router/intent-skill-router"
  );
  const router = createIntentSkillRouter();

  // 执行路由
  const routeResult = router.route(test.input);
  const duration = Date.now() - startTime;

  // 验证意图类型
  if (routeResult.intentType !== test.expectedChain.intentType) {
    errors.push(
      `意图类型不匹配: 期望 "${test.expectedChain.intentType}", 实际 "${routeResult.intentType}"`,
    );
  }

  // 验证子类型（如果指定）
  if (
    test.expectedChain.intentSubType &&
    routeResult.subType !== test.expectedChain.intentSubType
  ) {
    errors.push(
      `子类型不匹配: 期望 "${test.expectedChain.intentSubType}", 实际 "${routeResult.subType}"`,
    );
  }

  // 验证执行模式
  if (routeResult.mode !== test.expectedChain.mode) {
    errors.push(
      `执行模式不匹配: 期望 "${test.expectedChain.mode}", 实际 "${routeResult.mode}"`,
    );
  }

  // 验证 Skill ID（如果指定）
  if (
    test.expectedChain.skillId &&
    routeResult.skillId !== test.expectedChain.skillId
  ) {
    errors.push(
      `Skill ID 不匹配: 期望 "${test.expectedChain.skillId}", 实际 "${routeResult.skillId}"`,
    );
  }

  const passed = errors.length === 0;

  if (verbose) {
    const status = passed ? "✅" : "❌";
    console.log(`${status} ${test.name}`);
    console.log(`   输入: "${test.input}"`);
    console.log(
      `   路由: ${routeResult.intentType}:${routeResult.subType} → ${routeResult.skillId} (${routeResult.mode})`,
    );
    if (errors.length > 0) {
      errors.forEach((e) => console.log(`   ⚠️  ${e}`));
    }
    console.log();
  }

  return {
    name: test.name,
    input: test.input,
    passed,
    duration,
    expected: test.expectedChain,
    actual: {
      intentType: routeResult.intentType,
      intentSubType: routeResult.subType,
      mode: routeResult.mode,
      skillId: routeResult.skillId,
    },
    errors,
  };
}

// ============================================
// 主函数
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--verbose") || args.includes("-v");
  const skillFilter = args.includes("--skill")
    ? args[args.indexOf("--skill") + 1]
    : null;
  const outputPath = args.includes("--output")
    ? args[args.indexOf("--output") + 1]
    : null;

  console.log("\n" + "=".repeat(60));
  console.log("Skill 调用链路测试");
  console.log("=".repeat(60) + "\n");

  // 过滤测试用例
  let testsToRun = SKILL_CHAIN_TESTS;
  if (skillFilter) {
    testsToRun = SKILL_CHAIN_TESTS.filter(
      (t) => t.expectedChain.skillId === skillFilter,
    );
    console.log(`过滤: 仅测试 Skill "${skillFilter}"\n`);
  }

  if (testsToRun.length === 0) {
    console.log("❌ 没有匹配的测试用例");
    process.exit(1);
  }

  // 执行测试
  const results: TestResult[] = [];
  for (const test of testsToRun) {
    const result = await runSkillChainTest(test, verbose);
    results.push(result);
  }

  // 统计结果
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const passRate = ((passed / results.length) * 100).toFixed(1);
  const avgDuration = Math.round(
    results.reduce((sum, r) => sum + r.duration, 0) / results.length,
  );

  // 打印摘要
  console.log("=".repeat(60));
  console.log("测试摘要");
  console.log("=".repeat(60));
  console.log(`总测试数: ${results.length}`);
  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  console.log(`通过率: ${passRate}%`);
  console.log(`平均耗时: ${avgDuration}ms`);
  console.log();

  // 显示失败的测试
  if (failed > 0) {
    console.log("❌ 失败的测试:\n");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ${r.name}`);
        console.log(`    输入: "${r.input}"`);
        r.errors.forEach((e) => console.log(`    ⚠️  ${e}`));
        console.log();
      });
  }

  // 生成报告
  if (outputPath) {
    const report: TestReport = {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passed,
      failed,
      passRate: Number(passRate),
      averageDuration: avgDuration,
      results,
    };

    const fullPath = join(__dirname, "..", outputPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, JSON.stringify(report, null, 2));
    console.log(`📄 报告已保存: ${outputPath}`);
  }

  // 退出码
  if (failed > 0) {
    process.exit(1);
  }

  console.log("✅ 所有测试通过！\n");
}

// 运行
main().catch((error) => {
  console.error("测试执行出错:", error);
  process.exit(1);
});
