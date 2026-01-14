/**
 * 修复口语化模式脚本
 *
 * 修复 TTS 和搜索模式
 *
 * @usage npx tsx scripts/fix-colloquial-patterns.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const filePath = join(
  __dirname,
  "../src/lib/ai-skills/config/intent-patterns.ts",
);

let content = readFileSync(filePath, "utf-8");

// 1. 修复 TTS 模式：将 "播放.{0,3}摘要" 改为 "播放"
// 需要匹配完整的 pattern 行并替换
content = content.replace(
  /pattern: "\(\?<!阅\|已\)读\|朗读\|播放\.{0,3}摘要\|听\|语音\|念\|tts"/g,
  'pattern: "(?<!阅|已)读|朗读|播放|听|语音|念|tts"',
);

// 2. 添加高优先级口语化搜索模式
// 在查询类开头添加专门匹配 "有没有什么...相关的" 的规则
const searchSectionMarker = `// ============================================
  // 查询类（权重 45-55）
  // ============================================`;

const colloquialSearchRule = `// ============================================
  // 查询类（权重 45-55）
  // ============================================
  {
    // P2 口语化搜索增强：高优先级匹配
    // "有没有什么编程相关的"、"有什么 Python 的"
    type: "query",
    subType: "search",
    pattern: "有没有.{0,15}(的|相关)|有什么.{0,15}(的|相关)",
    weight: 78,
    complexity: "simple",
    description: "口语化搜索",
  },`;

content = content.replace(searchSectionMarker, colloquialSearchRule);

writeFileSync(filePath, content, "utf-8");

console.log("✅ 口语化模式修复完成！");
console.log("\n修复内容：");
console.log("1. TTS: '播放.{0,3}摘要' → '播放'（匹配 '播放这个'）");
console.log(
  "2. 搜索: 添加高优先级口语化搜索规则（权重 78，高于 discover 的 75）",
);
