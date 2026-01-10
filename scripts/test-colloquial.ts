// 测试口语化表达覆盖
import { createIntentSkillRouter } from "../src/lib/ai-skills/router/intent-skill-router";

const router = createIntentSkillRouter();

interface ColloquialTest {
  input: string;
  expected: string;
}

const colloquialTests: ColloquialTest[] = [
  // 搜索类
  { input: "帮我找找关于 React 的", expected: "query:search" },
  { input: "有没有什么编程相关的", expected: "query:search" },
  { input: "我想看看最近收藏的", expected: "query:list" },

  // 整理类
  { input: "有点乱，帮我收拾下", expected: "organize:cleanup" },
  { input: "太多了，帮我分类吧", expected: "organize:classify" },

  // 学习类
  { input: "抽空帮我复习下", expected: "learn:review" },
  { input: "看看我学了什么", expected: "query:mastery_stats" }, // 语义：查看学习进度

  // 操作类
  { input: "这个不要了", expected: "action:delete" },
  { input: "帮我加个科技标签", expected: "action:tag" },
  { input: "把这个移到学习文件夹", expected: "action:move" },

  // TTS 类
  { input: "念给我听", expected: "create:tts" },
  { input: "播放这个", expected: "create:tts" },

  // 分析类
  { input: "看看我这周收藏了啥", expected: "analyze:report" },
  { input: "有什么规律吗", expected: "analyze:insight" },
];

console.log("\n口语化表达覆盖测试\n" + "=".repeat(60));

let passed = 0;
let failed = 0;
const failures: Array<{
  input: string;
  expected: string;
  actual: string;
  confidence: number;
}> = [];

for (const test of colloquialTests) {
  const result = router.route(test.input);
  const actual = `${result.intentType}:${result.subType}`;

  if (actual === test.expected) {
    passed++;
  } else {
    failed++;
    failures.push({
      input: test.input,
      expected: test.expected,
      actual,
      confidence: result.confidence,
    });
  }
}

if (failures.length > 0) {
  console.log("\n❌ 失败的测试:");
  for (const f of failures) {
    console.log(`  "${f.input}"`);
    console.log(`    期望: ${f.expected}`);
    console.log(`    实际: ${f.actual} (置信度: ${f.confidence.toFixed(2)})`);
  }
}

console.log(`\n总结: 通过 ${passed}/${colloquialTests.length}, 失败 ${failed}`);
if (failed > 0) {
  console.log("需要添加口语化规则以提高覆盖率");
}
