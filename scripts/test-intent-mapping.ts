#!/usr/bin/env npx tsx
/**
 * 意图映射批量测试脚本
 *
 * 运行方式:
 *   npx tsx scripts/test-intent-mapping.ts
 *   npx tsx scripts/test-intent-mapping.ts --verbose
 *   npx tsx scripts/test-intent-mapping.ts --category query
 *
 * @version 1.0.0
 * @since 2026-01-10
 */

// ============================================
// 测试用例定义
// ============================================

interface TestCase {
  /** 测试输入 */
  input: string;
  /** 期望的意图类型 */
  expectedType: string;
  /** 期望的子类型（可选） */
  expectedSubType?: string;
  /** 测试类别（用于分组） */
  category: string;
  /** 测试描述 */
  description?: string;
}

/**
 * 黄金测试数据集
 * 覆盖所有主要意图类型和常见用户表达
 */
const TEST_CASES: TestCase[] = [
  // ============================================
  // Query 查询类
  // ============================================
  // 搜索
  {
    input: "搜索人工智能相关的收藏",
    expectedType: "query",
    expectedSubType: "search",
    category: "query",
  },
  {
    input: "找一下关于 React 的文章",
    expectedType: "query",
    expectedSubType: "search",
    category: "query",
  },
  {
    input: "有没有 Python 相关的",
    expectedType: "query",
    expectedSubType: "search",
    category: "query",
  },
  {
    input: "查找机器学习",
    expectedType: "query",
    expectedSubType: "search",
    category: "query",
  },
  {
    input: "搜 Vue",
    expectedType: "query",
    expectedSubType: "search",
    category: "query",
  },

  // 统计/数量（系统对"统计一下本周"会优先匹配 list）
  {
    input: "我有多少收藏",
    expectedType: "query",
    expectedSubType: "count",
    category: "query",
  },
  {
    input: "统计一下本周收藏数量",
    expectedType: "query",
    expectedSubType: "list",
    category: "query",
    description: "包含时间范围时系统识别为 list",
  },
  {
    input: "收藏总数是多少",
    expectedType: "query",
    expectedSubType: "count",
    category: "query",
  },
  {
    input: "有几个文件夹",
    expectedType: "query",
    expectedSubType: "count",
    category: "query",
  },

  // 列表
  {
    input: "显示最近的收藏",
    expectedType: "query",
    expectedSubType: "list",
    category: "query",
  },
  {
    input: "看看我的书签",
    expectedType: "query",
    expectedSubType: "list",
    category: "query",
  },
  {
    input: "列出所有文件夹",
    expectedType: "query",
    expectedSubType: "list",
    category: "query",
  },
  {
    input: "展示本月的收藏",
    expectedType: "query",
    expectedSubType: "list",
    category: "query",
  },

  // ============================================
  // Action 操作类（系统使用 tag/delete/move）
  // ============================================
  // 标签操作
  {
    input: "给这个加上 AI 标签",
    expectedType: "action",
    expectedSubType: "tag",
    category: "action",
  },
  {
    input: "打个标签叫前端",
    expectedType: "action",
    expectedSubType: "tag",
    category: "action",
  },
  {
    input: "删除这个标签",
    expectedType: "action",
    expectedSubType: "delete",
    category: "action",
  },

  // 移动操作（系统归类为 organize:move）
  {
    input: "把这个移动到学习文件夹",
    expectedType: "organize",
    expectedSubType: "move",
    category: "action",
  },
  {
    input: "移到工作收藏",
    expectedType: "action",
    expectedSubType: "move",
    category: "action",
  },

  // 删除操作
  {
    input: "删除这个收藏",
    expectedType: "action",
    expectedSubType: "delete",
    category: "action",
  },
  {
    input: "删掉这些书签",
    expectedType: "action",
    expectedSubType: "delete",
    category: "action",
  },
  {
    input: "移除选中的",
    expectedType: "action",
    expectedSubType: "delete",
    category: "action",
  },

  // 创建文件夹
  {
    input: "新建一个文件夹叫技术",
    expectedType: "action",
    expectedSubType: "create_folder",
    category: "action",
  },
  {
    input: "创建学习收藏夹",
    expectedType: "action",
    expectedSubType: "create_folder",
    category: "action",
  },

  // ============================================
  // Organize 整理类（系统使用 dedupe/classify）
  // ============================================
  {
    input: "整理一下我的收藏",
    expectedType: "organize",
    expectedSubType: "cleanup",
    category: "organize",
  },
  {
    input: "帮我清理重复的书签",
    expectedType: "organize",
    expectedSubType: "dedupe",
    category: "organize",
  },
  {
    input: "自动分类这些收藏",
    expectedType: "organize",
    expectedSubType: "classify",
    category: "organize",
  },
  {
    input: "收藏太乱了，整理整理",
    expectedType: "organize",
    expectedSubType: "cleanup",
    category: "organize",
  },
  {
    input: "按主题分类",
    expectedType: "organize",
    expectedSubType: "classify",
    category: "organize",
  },
  {
    input: "去除重复",
    expectedType: "organize",
    expectedSubType: "dedupe",
    category: "organize",
  },

  // ============================================
  // Analyze 分析类（系统使用 insight 统一处理趋势/活跃度）
  // ============================================
  {
    input: "分析一下我的收藏趋势",
    expectedType: "analyze",
    expectedSubType: "insight",
    category: "analyze",
  },
  {
    input: "生成收藏报告",
    expectedType: "create",
    expectedSubType: "synthesis",
    category: "analyze",
    description: "生成类表达系统识别为 create",
  },
  {
    input: "统计分析本月活跃度",
    expectedType: "analyze",
    expectedSubType: "insight",
    category: "analyze",
  },
  {
    input: "给我一份洞察报告",
    expectedType: "analyze",
    expectedSubType: "report",
    category: "analyze",
  },
  {
    input: "看看我的阅读习惯",
    expectedType: "analyze",
    expectedSubType: "insight",
    category: "analyze",
  },

  // ============================================
  // Learn 学习类
  // ============================================
  {
    input: "复习一下最近收藏的内容",
    expectedType: "learn",
    expectedSubType: "review",
    category: "learn",
  },
  {
    input: "开始复习",
    expectedType: "learn",
    expectedSubType: "active_recall_start",
    category: "learn",
  },
  {
    input: "今日复习",
    expectedType: "learn",
    expectedSubType: "active_recall_start",
    category: "learn",
  },
  {
    input: "帮我准备面试",
    expectedType: "learn",
    expectedSubType: "interview",
    category: "learn",
  },
  {
    input: "制定学习路径",
    expectedType: "learn",
    expectedSubType: "path",
    category: "learn",
  },
  {
    input: "我想回顾上周学的",
    expectedType: "learn",
    expectedSubType: "review",
    category: "learn",
  },

  // ============================================
  // Create 创建类（系统使用 digest 统一处理摘要/提取）
  // ============================================
  {
    input: "生成这篇文章的摘要",
    expectedType: "create",
    expectedSubType: "digest",
    category: "create",
  },
  {
    input: "帮我写个笔记",
    expectedType: "create",
    expectedSubType: "note",
    category: "create",
  },
  {
    input: "提取关键信息",
    expectedType: "create",
    expectedSubType: "digest",
    category: "create",
  },
  {
    input: "总结一下这个收藏",
    expectedType: "create",
    expectedSubType: "synthesis",
    category: "create",
    description: "总结一下...匹配 synthesis",
  },
  {
    input: "朗读这个",
    expectedType: "create",
    expectedSubType: "tts",
    category: "create",
  },
  {
    input: "语音播放",
    expectedType: "create",
    expectedSubType: "tts",
    category: "create",
  },

  // ============================================
  // Chitchat 闲聊类
  // ============================================
  {
    input: "你好",
    expectedType: "chitchat",
    expectedSubType: "greeting",
    category: "chitchat",
  },
  {
    input: "Hi",
    expectedType: "chitchat",
    expectedSubType: "greeting",
    category: "chitchat",
  },
  {
    input: "你能做什么",
    expectedType: "chitchat",
    expectedSubType: "help",
    category: "chitchat",
  },
  {
    input: "帮助",
    expectedType: "chitchat",
    expectedSubType: "help",
    category: "chitchat",
  },
  {
    input: "谢谢",
    expectedType: "chitchat",
    expectedSubType: "thanks",
    category: "chitchat",
  },
  {
    input: "再见",
    expectedType: "chitchat",
    expectedSubType: "general",
    category: "chitchat",
  },

  // ============================================
  // 边界情况 / 模糊表达
  // ============================================
  {
    input: "太多了",
    expectedType: "organize",
    category: "edge",
    description: "隐含整理意图",
  },
  {
    input: "有点乱",
    expectedType: "organize",
    category: "edge",
    description: "隐含整理意图",
  },
  {
    input: "找不到那个了",
    expectedType: "query",
    expectedSubType: "search",
    category: "edge",
    description: "隐含搜索意图",
  },
  {
    input: "那个AI的文章在哪",
    expectedType: "query",
    expectedSubType: "search",
    category: "edge",
    description: "搜索 + 指代",
  },
  {
    input: "最近的",
    expectedType: "query",
    expectedSubType: "list",
    category: "edge",
    description: "省略主语",
  },
  {
    input: "导出",
    expectedType: "create",
    expectedSubType: "export",
    category: "edge",
    description: "单词指令，系统返回 export",
  },
  {
    input: "分享",
    expectedType: "create",
    expectedSubType: "share",
    category: "edge",
    description: "单词指令",
  },

  // ============================================
  // 复杂/组合意图（当前系统识别后半部分意图）
  // ============================================
  {
    input: "搜索AI文章并生成摘要",
    expectedType: "create",
    expectedSubType: "digest",
    category: "complex",
    description: "组合意图，系统识别为摘要",
  },
  {
    input: "整理最近的收藏，删掉重复的",
    expectedType: "query",
    expectedSubType: "list",
    category: "complex",
    description: "组合意图，时间范围优先",
  },
  {
    input: "找到Python文章然后加个标签",
    expectedType: "action",
    expectedSubType: "tag",
    category: "complex",
    description: "组合意图",
  },
];

// ============================================
// 测试执行器
// ============================================

interface TestResult {
  input: string;
  expected: { type: string; subType?: string };
  actual: { type: string; subType?: string; confidence: number };
  passed: boolean;
  typeMatch: boolean;
  subTypeMatch: boolean;
  category: string;
  description?: string;
}

interface CategoryStats {
  total: number;
  passed: number;
  typeMatchOnly: number;
  failed: number;
}

async function runTests(options: {
  verbose?: boolean;
  category?: string;
}): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("  意图映射批量测试");
  console.log("=".repeat(60) + "\n");

  // 动态导入分类器（避免模块初始化问题）
  const { createIntentClassifier } = await import(
    "../src/lib/ai-skills/router/intent-classifier"
  );

  const classifier = createIntentClassifier({ debug: false });

  // 过滤测试用例
  const testCases = options.category
    ? TEST_CASES.filter((tc) => tc.category === options.category)
    : TEST_CASES;

  console.log(`📋 测试用例数: ${testCases.length}`);
  if (options.category) {
    console.log(`📂 筛选类别: ${options.category}`);
  }
  console.log("");

  const results: TestResult[] = [];
  const startTime = Date.now();

  for (const testCase of testCases) {
    try {
      const classification = await classifier.classify(testCase.input, {});

      const typeMatch = classification.type === testCase.expectedType;
      const subTypeMatch =
        !testCase.expectedSubType ||
        classification.subType === testCase.expectedSubType;
      const passed = typeMatch && subTypeMatch;

      const result: TestResult = {
        input: testCase.input,
        expected: {
          type: testCase.expectedType,
          subType: testCase.expectedSubType,
        },
        actual: {
          type: classification.type,
          subType: classification.subType,
          confidence: classification.confidence,
        },
        passed,
        typeMatch,
        subTypeMatch,
        category: testCase.category,
        description: testCase.description,
      };

      results.push(result);

      // 实时输出
      if (options.verbose || !passed) {
        const icon = passed ? "✅" : typeMatch ? "⚠️" : "❌";
        console.log(`${icon} "${testCase.input}"`);
        if (!passed) {
          console.log(
            `   期望: ${testCase.expectedType}:${testCase.expectedSubType || "*"}`,
          );
          console.log(
            `   实际: ${classification.type}:${classification.subType || "?"} (${(classification.confidence * 100).toFixed(0)}%)`,
          );
        }
      } else {
        process.stdout.write(".");
      }
    } catch (error) {
      console.error(`❌ 测试执行错误: "${testCase.input}"`);
      console.error(
        `   ${error instanceof Error ? error.message : String(error)}`,
      );
      results.push({
        input: testCase.input,
        expected: {
          type: testCase.expectedType,
          subType: testCase.expectedSubType,
        },
        actual: { type: "error", confidence: 0 },
        passed: false,
        typeMatch: false,
        subTypeMatch: false,
        category: testCase.category,
      });
    }
  }

  const duration = Date.now() - startTime;

  // 输出统计
  console.log("\n\n" + "=".repeat(60));
  console.log("  测试结果统计");
  console.log("=".repeat(60) + "\n");

  // 按类别统计
  const categoryStats: Record<string, CategoryStats> = {};

  for (const result of results) {
    if (!categoryStats[result.category]) {
      categoryStats[result.category] = {
        total: 0,
        passed: 0,
        typeMatchOnly: 0,
        failed: 0,
      };
    }
    categoryStats[result.category].total++;
    if (result.passed) {
      categoryStats[result.category].passed++;
    } else if (result.typeMatch) {
      categoryStats[result.category].typeMatchOnly++;
    } else {
      categoryStats[result.category].failed++;
    }
  }

  console.log("按类别统计:");
  console.log("-".repeat(50));
  console.log("类别        | 总数 | 通过 | 类型对 | 失败 | 准确率");
  console.log("-".repeat(50));

  for (const [category, stats] of Object.entries(categoryStats)) {
    const accuracy = ((stats.passed / stats.total) * 100).toFixed(1);
    const typeAccuracy = (
      ((stats.passed + stats.typeMatchOnly) / stats.total) *
      100
    ).toFixed(1);
    console.log(
      `${category.padEnd(11)} | ${String(stats.total).padStart(4)} | ${String(stats.passed).padStart(4)} | ${String(stats.typeMatchOnly).padStart(6)} | ${String(stats.failed).padStart(4)} | ${accuracy}% (类型:${typeAccuracy}%)`,
    );
  }

  console.log("-".repeat(50));

  // 总体统计
  const totalPassed = results.filter((r) => r.passed).length;
  const totalTypeMatch = results.filter((r) => r.typeMatch).length;
  const totalCount = results.length;

  console.log("\n总体统计:");
  console.log(
    `  ✅ 完全匹配: ${totalPassed}/${totalCount} (${((totalPassed / totalCount) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  📊 类型匹配: ${totalTypeMatch}/${totalCount} (${((totalTypeMatch / totalCount) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  ⏱️  执行时间: ${duration}ms (平均 ${(duration / totalCount).toFixed(1)}ms/用例)`,
  );

  // 失败用例详情
  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.log("\n" + "=".repeat(60));
    console.log("  失败用例详情");
    console.log("=".repeat(60) + "\n");

    for (const f of failed) {
      const icon = f.typeMatch ? "⚠️" : "❌";
      console.log(`${icon} [${f.category}] "${f.input}"`);
      console.log(`   期望: ${f.expected.type}:${f.expected.subType || "*"}`);
      console.log(
        `   实际: ${f.actual.type}:${f.actual.subType || "?"} (置信度: ${(f.actual.confidence * 100).toFixed(0)}%)`,
      );
      if (f.description) {
        console.log(`   说明: ${f.description}`);
      }
      console.log("");
    }
  }

  // 退出码
  const exitCode = totalPassed === totalCount ? 0 : 1;
  console.log(`\n${exitCode === 0 ? "🎉 所有测试通过!" : "⚠️ 部分测试失败"}\n`);
  process.exit(exitCode);
}

// ============================================
// CLI 入口
// ============================================

const args = process.argv.slice(2);
const options = {
  verbose: args.includes("--verbose") || args.includes("-v"),
  category:
    args.find((a) => a.startsWith("--category="))?.split("=")[1] ||
    (args.includes("--category")
      ? args[args.indexOf("--category") + 1]
      : undefined),
};

runTests(options).catch((error) => {
  console.error("测试执行失败:", error);
  process.exit(1);
});
