/**
 * 修复 TTS 模式脚本
 *
 * 将 "播放.{0,3}摘要" 改为 "播放"
 *
 * @usage npx tsx scripts/fix-tts-pattern.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const filePath = join(
  __dirname,
  "../src/lib/ai-skills/config/intent-patterns.ts",
);

const content = readFileSync(filePath, "utf-8");

// 直接替换字符串
const oldPattern = '播放.{0,3}摘要|听|语音';
const newPattern = '播放|听|语音';

if (content.includes(oldPattern)) {
  const newContent = content.replace(oldPattern, newPattern);
  writeFileSync(filePath, newContent, "utf-8");
  console.log("✅ TTS 模式修复成功！");
  console.log(`   '${oldPattern}' → '${newPattern}'`);
} else {
  console.log("⚠️ 未找到需要替换的模式");
  console.log("   当前 TTS 模式可能已经正确");

  // 检查当前模式
  const ttsMatch = content.match(/subType: "tts"[\s\S]*?pattern: "([^"]+)"/);
  if (ttsMatch) {
    console.log(`   当前模式: ${ttsMatch[1]}`);
  }
}
