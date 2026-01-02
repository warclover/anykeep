/**
 * Blueprint Prompt Builder - 蓝图 Prompt 构建器
 * @module knowledge-studio/blueprint
 */

import type { BlueprintType, ToneType } from "../types";
import type { BlueprintPromptTemplate } from "./types";
import { BLUEPRINT_DISPLAY_CONFIG } from "./types";

/**
 * 蓝图 Prompt 模板集合
 */
const PROMPT_TEMPLATES: Record<BlueprintType, BlueprintPromptTemplate> = {
  debater: {
    type: "debater",
    systemPrompt: `你是一位严谨的辩论专家，擅长从多个角度分析问题。
你的任务是基于提供的素材，生成一篇辩论风格的分析文章。

写作要求：
1. 清晰地呈现正反两方观点
2. 每个论点都需要引用素材作为支撑
3. 使用逻辑严密的论证结构
4. 最后给出平衡的结论或个人立场`,
    userPromptTemplate: `请基于以下素材，生成一篇辩论风格的分析：

{{materials}}

{{customPrompt}}`,
    outputFormat: `## 引言
[简要介绍主题和争议点]

## 正方观点
### 论点一
[论述 + 引用]

### 论点二
[论述 + 引用]

## 反方观点
### 论点一
[论述 + 引用]

### 论点二
[论述 + 引用]

## 结论
[综合分析和个人见解]`,
  },

  blogger: {
    type: "blogger",
    systemPrompt: `你是一位有独特见解的内容创作者，擅长用个人化的叙事吸引读者。
你的任务是基于提供的素材，生成一篇博主风格的文章。

写作要求：
1. 使用第一人称视角
2. 融入个人经历和感悟
3. 语言生动有趣，贴近读者
4. 巧妙融合素材观点，而非简单堆砌`,
    userPromptTemplate: `请基于以下素材，生成一篇博主风格的文章：

{{materials}}

{{customPrompt}}`,
    outputFormat: `# 标题

[个人化的开头，引入话题]

## 我的发现

[结合个人视角分享素材中的精华]

## 深入思考

[个人见解和延伸]

## 写在最后

[总结和互动邀请]`,
  },

  thread: {
    type: "thread",
    systemPrompt: `你是一位擅长社交媒体写作的内容专家，能够将复杂内容拆解成引人入胜的推文串。
你的任务是基于提供的素材，生成一个推文串格式的内容。

写作要求：
1. 每条推文独立成段，约100-200字
2. 开头要有吸引力的 hook
3. 使用渐进式叙事，保持悬念
4. 适当使用 emoji 增加可读性
5. 结尾有明确的行动召唤`,
    userPromptTemplate: `请基于以下素材，生成一个推文串：

{{materials}}

{{customPrompt}}`,
    outputFormat: `🧵 1/N
[Hook - 抓住注意力的开头]

2/N
[承接 - 展开第一个要点]

3/N
[深入 - 核心内容]

...

N/N
[总结 + CTA]`,
  },

  tutorial: {
    type: "tutorial",
    systemPrompt: `你是一位经验丰富的技术教育者，擅长将复杂概念转化为易于理解的教程。
你的任务是基于提供的素材，生成一篇教程风格的文章。

写作要求：
1. 使用清晰的步骤化结构
2. 包含代码示例（如适用）
3. 预设读者可能的疑问并解答
4. 提供实践练习或下一步建议`,
    userPromptTemplate: `请基于以下素材，生成一篇教程风格的文章：

{{materials}}

{{customPrompt}}`,
    outputFormat: `# 教程标题

## 前置知识
[读者需要了解的背景]

## 学习目标
[完成本教程后能掌握什么]

## 步骤一：[名称]
[详细说明]
\`\`\`
[代码示例]
\`\`\`

## 步骤二：[名称]
...

## 常见问题
Q: ...
A: ...

## 下一步
[延伸学习建议]`,
  },

  feynman: {
    type: "feynman",
    systemPrompt: `你是一位运用费曼学习法的教育专家，擅长用最简单的语言解释复杂概念。
你的任务是基于提供的素材，用费曼技巧生成一篇通俗易懂的解释。

写作要求：
1. 假设读者是完全的新手
2. 使用日常生活中的类比
3. 避免专业术语，如必须使用需解释
4. 用具体例子说明抽象概念
5. 检验理解：如果不能简单解释，说明还不够理解`,
    userPromptTemplate: `请用费曼技巧，基于以下素材生成一篇通俗易懂的解释：

{{materials}}

{{customPrompt}}`,
    outputFormat: `# 简单解释：[主题]

## 一句话说清楚
[用一句话概括核心概念]

## 打个比方
[生活化的类比]

## 为什么这很重要
[解释意义和应用场景]

## 再深入一点
[逐步深入但保持简单]

## 检验理解
[几个简单问题帮助读者自测]`,
  },
};

/**
 * 构建蓝图 Prompt
 */
export function buildPromptForBlueprint(
  type: BlueprintType,
  phase: "outline" | "content",
  options: {
    materials?: Array<{ title: string; content: string; url: string }>;
    outline?: string;
    customPrompt?: string;
    targetLength?: "short" | "medium" | "long";
    tone?: ToneType;
  },
): { system: string; user: string } {
  const template = PROMPT_TEMPLATES[type];
  const config = BLUEPRINT_DISPLAY_CONFIG[type];

  // 构建素材文本
  let materialsText = "";
  if (options.materials) {
    materialsText = options.materials
      .map(
        (m, i) => `### 素材 ${i + 1}: ${m.title}\n${m.content}\n来源: ${m.url}`,
      )
      .join("\n\n");
  }

  // 构建自定义 Prompt
  const customPromptText = options.customPrompt
    ? `\n\n用户特别要求：${options.customPrompt}`
    : "";

  // 长度指导
  const lengthGuide = {
    short: "控制在 500 字以内",
    medium: "控制在 1000-1500 字",
    long: "可以写到 2000-3000 字",
  };

  // 语气指导
  const toneGuide: Record<ToneType, string> = {
    formal: "使用正式、专业的语气",
    casual: "使用轻松、亲切的语气",
    academic: "使用学术、严谨的语气",
    friendly: "使用友好、温暖的语气",
  };

  let systemPrompt = template.systemPrompt;
  if (options.targetLength) {
    systemPrompt += `\n\n长度要求：${lengthGuide[options.targetLength]}`;
  }
  if (options.tone) {
    systemPrompt += `\n语气要求：${toneGuide[options.tone]}`;
  }

  if (phase === "outline") {
    return {
      system: systemPrompt,
      user: `请先为以下素材生成一个${config.name}风格的大纲：\n\n${materialsText}${customPromptText}\n\n请只输出大纲，不要开始写正文。`,
    };
  }

  // content phase
  return {
    system: systemPrompt,
    user: (template.userPromptTemplate || template.contentPrompt || "")
      .replace("{{materials}}", options.outline || materialsText)
      .replace("{{customPrompt}}", customPromptText),
  };
}

/**
 * 获取蓝图输出格式参考
 */
export function getBlueprintOutputFormat(type: BlueprintType): string {
  return PROMPT_TEMPLATES[type].outputFormat || "";
}

/**
 * 获取所有蓝图类型
 */
export function getAllBlueprintTypes(): BlueprintType[] {
  return ["debater", "blogger", "thread", "tutorial", "feynman"];
}
