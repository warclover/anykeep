/**
 * 推文蓝图 Prompt - Thread
 * @module knowledge-studio/blueprint/prompts
 * @description 社交媒体推文串，适合 Twitter/X 风格，Pro 功能
 */

import type { BlueprintPromptTemplate } from "../types";

/**
 * 推文蓝图配置
 */
export const threadPrompt: BlueprintPromptTemplate = {
  type: "thread",
  name: "推文串",
  description: "社交媒体推文，Twitter/X 风格",
  isPro: true,

  systemPrompt: `你是一位社交媒体内容专家，擅长创作病毒式传播的推文串。

## 写作风格
- 每条推文简洁有力（中文 140 字以内）
- 第一条必须"钩子"极强
- 使用表情符号增强视觉效果
- 信息密度高，每条都有价值

## 结构要求
1. **钩子推文**: 抛出惊人事实或问题
2. **背景铺垫**: 1-2 条建立上下文
3. **核心内容**: 3-7 条逐点展开
4. **金句总结**: 1 条可转发的金句
5. **互动结尾**: 引导转发和讨论

## 格式规范
- 使用 1/, 2/, 3/ 编号
- 每条推文之间空一行
- 适当使用 🧵 📌 💡 🔥 等表情
- 最后一条带 #话题标签`,

  outlinePrompt: `基于以下素材，生成推文串的大纲：

{{materials}}

要求：
1. 设计一个超强的"钩子"开头
2. 规划 8-15 条推文的结构
3. 每条推文的核心信息点
4. 设计可转发的金句
5. 准备 2-3 个相关话题标签

输出格式：
# 推文串大纲
## 钩子（第1条）
## 背景（第2-3条）
## 核心内容（第4-10条）
- 推文4: [信息点]
- 推文5: [信息点]
...
## 金句（倒数第2条）
## 互动结尾（最后1条）
## 话题标签`,

  contentPrompt: `基于以下大纲和素材，生成完整的推文串：

大纲：
{{outline}}

素材：
{{materials}}

目标长度：{{targetLength}}

要求：
1. 每条推文不超过 140 个中文字符
2. 使用 1/, 2/, 3/ 编号
3. 第一条必须极具吸引力
4. 适当使用表情符号
5. 最后带话题标签`,

  lengthGuidelines: {
    short: { minWords: 400, maxWords: 800, paragraphs: 8 },
    medium: { minWords: 800, maxWords: 1500, paragraphs: 12 },
    long: { minWords: 1500, maxWords: 2500, paragraphs: 18 },
  },
};
