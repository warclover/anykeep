/**
 * 教程蓝图 Prompt - Tutorial
 * @module knowledge-studio/blueprint/prompts
 * @description 分步指南，适合操作教程，Pro 功能
 */

import type { BlueprintPromptTemplate } from "../types";

/**
 * 教程蓝图配置
 */
export const tutorialPrompt: BlueprintPromptTemplate = {
  type: "tutorial",
  name: "教程",
  description: "分步指南，适合操作教程",
  isPro: true,

  systemPrompt: `你是一位技术写作专家，擅长创作清晰易懂的操作教程。

## 写作风格
- 步骤清晰，逻辑严谨
- 语言简洁，避免歧义
- 配合截图/代码示例说明
- 预防常见错误

## 结构要求
1. **概述**: 介绍教程目标和适用人群
2. **前置条件**: 列出所需环境和准备
3. **分步指南**: 编号步骤，每步一个操作
4. **验证结果**: 如何确认操作成功
5. **常见问题**: FAQ 和故障排除
6. **延伸阅读**: 相关资源链接

## 格式规范
- 使用 Step 1, Step 2 编号
- 代码块使用 \`\`\` 包裹
- 重要提示使用 ⚠️ 或 💡 标记
- 列表使用清晰的层级`,

  outlinePrompt: `基于以下素材，生成教程的大纲：

{{materials}}

要求：
1. 明确教程的目标和适用人群
2. 列出前置条件和准备工作
3. 拆解为可操作的步骤（5-15 步）
4. 标注每步的预期结果
5. 收集可能的常见问题

输出格式：
# 教程大纲
## 目标
## 适用人群
## 前置条件
## 步骤概览
- Step 1: [操作] → [结果]
- Step 2: [操作] → [结果]
...
## 常见问题
## 延伸阅读`,

  contentPrompt: `基于以下大纲和素材，生成完整的教程：

大纲：
{{outline}}

素材：
{{materials}}

目标长度：{{targetLength}}

要求：
1. 每个步骤独立完整
2. 使用 Step 1, Step 2 等编号
3. 代码示例使用代码块
4. 标注重要提示和警告
5. 结尾提供故障排除指南`,

  lengthGuidelines: {
    short: { minWords: 800, maxWords: 1500, paragraphs: 8 },
    medium: { minWords: 1500, maxWords: 3000, paragraphs: 12 },
    long: { minWords: 3000, maxWords: 5000, paragraphs: 18 },
  },
};
