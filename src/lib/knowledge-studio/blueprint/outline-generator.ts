/**
 * 大纲生成器 (Story 2.1)
 * @module knowledge-studio/blueprint
 *
 * 使用 DeepSeek 模型生成结构化大纲，作为内容生成的蓝图。
 * AC:
 * - 大纲包含 H1/H2/H3 层级结构
 * - 每个章节包含预计内容摘要（1-2 句）
 * - 生成时间 < 5 秒
 * - 支持 SSE 流式输出
 */

import { generateText } from "ai";
import { createLogger } from "@/lib/logger";
import { aiProviderRouter } from "@/lib/ai-providers";
import type { OrchestrationStreamChunk } from "../../ai-skills/output/types";
import type {
  BlueprintOutline,
  OutlineNode,
  BriefingContext,
  MaterialInput,
} from "./types";
import {
  buildOutlinePrompt,
  type OutlineGenerationConfig,
} from "./prompts/outline.prompt";

// ============================================================
// Logger
// ============================================================

const logger = createLogger("blueprint:outline-generator");

// ============================================================
// Types
// ============================================================

/**
 * 大纲生成选项
 */
export interface OutlineGeneratorOptions {
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
  /** 生成超时（毫秒） */
  timeoutMs?: number;
}

/**
 * 大纲生成结果
 */
export interface OutlineGenerationResult {
  /** 生成的大纲 */
  outline: BlueprintOutline;
  /** 生成耗时（毫秒） */
  durationMs: number;
  /** 使用的 Token 数 */
  tokensUsed?: number;
  /** 使用的模型 */
  modelUsed: string;
}

/**
 * 大纲解析错误
 */
export class OutlineParseError extends Error {
  constructor(
    message: string,
    public rawContent: string,
  ) {
    super(message);
    this.name = "OutlineParseError";
  }
}

/**
 * 大纲验证错误
 */
export class OutlineValidationError extends Error {
  constructor(
    message: string,
    public outline: Partial<BlueprintOutline>,
  ) {
    super(message);
    this.name = "OutlineValidationError";
  }
}

// ============================================================
// Outline Parser
// ============================================================

/**
 * 从 LLM 响应中提取 JSON
 */
function extractJson(text: string): string {
  // 尝试提取 ```json ... ``` 块
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // 尝试提取 ``` ... ``` 块
  const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 尝试直接解析（可能是纯 JSON）
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  // 最后尝试找到第一个 { 和最后一个 }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  throw new OutlineParseError("Unable to extract JSON from response", text);
}

/**
 * 解析大纲 JSON
 */
function parseOutlineJson(jsonStr: string): BlueprintOutline {
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      title: parsed.title ?? "Untitled",
      summary: parsed.summary ?? "",
      nodes: parseNodes(parsed.nodes ?? []),
      totalEstimatedWords: parsed.totalEstimatedWords ?? 0,
      generatedBy: parsed.generatedBy ?? "deepseek",
    };
  } catch (error) {
    throw new OutlineParseError(
      `Failed to parse outline JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
      jsonStr,
    );
  }
}

/**
 * 递归解析节点
 */
function parseNodes(nodes: unknown[]): OutlineNode[] {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.map((node, index) => {
    const n = node as Record<string, unknown>;
    return {
      id: (n.id as string) ?? `section-${index + 1}`,
      title: (n.title as string) ?? `Section ${index + 1}`,
      level: normalizeLevel(n.level),
      description: n.description as string | undefined,
      estimatedWords: n.estimatedWords as number | undefined,
      children: parseNodes((n.children as unknown[]) ?? []),
    };
  });
}

/**
 * 规范化层级
 */
function normalizeLevel(level: unknown): 1 | 2 | 3 {
  const num = Number(level);
  if (num === 1 || num === 2 || num === 3) {
    return num;
  }
  return 1; // 默认为 H1
}

// ============================================================
// Outline Validator
// ============================================================

/**
 * 验证大纲结构
 */
function validateOutline(outline: BlueprintOutline): void {
  // 验证标题
  if (!outline.title || outline.title.trim().length === 0) {
    throw new OutlineValidationError("Outline title is required", outline);
  }

  // 验证节点
  if (!outline.nodes || outline.nodes.length === 0) {
    throw new OutlineValidationError(
      "Outline must have at least one node",
      outline,
    );
  }

  // 验证节点层级递进
  validateNodeHierarchy(outline.nodes);
}

/**
 * 验证节点层级递进
 */
function validateNodeHierarchy(
  nodes: OutlineNode[],
  parentLevel: 0 | 1 | 2 = 0,
): void {
  for (const node of nodes) {
    // 子节点层级必须大于父节点
    if (node.level <= parentLevel) {
      logger.warn(
        { nodeId: node.id, nodeLevel: node.level, parentLevel },
        "Node level should be greater than parent level, auto-correcting",
      );
      // 自动修正
      node.level = (parentLevel + 1) as 1 | 2 | 3;
      if (node.level > 3) {
        node.level = 3;
      }
    }

    // 递归验证子节点
    if (node.children && node.children.length > 0) {
      validateNodeHierarchy(node.children, node.level as 0 | 1 | 2);
    }
  }
}

// ============================================================
// Main Generator
// ============================================================

/**
 * 生成大纲（非流式）
 *
 * @param materials - 素材列表
 * @param options - 生成选项
 * @param briefingContext - Briefing 上下文（可选）
 * @returns 大纲生成结果
 *
 * @example
 * ```typescript
 * const result = await generateOutline(materials, {
 *   blueprintId: 'geek-arxiv',
 *   blueprintName: '论文解读',
 *   targetLength: 'medium',
 * });
 * console.log(result.outline.nodes);
 * ```
 */
export async function generateOutline(
  materials: MaterialInput[],
  options: OutlineGeneratorOptions,
  briefingContext?: BriefingContext,
): Promise<OutlineGenerationResult> {
  const startTime = performance.now();
  const timeoutMs = options.timeoutMs ?? 10000; // 默认 10 秒超时

  logger.info(
    {
      blueprintId: options.blueprintId,
      materialsCount: materials.length,
      targetLength: options.targetLength,
    },
    "Starting outline generation",
  );

  // 构建配置
  const config: OutlineGenerationConfig = {
    blueprintId: options.blueprintId,
    blueprintName: options.blueprintName,
    blueprintInstructions: options.blueprintInstructions,
    targetLength: options.targetLength,
    outputLanguage: options.outputLanguage,
    maxSections: options.maxSections,
    maxDepth: options.maxDepth,
  };

  // 构建 Prompt
  const prompt = buildOutlinePrompt(config, materials, briefingContext);

  // 获取 DeepSeek 模型（优先使用 DeepSeek）
  const selection = aiProviderRouter.selectProvider({
    taskType: "reasoning",
    preferredProvider: "deepseek",
    requiresStreaming: false,
  });

  if (!selection) {
    throw new Error("No AI provider available for outline generation");
  }

  logger.debug(
    {
      provider: selection.provider.name,
      model: selection.provider.defaultModel,
    },
    "Using AI provider",
  );

  try {
    // 创建超时信号（兼容低版本 Node.js）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // 调用模型
    const result = await generateText({
      model: selection.model,
      system: prompt.system,
      prompt: prompt.user,
      maxOutputTokens: 2048,
      temperature: 0.7,
      abortSignal: controller.signal,
    });

    // 清除超时
    clearTimeout(timeoutId);

    const durationMs = Math.round(performance.now() - startTime);

    // 记录成功
    aiProviderRouter.recordSuccess(selection.provider.name, durationMs);

    logger.info(
      {
        durationMs,
        textLength: result.text.length,
        tokensUsed: result.usage?.totalTokens,
      },
      "LLM response received",
    );

    // 解析 JSON
    const jsonStr = extractJson(result.text);
    const outline = parseOutlineJson(jsonStr);

    // 验证大纲
    validateOutline(outline);

    logger.info(
      {
        title: outline.title,
        nodesCount: outline.nodes.length,
        totalWords: outline.totalEstimatedWords,
        durationMs,
      },
      "Outline generation completed",
    );

    return {
      outline,
      durationMs,
      tokensUsed: result.usage?.totalTokens,
      modelUsed: selection.provider.defaultModel,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);

    // 记录失败
    aiProviderRouter.recordFailure(
      selection.provider.name,
      error instanceof Error ? error.message : "Unknown error",
    );

    logger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs,
        blueprintId: options.blueprintId,
      },
      "Outline generation failed",
    );

    throw error;
  }
}

/**
 * 生成大纲（流式）
 *
 * 使用 AsyncGenerator 提供流式进度反馈。
 *
 * @param materials - 素材列表
 * @param options - 生成选项
 * @param briefingContext - Briefing 上下文（可选）
 * @yields OrchestrationStreamChunk - 进度块
 * @returns BlueprintOutline - 生成的大纲
 *
 * @example
 * ```typescript
 * const generator = generateOutlineStream(materials, options);
 * let outline: BlueprintOutline;
 *
 * for await (const chunk of generator) {
 *   if (chunk.type === 'progress') {
 *     console.log(`Progress: ${chunk.data.percent}%`);
 *   }
 * }
 *
 * // 最后返回大纲
 * const result = await generator.next();
 * if (result.done) {
 *   outline = result.value;
 * }
 * ```
 */
export async function* generateOutlineStream(
  materials: MaterialInput[],
  options: OutlineGeneratorOptions,
  briefingContext?: BriefingContext,
): AsyncGenerator<OrchestrationStreamChunk, BlueprintOutline, unknown> {
  const startTime = performance.now();

  // 进度 10%：开始分析
  yield {
    type: "progress",
    data: {
      step: "outline",
      percent: 10,
      message: "分析素材内容...",
      timestamp: Date.now(),
    },
  };

  // 进度 20%：构建 Prompt
  yield {
    type: "progress",
    data: {
      step: "outline",
      percent: 20,
      message: "构建生成指令...",
      timestamp: Date.now(),
    },
  };

  // 进度 30%：调用模型
  yield {
    type: "progress",
    data: {
      step: "outline",
      percent: 30,
      message: "生成大纲结构...",
      timestamp: Date.now(),
    },
  };

  try {
    // 实际生成
    const result = await generateOutline(materials, options, briefingContext);

    // 进度 80%：解析完成
    yield {
      type: "progress",
      data: {
        step: "outline",
        percent: 80,
        message: "大纲解析完成...",
        timestamp: Date.now(),
      },
    };

    // 进度 100%：完成
    yield {
      type: "progress",
      data: {
        step: "outline",
        percent: 100,
        message: `大纲生成完成（${Math.round(performance.now() - startTime)}ms）`,
        timestamp: Date.now(),
      },
    };

    // 发送文本消息
    yield {
      type: "text",
      data: {
        text: `生成了「${result.outline.title}」大纲，包含 ${result.outline.nodes.length} 个主要章节。`,
      },
    };

    return result.outline;
  } catch (error) {
    // 发送错误
    yield {
      type: "error",
      data: {
        message: error instanceof Error ? error.message : "大纲生成失败",
        retryable: true,
        suggestion: "请重试或检查素材内容",
      },
    };

    throw error;
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * 计算大纲节点总数
 */
export function countOutlineNodes(nodes: OutlineNode[]): number {
  let count = nodes.length;
  for (const node of nodes) {
    if (node.children) {
      count += countOutlineNodes(node.children);
    }
  }
  return count;
}

/**
 * 扁平化大纲节点
 */
export function flattenOutlineNodes(nodes: OutlineNode[]): OutlineNode[] {
  const result: OutlineNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) {
      result.push(...flattenOutlineNodes(node.children));
    }
  }
  return result;
}

/**
 * 获取大纲深度
 */
export function getOutlineDepth(nodes: OutlineNode[], depth = 1): number {
  let maxDepth = depth;
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      const childDepth = getOutlineDepth(node.children, depth + 1);
      maxDepth = Math.max(maxDepth, childDepth);
    }
  }
  return maxDepth;
}

/**
 * 创建空大纲
 */
export function createEmptyOutline(title = "Untitled"): BlueprintOutline {
  return {
    title,
    summary: "",
    nodes: [],
    totalEstimatedWords: 0,
    generatedBy: "manual",
  };
}

/**
 * 验证大纲是否为空
 */
export function isOutlineEmpty(outline: BlueprintOutline): boolean {
  return !outline.nodes || outline.nodes.length === 0;
}
