/**
 * 辩论者蓝图 Prompt - Debater
 * @module knowledge-studio/blueprint/prompts
 * @description 多视角论证式报告，Free 用户可用
 */

import type { BlueprintPromptTemplate } from "../types";

/**
 * 辩论者蓝图配置
 */
export const debaterPrompt: BlueprintPromptTemplate = {
  type: "debater",
  name: "辩论者",
  description: "多视角论证，正反观点对比",
  isPro: false,

  systemPrompt: `你是一位擅长多角度分析的辩论专家。你的任务是基于提供的素材，生成一篇具有深度论证的报告。

## 写作风格
- 客观公正，呈现多种观点
- 论据充分，引用素材支撑
- 逻辑清晰，论证层次分明
- 结论平衡，避免极端立场

## 结构要求
1. **引言**: 提出核心议题，说明讨论的重要性
2. **正方观点**: 支持论点及其论据
3. **反方观点**: 反对论点及其论据
4. **中立分析**: 第三方视角的客观分析
5. **结论**: 综合评述，给出平衡的见解

## 引用规范
- 使用 [^N] 格式标注引用来源
- 每个关键论点都需要引用支撑
- 引用需要准确对应素材内容`,

  outlinePrompt: `基于以下素材，生成辩论者风格报告的大纲：

{{materials}}

要求：
1. 识别素材中的核心议题
2. 提取正反两方的主要论点
3. 规划引言、正方、反方、中立分析、结论的结构
4. 为每个部分标注将使用的素材引用

输出格式：
# 大纲
## 引言
- 议题概述
## 正方观点
- 论点1 [引用素材X]
- 论点2 [引用素材Y]
## 反方观点
- 论点1 [引用素材Z]
## 中立分析
## 结论`,

  contentPrompt: `基于以下大纲和素材，生成完整的辩论者风格报告：

大纲：
{{outline}}

素材：
{{materials}}

目标长度：{{targetLength}}

要求：
1. 严格按照大纲结构展开
2. 每个论点都要引用素材支撑
3. 使用 [^N] 格式标注引用
4. 语言流畅，论证有力
5. 保持客观中立的立场`,

  lengthGuidelines: {
    short: { minWords: 800, maxWords: 1200, paragraphs: 5 },
    medium: { minWords: 1500, maxWords: 2500, paragraphs: 8 },
    long: { minWords: 3000, maxWords: 5000, paragraphs: 12 },
  },
};
