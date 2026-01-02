/**
 * Chat-to-Edit Prompt Builder
 * @module knowledge-studio/chat-edit
 */

import type { EditIntent, ChatEditContext } from "./types";
import { EDIT_MODE_CONFIG } from "./types";

/**
 * 构建编辑 Prompt
 */
export function buildEditPrompt(
  intent: EditIntent,
  context: ChatEditContext,
): { system: string; user: string } {
  const modeConfig = EDIT_MODE_CONFIG[intent.mode];

  // 构建系统 Prompt
  const systemPrompt = `你是一位专业的写作编辑助手，擅长根据用户指示精确修改文本段落。

当前任务：${modeConfig.description}

编辑原则：
1. 保持与上下文的一致性和连贯性
2. 保留原文的核心信息和结构（除非用户明确要求改变）
3. 修改应该自然流畅，不留痕迹
4. 如果用户指示不清晰，优先保持原意

输出要求：
- 直接输出修改后的段落内容
- 不要添加解释或注释
- 不要使用 markdown 格式标记（除非原文有）`;

  // 构建用户 Prompt
  let userPrompt = `## 当前段落
${context.paragraph.content}

## 上下文
【前文】
${context.surroundingContext.before || "（无）"}

【后文】
${context.surroundingContext.after || "（无）"}

## 编辑指示
${intent.instruction}`;

  // 添加语气要求（如果有）
  if (intent.targetTone) {
    const toneDescriptions = {
      formal: "正式、专业",
      casual: "轻松、亲切",
      academic: "学术、严谨",
      friendly: "友好、温暖",
    };
    userPrompt += `\n\n目标语气：${toneDescriptions[intent.targetTone]}`;
  }

  // 添加对话历史（如果有）
  if (context.recentTurns.length > 0) {
    userPrompt += "\n\n## 之前的编辑对话\n";
    context.recentTurns.forEach((turn) => {
      userPrompt += `${turn.role === "user" ? "用户" : "助手"}: ${turn.content}\n`;
    });
  }

  // 添加早期对话摘要（如果有）
  if (context.olderTurnsSummary) {
    userPrompt += `\n\n## 早期对话摘要\n${context.olderTurnsSummary}`;
  }

  return { system: systemPrompt, user: userPrompt };
}

/**
 * 获取编辑建议 Prompt
 */
export function buildSuggestionPrompt(content: string): {
  system: string;
  user: string;
} {
  return {
    system: `你是一位写作编辑专家，能够分析文本并提供改进建议。
请分析给定段落的问题，并提供 2-3 条具体的改进建议。`,

    user: `请分析以下段落并提供改进建议：

${content}

请用简洁的方式列出建议：`,
  };
}
