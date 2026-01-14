/**
 * 更新口语化模式脚本
 *
 * 批量更新 intent-patterns.ts 中的口语化表达规则
 *
 * @usage npx tsx scripts/update-colloquial-patterns.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const filePath = join(
  __dirname,
  "../src/lib/ai-skills/config/intent-patterns.ts",
);

let content = readFileSync(filePath, "utf-8");

// 1. 更新 TTS 模式：添加 "播放" 独立匹配
content = content.replace(
  /pattern: "\(\?<!阅\|已\)读\|朗读\|播放\.{0,3}摘要\|听\|语音\|念\|tts"/,
  'pattern: "(?<!阅|已)读|朗读|播放|听一下|语音|念|tts"',
);

// 2. 更新删除模式：添加 "不要了"
content = content.replace(
  /pattern: "删除\|移除\|清除\|删掉"/,
  'pattern: "删除|移除|清除|删掉|不要了|不想要"',
);

// 3. 更新洞察模式：添加 "规律"
content = content.replace(
  /pattern: "分析\|洞察\|趋势\|数据分析"/,
  'pattern: "分析|洞察|趋势|数据分析|规律|特点"',
);

// 4. 更新报告模式：添加时间段表达
content = content.replace(
  /pattern: "周报\|月报\|报告\|总结报告"/,
  'pattern: "周报|月报|报告|总结报告|这周.{0,5}(收藏|添加)|本周.{0,5}(收藏|添加)|最近.{0,5}收藏了"',
);

// 5. 更新搜索模式：添加口语化搜索
content = content.replace(
  /pattern: "搜索\|搜\|找\|查\|检索"/,
  'pattern: "搜索|搜|找|查|检索|有没有.{0,10}(的|相关)|有什么.{0,10}(的|相关)"',
);

writeFileSync(filePath, content, "utf-8");

console.log("✅ 口语化模式更新完成！");
console.log("\n更新内容：");
console.log("1. TTS: 添加 '播放' 独立匹配, '听一下'");
console.log("2. 删除: 添加 '不要了', '不想要'");
console.log("3. 洞察: 添加 '规律', '特点'");
console.log("4. 报告: 添加 '这周收藏', '本周收藏', '最近收藏了'");
console.log("5. 搜索: 添加 '有没有...的', '有什么...相关'");
