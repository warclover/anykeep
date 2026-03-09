/**
 * 真实用户模拟测试 v2
 *
 * 测试 AI 助手对各类真实用户表达的理解能力
 * 期望值已与系统类型体系对齐（type:subType 结构）
 *
 * @version 2.0.0
 * @since 2026-01-10
 */

import {
  createIntentClassifier,
  DEFAULT_RULES,
} from "../src/lib/ai-skills/router/intent-classifier";

// 定义测试场景
interface TestScenario {
  category: string;
  description: string;
  inputs: Array<{
    input: string;
    expectedType: string;
    expectedSubType?: string;
    acceptableSubTypes?: string[]; // 可接受的替代 subType
    note?: string;
  }>;
}

const scenarios: TestScenario[] = [
  {
    category: "日常口语",
    description: "用户随意、口语化的表达",
    inputs: [
      {
        input: "烦死了找不到那篇文章",
        expectedType: "query",
        expectedSubType: "search",
        note: "情绪化表达 → 搜索",
      },
      {
        input: "好久没整理了",
        expectedType: "query",
        expectedSubType: "list",
        note: "隐含查看意图",
      },
      {
        input: "收藏太乱了",
        expectedType: "organize",
        expectedSubType: "cleanup",
        note: "抱怨式 → 整理",
      },
      {
        input: "东西太多了",
        expectedType: "query",
        expectedSubType: "stats",
        note: "抱怨式 → 统计",
      },
      {
        input: "帮我看看",
        expectedType: "query",
        expectedSubType: "list",
        note: "模糊请求 → 列表",
      },
      {
        input: "有点多啊",
        expectedType: "query",
        expectedSubType: "stats",
        note: "口语化 → 统计",
      },
    ],
  },
  {
    category: "简短指令",
    description: "极简的命令式输入",
    inputs: [
      {
        input: "搜 React",
        expectedType: "query",
        expectedSubType: "search",
        note: "极简搜索",
      },
      {
        input: "整理",
        expectedType: "organize",
        expectedSubType: "cleanup",
        note: "单词整理",
      },
      {
        input: "删了",
        expectedType: "action",
        expectedSubType: "delete",
        note: "极简删除",
      },
      {
        input: "导出",
        expectedType: "create",
        expectedSubType: "export",
        note: "单词导出",
      },
      {
        input: "统计",
        expectedType: "query",
        acceptableSubTypes: ["stats", "count"],
        note: "单词统计",
      },
      {
        input: "标签",
        expectedType: "chitchat",
        expectedSubType: "help",
        note: "单字 → 询问帮助",
      },
    ],
  },
  {
    category: "功能询问",
    description: "用户询问能力和用法",
    inputs: [
      {
        input: "怎么导出",
        expectedType: "chitchat",
        expectedSubType: "help",
        note: "功能询问",
      },
      {
        input: "能自动分类吗",
        expectedType: "chitchat",
        expectedSubType: "help",
        note: "能力询问",
      },
      {
        input: "可以批量删除吗",
        expectedType: "chitchat",
        expectedSubType: "help",
        note: "功能确认",
      },
      {
        input: "支持搜索吗",
        expectedType: "chitchat",
        expectedSubType: "help",
        note: "功能确认",
      },
      {
        input: "有什么功能",
        expectedType: "chitchat",
        expectedSubType: "help",
        note: "功能列表",
      },
      {
        input: "怎么用",
        expectedType: "chitchat",
        expectedSubType: "help",
        note: "使用帮助",
      },
    ],
  },
  {
    category: "英文混合",
    description: "中英文混合输入",
    inputs: [
      {
        input: "export json",
        expectedType: "create",
        expectedSubType: "export",
        note: "纯英文导出",
      },
      {
        input: "find typescript",
        expectedType: "query",
        expectedSubType: "search",
        note: "英文搜索",
      },
      {
        input: "search AI",
        expectedType: "query",
        expectedSubType: "search",
        note: "英文搜索关键词",
      },
      {
        input: "delete bookmark",
        expectedType: "action",
        expectedSubType: "delete",
        note: "英文删除",
      },
      {
        input: "导出成 markdown",
        expectedType: "create",
        expectedSubType: "export",
        note: "混合导出",
      },
      {
        input: "搜索 machine learning",
        expectedType: "query",
        expectedSubType: "search",
        note: "混合搜索",
      },
    ],
  },
  {
    category: "指代表达",
    description: "包含指代词的表达",
    inputs: [
      {
        input: "把这些移到前端文件夹",
        expectedType: "action",
        acceptableSubTypes: ["move"],
        note: "指代+移动",
      },
      {
        input: "删掉第一个",
        expectedType: "action",
        expectedSubType: "delete",
        note: "序数指代",
      },
      {
        input: "那个收藏有问题",
        expectedType: "query",
        expectedSubType: "diagnose",
        note: "问题报告",
      },
      {
        input: "给它加个标签",
        expectedType: "action",
        expectedSubType: "tag",
        note: "代词指代",
      },
      {
        input: "把刚才的导出",
        expectedType: "create",
        expectedSubType: "export",
        note: "时间指代",
      },
      {
        input: "这些都删了",
        expectedType: "action",
        expectedSubType: "delete",
        note: "批量指代删除",
      },
    ],
  },
  {
    category: "复杂场景",
    description: "复杂多步骤请求",
    inputs: [
      {
        input: "统计下这个月收藏了多少",
        expectedType: "query",
        acceptableSubTypes: ["stats", "count"],
        note: "时间范围统计",
      },
      {
        input: "给我做个知识图谱",
        expectedType: "query",
        expectedSubType: "knowledge_graph",
        note: "高级分析",
      },
      {
        input: "把过期链接都找出来",
        expectedType: "organize",
        expectedSubType: "expire",
        note: "条件筛选",
      },
      {
        input: "整理一下然后导出",
        expectedType: "organize",
        expectedSubType: "cleanup_then_export",
        note: "多步骤",
      },
      {
        input: "分析我的阅读习惯",
        expectedType: "analyze",
        expectedSubType: "insight",
        note: "深度分析",
      },
    ],
  },
  {
    category: "边界情况",
    description: "容易误判的边界用例",
    inputs: [
      {
        input: "你好",
        expectedType: "chitchat",
        expectedSubType: "greeting",
        note: "问候语",
      },
      {
        input: "谢谢",
        expectedType: "chitchat",
        expectedSubType: "thanks",
        note: "礼貌用语",
      },
      {
        input: "哈哈",
        expectedType: "chitchat",
        expectedSubType: "general",
        note: "语气词",
      },
      {
        input: "嗯",
        expectedType: "chitchat",
        expectedSubType: "general",
        note: "回应词",
      },
      {
        input: "ok",
        expectedType: "chitchat",
        expectedSubType: "general",
        note: "确认词",
      },
      {
        input: "???",
        expectedType: "chitchat",
        acceptableSubTypes: ["general", "help"],
        note: "疑问符号",
      },
    ],
  },
  {
    category: "新增场景 - 收件箱分拣",
    description: "未分类书签整理相关",
    inputs: [
      {
        input: "整理收件箱",
        expectedType: "action",
        expectedSubType: "inbox_triage",
        note: "收件箱整理",
      },
      {
        input: "处理未分类的",
        expectedType: "organize",
        acceptableSubTypes: ["classify", "inbox_triage"],
        note: "未分类处理",
      },
      {
        input: "有多少没整理的",
        expectedType: "query",
        expectedSubType: "count",
        note: "数量询问",
      },
    ],
  },
  {
    category: "新增场景 - 文件夹推荐",
    description: "文件夹结构相关",
    inputs: [
      {
        input: "推荐文件夹结构",
        expectedType: "query",
        expectedSubType: "folder_recommend",
        note: "结构推荐",
      },
      {
        input: "文件夹该怎么组织",
        expectedType: "chitchat",
        expectedSubType: "help",
        note: "组织建议",
      },
      {
        input: "检查文件夹健康",
        expectedType: "analyze",
        expectedSubType: "folder_health_check",
        note: "健康检查",
      },
    ],
  },
];

// 运行测试
async function runSimulation() {
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("          真实用户模拟测试 v2 - AI 意图理解评估");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  const classifier = createIntentClassifier({
    rules: DEFAULT_RULES,
    debug: false,
  });

  let totalTests = 0;
  let passedTests = 0;
  const results: Array<{
    category: string;
    input: string;
    expected: string;
    actual: string;
    confidence: number;
    pass: boolean;
    note: string;
  }> = [];

  for (const scenario of scenarios) {
    console.log(`\n📂 ${scenario.category}`);
    console.log(`   ${scenario.description}`);
    console.log("─".repeat(60));

    for (const test of scenario.inputs) {
      totalTests++;
      const result = await classifier.classify(test.input);

      const expectedType = test.expectedType;
      const actualType = result.type;
      const actualSubType = result.subType;

      // 判断是否通过
      let pass = actualType === expectedType;
      if (pass) {
        if (test.expectedSubType) {
          pass = actualSubType === test.expectedSubType;
        }
        if (!pass && test.acceptableSubTypes) {
          pass = test.acceptableSubTypes.includes(actualSubType);
        }
      }

      if (pass) passedTests++;

      const icon = pass ? "✅" : "❌";
      const confidenceBar =
        "█".repeat(Math.round(result.confidence * 10)) +
        "░".repeat(10 - Math.round(result.confidence * 10));

      const expectedStr = test.expectedSubType
        ? `${expectedType}:${test.expectedSubType}`
        : test.acceptableSubTypes
          ? `${expectedType}:[${test.acceptableSubTypes.join("|")}]`
          : expectedType;

      console.log(`   ${icon} "${test.input}"`);
      console.log(`      期望: ${expectedStr}`);
      console.log(
        `      实际: ${actualType}:${actualSubType} [${confidenceBar}] ${(result.confidence * 100).toFixed(0)}%`,
      );
      if (test.note) {
        console.log(`      备注: ${test.note}`);
      }

      results.push({
        category: scenario.category,
        input: test.input,
        expected: expectedStr,
        actual: `${actualType}:${actualSubType}`,
        confidence: result.confidence,
        pass,
        note: test.note || "",
      });
    }
  }

  // 统计报告
  console.log(
    "\n═══════════════════════════════════════════════════════════════",
  );
  console.log("                         测试统计报告");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  console.log(`📊 总体通过率: ${passedTests}/${totalTests} (${passRate}%)\n`);

  // 按类别统计
  const categoryStats = new Map<string, { total: number; passed: number }>();
  for (const r of results) {
    const stats = categoryStats.get(r.category) || { total: 0, passed: 0 };
    stats.total++;
    if (r.pass) stats.passed++;
    categoryStats.set(r.category, stats);
  }

  console.log("📁 分类统计:");
  for (const [category, stats] of categoryStats) {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    const bar =
      "█".repeat(Math.round((stats.passed / stats.total) * 20)) +
      "░".repeat(20 - Math.round((stats.passed / stats.total) * 20));
    console.log(
      `   ${category}: ${stats.passed}/${stats.total} [${bar}] ${rate}%`,
    );
  }

  // 失败用例详情
  const failed = results.filter((r) => !r.pass);
  if (failed.length > 0) {
    console.log("\n❌ 失败用例详情:");
    for (const f of failed) {
      console.log(`   - "${f.input}" (${f.category})`);
      console.log(`     期望: ${f.expected}, 实际: ${f.actual}`);
      if (f.note) console.log(`     备注: ${f.note}`);
    }
  }

  // 低置信度用例
  const lowConfidence = results.filter((r) => r.pass && r.confidence < 0.7);
  if (lowConfidence.length > 0) {
    console.log("\n⚠️ 低置信度用例 (通过但 <70%):");
    for (const lc of lowConfidence) {
      console.log(
        `   - "${lc.input}" → ${lc.actual} (${(lc.confidence * 100).toFixed(0)}%)`,
      );
    }
  }

  console.log(
    "\n═══════════════════════════════════════════════════════════════",
  );

  return { passRate: parseFloat(passRate), failed, lowConfidence };
}

// 主函数
runSimulation()
  .then(({ passRate, failed }) => {
    if (passRate >= 80) {
      console.log(`\n🎉 测试通过！整体通过率 ${passRate}% 达到预期目标 (≥80%)`);
      process.exit(0);
    } else {
      console.log(`\n⚠️ 测试未达标！整体通过率 ${passRate}% 低于目标 80%`);
      console.log(`   需要修复 ${failed.length} 个失败用例`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error("测试运行失败:", error);
    process.exit(1);
  });
