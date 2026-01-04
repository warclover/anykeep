/**
 * 大纲生成 Prompt 模板 (Story 2.1)
 * @module knowledge-studio/blueprint/prompts
 *
 * 用于生成结构化内容大纲，作为内容生成的蓝图。
 * AC:
 * - 大纲包含 H1/H2/H3 层级结构
 * - 每个章节包含预计内容摘要（1-2 句）
 * - 生成时间 < 5 秒
 */

import type { BriefingContext, MaterialInput } from "../types";

// ============================================================
// Types
// ============================================================

/**
 * 大纲生成配置
 */
export interface OutlineGenerationConfig {
  /** 蓝图 ID */
  blueprintId: string;
  /** 蓝图名称 */
  blueprintName: string;
  /** 蓝图特定指令 */
  blueprintInstructions?: string;
  /** 目标长度 */
  targetLength: "short" | "medium" | "long";
  /** 输出语言 */
  outputLanguage?: "zh" | "en" | "auto";
  /** 最大章节数 */
  maxSections?: number;
  /** 最大层级深度 */
  maxDepth?: 1 | 2 | 3;
}

/**
 * 长度配置映射
 */
const LENGTH_CONFIG = {
  short: {
    wordRange: "500-1000字",
    sectionCount: "3-5个",
    depthHint: "以 H1 为主，少量 H2",
  },
  medium: {
    wordRange: "1500-3000字",
    sectionCount: "5-8个",
    depthHint: "H1 + H2 为主，适量 H3",
  },
  long: {
    wordRange: "4000-8000字",
    sectionCount: "8-15个",
    depthHint: "完整的 H1/H2/H3 层级",
  },
};

// ============================================================
// System Prompt
// ============================================================

export const OUTLINE_SYSTEM_PROMPT = `你是一位专业的内容架构师，擅长将素材组织成清晰、有逻辑的大纲结构。

## 核心原则

1. **层级清晰**: 使用 H1（一级标题）、H2（二级标题）、H3（三级标题）三级结构
2. **逻辑递进**: 内容应该有明确的逻辑顺序（时间/因果/总分/递进）
3. **完整覆盖**: 确保素材的关键信息都被纳入大纲
4. **简洁明了**: 每个标题简短有力，每个描述 1-2 句话概括

## 输出格式

你必须输出一个 JSON 对象，格式如下：

\`\`\`json
{
  "title": "文章总标题",
  "summary": "文章核心内容的一句话概述",
  "nodes": [
    {
      "id": "section-1",
      "title": "第一章标题",
      "level": 1,
      "description": "这一章节的核心内容概述（1-2句）",
      "estimatedWords": 500,
      "children": [
        {
          "id": "section-1-1",
          "title": "1.1 小节标题",
          "level": 2,
          "description": "小节内容概述",
          "estimatedWords": 200
        }
      ]
    }
  ],
  "totalEstimatedWords": 2000,
  "generatedBy": "deepseek"
}
\`\`\`

## 注意事项

- id 使用 kebab-case 格式，如 "section-1", "section-1-2"
- level 只能是 1, 2, 或 3
- description 要具体，不要用"详细介绍"等模糊表述
- estimatedWords 是预估字数，帮助用户判断章节权重
- 确保 children 数组中的节点 level 比父节点大 1`;

// ============================================================
// User Prompt Builder
// ============================================================

/**
 * 构建用户提示词
 */
export function buildOutlineUserPrompt(
  config: OutlineGenerationConfig,
  materials: MaterialInput[],
  briefingContext?: BriefingContext,
): string {
  const lengthGuide = LENGTH_CONFIG[config.targetLength];
  const maxSections =
    config.maxSections ?? (config.targetLength === "long" ? 15 : 8);
  const maxDepth = config.maxDepth ?? 3;

  // 素材内容
  const materialsSection = formatMaterials(materials);

  // Briefing 上下文
  const briefingSection = briefingContext
    ? formatBriefingContext(briefingContext)
    : "";

  // 蓝图特定指令
  const blueprintInstructions = config.blueprintInstructions
    ? `\n## 蓝图特定要求\n\n${config.blueprintInstructions}\n`
    : "";

  return `## 任务

为「${config.blueprintName}」蓝图生成内容大纲。

## 参考素材

${materialsSection}
${briefingSection}${blueprintInstructions}
## 生成要求

- **目标长度**: ${lengthGuide.wordRange}
- **章节数量**: ${lengthGuide.sectionCount}
- **层级深度**: ${lengthGuide.depthHint}（最深 H${maxDepth}）
- **最大章节数**: ${maxSections}个

请根据以上素材和要求，生成结构化的 JSON 大纲。只输出 JSON，不要有其他文字。`;
}

/**
 * 格式化素材内容
 */
function formatMaterials(materials: MaterialInput[]): string {
  if (materials.length === 0) {
    return "（无参考素材）";
  }

  return materials
    .map((m, i) => {
      const content =
        m.content.length > 2000 ? m.content.slice(0, 2000) + "..." : m.content;
      return `### 素材 ${i + 1}: ${m.title}

来源: ${m.url}
平台: ${m.platform ?? "未知"}

${content}`;
    })
    .join("\n\n---\n\n");
}

/**
 * 格式化 Briefing 上下文
 */
function formatBriefingContext(context: BriefingContext): string {
  const answers = Object.entries(context.answers);
  if (answers.length === 0) {
    return "";
  }

  const formatted = answers
    .map(([key, value]) => {
      const displayValue = Array.isArray(value)
        ? value.join(", ")
        : String(value);
      return `- ${key}: ${displayValue}`;
    })
    .join("\n");

  return `\n## 用户偏好设置\n\n${formatted}\n`;
}

// ============================================================
// Prompt Template Export
// ============================================================

/**
 * 大纲生成 Prompt 模板
 */
export interface OutlinePromptTemplate {
  system: string;
  user: string;
}

/**
 * 构建完整的大纲生成 Prompt
 */
export function buildOutlinePrompt(
  config: OutlineGenerationConfig,
  materials: MaterialInput[],
  briefingContext?: BriefingContext,
): OutlinePromptTemplate {
  return {
    system: OUTLINE_SYSTEM_PROMPT,
    user: buildOutlineUserPrompt(config, materials, briefingContext),
  };
}

/**
 * 大纲 JSON Schema（用于结构化输出）
 */
export const OUTLINE_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "文章总标题" },
    summary: { type: "string", description: "文章核心内容概述" },
    nodes: {
      type: "array",
      description: "大纲节点列表",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "节点唯一标识" },
          title: { type: "string", description: "节点标题" },
          level: { type: "number", enum: [1, 2, 3], description: "层级深度" },
          description: { type: "string", description: "内容概述" },
          estimatedWords: { type: "number", description: "预估字数" },
          children: {
            type: "array",
            description: "子节点列表",
            items: { $ref: "#/properties/nodes/items" },
          },
        },
        required: ["id", "title", "level"],
      },
    },
    totalEstimatedWords: { type: "number", description: "总预估字数" },
    generatedBy: { type: "string", description: "生成模型" },
  },
  required: ["title", "summary", "nodes", "totalEstimatedWords", "generatedBy"],
} as const;
