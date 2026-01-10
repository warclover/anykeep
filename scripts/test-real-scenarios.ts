/**
 * 真实用户场景模拟测试
 * 测试意图分类器对各种真实用户表达的处理能力
 */

import { createIntentClassifier } from "../src/lib/ai-skills/router/intent-classifier";

async function testRealUserScenarios() {
  const classifier = createIntentClassifier({ debug: false });

  // 模拟真实用户的各种表达方式
  const realUserInputs = [
    // 口语化搜索
    "我之前存了一篇讲 Rust 的文章，帮我找找",
    "有个关于 Docker 的教程我忘了放哪了",
    "B站那个视频叫啥来着",

    // 隐含需求
    "收藏越来越多了",
    "感觉乱糟糟的",
    "书签好像有重复的",

    // 简短指令
    "整理下",
    "看看",
    "删了吧",
    "分类",

    // 复合表达
    "把微信的文章都整理到一个文件夹",
    "最近收藏的太多了需要分类一下",
    "帮我看看有没有重复然后清理掉",

    // 带情感的表达
    "好烦啊找不到那个网页了",
    "终于想起来要整理书签了",
    "能帮我统计下这个月收藏了多少吗",

    // 不完整的表达
    "AI相关的",
    "最近一周",
    "那个视频",

    // 英文混合
    "search React hooks",
    "export to markdown",
    "帮我 tag 一下这个",

    // 功能询问
    "你能帮我做什么",
    "怎么导出书签",
    "有没有自动分类功能",
  ];

  console.log("\n" + "=".repeat(70));
  console.log("  真实用户场景模拟测试");
  console.log("=".repeat(70) + "\n");

  const results: Array<{
    input: string;
    type: string;
    subType?: string;
    confidence: number;
  }> = [];

  for (const input of realUserInputs) {
    const result = await classifier.classify(input, {});
    results.push({
      input,
      type: result.type,
      subType: result.subType,
      confidence: result.confidence,
    });

    const conf = (result.confidence * 100).toFixed(0);
    const subType = result.subType ? ":" + result.subType : "";
    console.log(`[${result.type}${subType}] "${input}" (${conf}%)`);
  }

  // 按类型分组统计
  console.log("\n" + "=".repeat(70));
  console.log("  分类统计");
  console.log("=".repeat(70) + "\n");

  const typeStats: Record<string, number> = {};
  for (const r of results) {
    typeStats[r.type] = (typeStats[r.type] || 0) + 1;
  }

  for (const [type, count] of Object.entries(typeStats).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${type.padEnd(12)}: ${count}`);
  }

  // 低置信度预警
  const lowConfidence = results.filter((r) => r.confidence < 0.6);
  if (lowConfidence.length > 0) {
    console.log("\n" + "=".repeat(70));
    console.log("  低置信度预警 (<60%)");
    console.log("=".repeat(70) + "\n");

    for (const r of lowConfidence) {
      console.log(
        `  ⚠️ "${r.input}" → ${r.type}:${r.subType || "?"} (${(r.confidence * 100).toFixed(0)}%)`,
      );
    }
  }

  console.log("\n✅ 测试完成，共 " + results.length + " 个场景\n");
}

testRealUserScenarios().catch(console.error);
