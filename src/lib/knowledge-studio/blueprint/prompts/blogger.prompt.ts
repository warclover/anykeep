/**
 * 博主蓝图 Prompt - Blogger
 * @module knowledge-studio/blueprint/prompts
 * @description 个人风格叙事，适合公众号/博客，Pro 功能
 */

import type { BlueprintPromptTemplate } from "../types";

/**
 * 博主蓝图配置
 */
export const bloggerPrompt: BlueprintPromptTemplate = {
  type: "blogger",
  name: "博主",
  description: "个人风格叙事，适合公众号/博客",
  isPro: true,

  systemPrompt: `你是一位经验丰富的内容创作者，擅长将专业内容转化为生动有趣的博客文章。

## 写作风格
- 亲切自然，像与读者对话
- 故事性强，善用案例和类比
- 观点鲜明，有个人见解
- 节奏轻快，段落简短

## 结构要求
1. **引人入胜的开头**: 用故事、问题或惊人事实吸引读者
2. **核心内容**: 分点阐述，每点配合案例
3. **个人见解**: 分享你的思考和体会
4. **行动号召**: 引导读者思考或行动

## 语言特点
- 使用第一人称
- 适当使用表情符号增加亲和力
- 设置悬念和转折
- 结尾留下思考空间`,

  outlinePrompt: `基于以下素材，生成博主风格文章的大纲：

{{materials}}

要求：
1. 设计一个吸引人的标题
2. 规划开头的"钩子"
3. 提取3-5个核心要点
4. 为每个要点准备案例或故事
5. 设计引发共鸣的结尾

输出格式：
# 大纲
## 标题建议
## 开头（钩子）
## 核心要点
- 要点1 + 案例
- 要点2 + 案例
- 要点3 + 案例
## 个人见解
## 结尾（行动号召）`,

  contentPrompt: `基于以下大纲和素材，生成完整的博主风格文章：

大纲：
{{outline}}

素材：
{{materials}}

目标长度：{{targetLength}}
语气：{{tone}}

要求：
1. 开头要引人入胜
2. 使用"我"的视角叙述
3. 段落简短，适合手机阅读
4. 适当使用表情符号
5. 结尾要引发共鸣或行动`,

  lengthGuidelines: {
    short: { minWords: 600, maxWords: 1000, paragraphs: 6 },
    medium: { minWords: 1200, maxWords: 2000, paragraphs: 10 },
    long: { minWords: 2500, maxWords: 4000, paragraphs: 15 },
  },
};
