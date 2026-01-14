/**
 * 合并重复的搜索规则
 *
 * 将两个 query:search 规则合并为一个
 *
 * @usage npx tsx scripts/merge-search-rules.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const filePath = join(
  __dirname,
  "../src/lib/ai-skills/config/intent-patterns.ts",
);

const content = readFileSync(filePath, "utf-8");

// 查找并替换两个重复的搜索规则
const duplicatePattern = `  // ============================================
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
  },
  {
    type: "query",
    subType: "search",
    pattern: "搜索|搜|找|查|检索|有没有.{0,10}(的|相关)|有什么.{0,10}(的|相关)",
    weight: 55,
    complexity: "simple",
    description: "关键词搜索",
  },`;

const mergedPattern = `  // ============================================
  // 查询类（权重 45-78）
  // ============================================
  {
    // 搜索 + P2 口语化增强
    // "搜索 React"、"有没有什么编程相关的"、"有什么 Python 的"
    type: "query",
    subType: "search",
    pattern: "搜索|搜|找|查|检索|有没有.{0,15}(的|相关)|有什么.{0,15}(的|相关)",
    weight: 78,
    complexity: "simple",
    description: "关键词搜索",
  },`;

if (content.includes(duplicatePattern)) {
  const newContent = content.replace(duplicatePattern, mergedPattern);
  writeFileSync(filePath, newContent, "utf-8");
  console.log("✅ 搜索规则合并成功！");
  console.log("   两个 query:search 规则已合并为一个");
} else {
  console.log("⚠️ 未找到需要合并的重复规则");
  console.log("   可能已经合并或格式不匹配");
}
