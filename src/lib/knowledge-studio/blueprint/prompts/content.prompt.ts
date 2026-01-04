/**
 * 基于大纲的内容生成 Prompt 模板 (Story 2.4)
 * @module knowledge-studio/blueprint/prompts
 *
 * 使用确认后的大纲作为约束，生成符合结构的完整内容。
 * AC:
 * - Prompt 包含完整大纲结构作为约束
 * - 生成内容的标题层级与大纲一致
 * - 支持 SSE 流式输出
 */

import type {
  BriefingContext,
  MaterialInput,
  BlueprintOutline,
  OutlineNode,
} from "../types";

// ============================================================
// Types
// ============================================================

/**
 * 内容生成配置
 */
export interface ContentGenerationConfig {
  /** 蓝图 ID */
  blueprintId: string;
  /** 蓝图名称 */
  blueprintName: string;
  /** 蓝图特定指令 */
  blueprintInstructions?: string;
  /** 大纲结构 */
  outline: BlueprintOutline;
  /** 目标长度 */
  targetLength: "short" | "medium" | "long";
  /** 输出语言 */
  outputLanguage?: "zh" | "en" | "auto";
  /** 写作风格 */
  writingStyle?: "formal" | "casual" | "academic" | "creative";
}

/**
 * 长度配置映射
 */
const LENGTH_CONFIG = {
  short: {
    wordRange: "500-1000字",
    sectionDepth: "精简展开",
  },
  medium: {
    wordRange: "1500-3000字",
    sectionDepth: "适度展开",
  },
  long: {
    wordRange: "4000-8000字",
    sectionDepth: "充分展开",
  },
};

/**
 * 写作风格配置
 */
const STYLE_CONFIG = {
  formal: {
    name: "正式",
    hint: "使用正式、专业的语言风格",
  },
  casual: {
    name: "轻松",
    hint: "使用轻松、易读的语言风格",
  },
  academic: {
    name: "学术",
    hint: "使用学术、严谨的语言风格，注重逻辑和论证",
  },
  creative: {
    name: "创意",
    hint: "使用富有创意的语言风格，可以适当使用修辞手法",
  },
};

// ============================================================
// System Prompt
// ============================================================

export const CONTENT_SYSTEM_PROMPT = `你是一位专业的内容创作者，擅长根据大纲结构生成高质量的长文内容。

## 核心原则

1. **严格遵循大纲**: 必须按照提供的大纲结构生成内容，标题层级完全一致
2. **内容完整性**: 每个章节都要有实质性内容，不能敷衍或省略
3. **逻辑连贯**: 章节之间需要有自然的过渡和衔接
4. **素材融合**: 充分利用提供的素材内容，但要重新组织表达

## 输出格式

使用 Markdown 格式输出，标题层级：
- H1 (一级标题): # 标题
- H2 (二级标题): ## 标题
- H3 (三级标题): ### 标题

## 注意事项

- 每个章节的内容长度应与大纲中的 estimatedWords 预估相近
- 保持内容的专业性和可读性
- 适当使用列表、引用等 Markdown 格式增强可读性
- 不要在内容中重复大纲信息`;

// ============================================================
// Prompt Builders
// ============================================================

/**
 * 将大纲节点转换为结构化文本
 */
function formatOutlineForPrompt(nodes: OutlineNode[], indent = 0): string {
  const lines: string[] = [];
  const prefix = "  ".repeat(indent);

  for (const node of nodes) {
    const levelMarker =
      node.level === 1 ? "#" : node.level === 2 ? "##" : "###";
    const wordsHint = node.estimatedWords
      ? ` (约${node.estimatedWords}字)`
      : "";

    lines.push(`${prefix}${levelMarker} ${node.title}${wordsHint}`);

    if (node.description) {
      lines.push(`${prefix}   > ${node.description}`);
    }

    if (node.children && node.children.length > 0) {
      lines.push(formatOutlineForPrompt(node.children, indent + 1));
    }
  }

  return lines.join("\n");
}

/**
 * 构建用户 Prompt
 */
export function buildContentUserPrompt(
  config: ContentGenerationConfig,
  materials: MaterialInput[],
  briefingContext?: BriefingContext,
): string {
  const lengthConfig = LENGTH_CONFIG[config.targetLength];
  const styleConfig = STYLE_CONFIG[config.writingStyle ?? "casual"];

  const parts: string[] = [];

  // 任务说明
  parts.push(`## 任务

请根据以下大纲生成完整的「${config.blueprintName}」内容。

### 要求
- 目标长度: ${lengthConfig.wordRange}
- 展开程度: ${lengthConfig.sectionDepth}
- 写作风格: ${styleConfig.name} - ${styleConfig.hint}`);

  // 大纲结构
  parts.push(`\n## 大纲结构（必须严格遵循）

标题: ${config.outline.title}
${config.outline.summary ? `概述: ${config.outline.summary}` : ""}

### 章节结构

${formatOutlineForPrompt(config.outline.nodes)}`);

  // 素材内容
  if (materials.length > 0) {
    parts.push(`\n## 参考素材

${materials
  .map(
    (m, i) => `### 素材 ${i + 1}: ${m.title}
${m.content ? m.content.slice(0, 2000) : "(无内容)"}
${m.url ? `来源: ${m.url}` : ""}`,
  )
  .join("\n\n")}`);
  }

  // Briefing 上下文
  if (
    briefingContext?.answers &&
    Object.keys(briefingContext.answers).length > 0
  ) {
    parts.push(`\n## 用户偏好

${Object.entries(briefingContext.answers)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join("\n")}`);
  }

  // 蓝图特定指令
  if (config.blueprintInstructions) {
    parts.push(`\n## 特殊指令

${config.blueprintInstructions}`);
  }

  // 最终提示
  parts.push(`\n## 开始生成

请现在按照大纲结构生成完整内容。使用 Markdown 格式，确保每个章节都有实质内容。`);

  return parts.join("\n");
}

/**
 * 构建完整的 Prompt
 */
export function buildContentPrompt(
  config: ContentGenerationConfig,
  materials: MaterialInput[],
  briefingContext?: BriefingContext,
): { system: string; user: string } {
  return {
    system: CONTENT_SYSTEM_PROMPT,
    user: buildContentUserPrompt(config, materials, briefingContext),
  };
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 估算大纲总字数
 */
export function estimateTotalWords(outline: BlueprintOutline): number {
  if (outline.totalEstimatedWords) {
    return outline.totalEstimatedWords;
  }

  function countWords(nodes: OutlineNode[]): number {
    let total = 0;
    for (const node of nodes) {
      total += node.estimatedWords ?? 0;
      if (node.children) {
        total += countWords(node.children);
      }
    }
    return total;
  }

  return countWords(outline.nodes);
}

/**
 * 获取大纲章节数
 */
export function countSections(outline: BlueprintOutline): number {
  function countNodes(nodes: OutlineNode[]): number {
    let count = nodes.length;
    for (const node of nodes) {
      if (node.children) {
        count += countNodes(node.children);
      }
    }
    return count;
  }

  return countNodes(outline.nodes);
}
