/**
 * Briefing 响应注入器 (Story 1.8 + 1.9)
 * @module knowledge-studio/blueprint
 *
 * 将用户的 Briefing 响应格式化并注入到生成 Prompt 中。
 * AC:
 * - 将 Briefing 响应格式化为结构化上下文
 * - 注入到 Prompt 的专用区域（<user_preferences> 标签内）
 * - 保存 Briefing 响应到 synthesis_reports.briefing_responses 字段
 * - Briefing 响应使用 JSON 格式存储
 * - 支持快速模式跳过 Briefing（Story 1.9）
 */

import type {
  BriefingContext,
  BriefingQuestion,
  BriefingQuestionCategory,
  GenerationMode,
} from "./types";

// ============================================================
// Types
// ============================================================

/**
 * 格式化后的 Briefing 响应
 */
export interface FormattedBriefingResponse {
  /** 注入到 Prompt 的文本 */
  promptInjection: string;
  /** 存储到数据库的 JSON 格式 */
  storageFormat: BriefingStorageFormat;
}

/**
 * 存储格式（用于 synthesis_reports.briefing_responses）
 */
export interface BriefingStorageFormat {
  /** 版本号 */
  version: "1.0";
  /** 回答时间戳 */
  answeredAt: string;
  /** 问题和回答映射 */
  responses: Array<{
    questionId: string;
    questionText: string;
    category: BriefingQuestionCategory | undefined;
    answer: string | string[] | number;
    answerLabel?: string;
    isConditional: boolean;
  }>;
}

// ============================================================
// 类别标签映射
// ============================================================

const CATEGORY_LABELS: Record<BriefingQuestionCategory, string> = {
  audience: "目标受众",
  objective: "生成目标",
  tone: "语气风格",
  constraint: "约束条件",
  context: "背景信息",
  custom: "其他信息",
};

// ============================================================
// 格式化函数
// ============================================================

/**
 * 获取答案的可读标签
 */
function getAnswerLabel(
  question: BriefingQuestion,
  answer: string | string[] | number,
): string {
  if (question.type === "scale") {
    const labels = question.scaleConfig?.labels;
    if (labels && typeof answer === "number" && labels[answer]) {
      return `${answer} (${labels[answer]})`;
    }
    return String(answer);
  }

  if (question.type === "single_choice") {
    const option = question.options?.find((o) => o.value === answer);
    return option?.label ?? String(answer);
  }

  if (question.type === "multi_choice" && Array.isArray(answer)) {
    const labels = answer.map((v) => {
      const option = question.options?.find((o) => o.value === v);
      return option?.label ?? v;
    });
    return labels.join("、");
  }

  return String(answer);
}

/**
 * 格式化单个问题响应
 */
function formatQuestionResponse(
  question: BriefingQuestion,
  answer: string | string[] | number,
): string {
  const answerLabel = getAnswerLabel(question, answer);
  return `- ${question.question}\n  答：${answerLabel}`;
}

/**
 * 按类别分组问题
 */
function groupByCategory(
  questions: BriefingQuestion[],
  answers: Record<string, string | string[] | number>,
): Map<
  BriefingQuestionCategory | "unknown",
  Array<{ q: BriefingQuestion; a: string | string[] | number }>
> {
  const groups = new Map<
    BriefingQuestionCategory | "unknown",
    Array<{ q: BriefingQuestion; a: string | string[] | number }>
  >();

  questions.forEach((q) => {
    const answer = answers[q.id];
    if (answer === undefined) return;

    const category = q.category ?? "unknown";
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push({ q, a: answer });
  });

  return groups;
}

// ============================================================
// 主函数
// ============================================================

/**
 * 格式化 Briefing 响应
 *
 * 将用户的 Briefing 回答转换为：
 * 1. 可注入 Prompt 的文本格式
 * 2. 可存储到数据库的 JSON 格式
 *
 * @param context - Briefing 上下文（用户回答）
 * @param questions - 问题定义列表
 * @returns 格式化后的响应
 *
 * @example
 * ```typescript
 * const result = formatBriefingResponse(context, questions);
 * // result.promptInjection 可直接注入 Prompt
 * // result.storageFormat 可存储到数据库
 * ```
 */
export function formatBriefingResponse(
  context: BriefingContext,
  questions: BriefingQuestion[],
): FormattedBriefingResponse {
  const { answers, answeredAt } = context;

  // 构建存储格式
  const responses: BriefingStorageFormat["responses"] = [];
  questions.forEach((q) => {
    const answer = answers[q.id];
    if (answer === undefined) return;

    responses.push({
      questionId: q.id,
      questionText: q.question,
      category: q.category,
      answer,
      answerLabel: getAnswerLabel(q, answer),
      isConditional: q.isConditional ?? false,
    });
  });

  const storageFormat: BriefingStorageFormat = {
    version: "1.0",
    answeredAt: answeredAt.toISOString(),
    responses,
  };

  // 构建 Prompt 注入文本
  const grouped = groupByCategory(questions, answers);
  const sections: string[] = [];

  // 按固定顺序处理类别
  const categoryOrder: (BriefingQuestionCategory | "unknown")[] = [
    "audience",
    "objective",
    "tone",
    "constraint",
    "context",
    "custom",
    "unknown",
  ];

  categoryOrder.forEach((category) => {
    const items = grouped.get(category);
    if (!items || items.length === 0) return;

    const categoryLabel =
      category === "unknown"
        ? "其他信息"
        : CATEGORY_LABELS[category as BriefingQuestionCategory];

    const formattedItems = items.map(({ q, a }) =>
      formatQuestionResponse(q, a),
    );

    sections.push(`### ${categoryLabel}\n${formattedItems.join("\n")}`);
  });

  const promptInjection = `<user_preferences>
${sections.join("\n\n")}
</user_preferences>`;

  return {
    promptInjection,
    storageFormat,
  };
}

/**
 * 注入 Briefing 响应到 Prompt
 *
 * @param basePrompt - 基础 Prompt
 * @param context - Briefing 上下文
 * @param questions - 问题定义列表
 * @param insertPosition - 插入位置（"prepend" | "append" | "auto"）
 * @returns 注入后的 Prompt
 */
export function injectBriefingToPrompt(
  basePrompt: string,
  context: BriefingContext,
  questions: BriefingQuestion[],
  insertPosition: "prepend" | "append" | "auto" = "auto",
): string {
  // 如果没有回答，返回原始 Prompt
  if (Object.keys(context.answers).length === 0) {
    return basePrompt;
  }

  const { promptInjection } = formatBriefingResponse(context, questions);

  // 自动模式：检测是否有 </materials> 或类似标签，在其后插入
  if (insertPosition === "auto") {
    // 尝试在 </materials> 后插入
    if (basePrompt.includes("</materials>")) {
      return basePrompt.replace(
        "</materials>",
        `</materials>\n\n${promptInjection}`,
      );
    }
    // 尝试在 </context> 后插入
    if (basePrompt.includes("</context>")) {
      return basePrompt.replace(
        "</context>",
        `</context>\n\n${promptInjection}`,
      );
    }
    // 默认追加到末尾
    return `${basePrompt}\n\n${promptInjection}`;
  }

  if (insertPosition === "prepend") {
    return `${promptInjection}\n\n${basePrompt}`;
  }

  return `${basePrompt}\n\n${promptInjection}`;
}

/**
 * 检查 Briefing 上下文是否为空
 */
export function isBriefingContextEmpty(context: BriefingContext): boolean {
  return Object.keys(context.answers).length === 0;
}

/**
 * 创建空的 Briefing 上下文
 */
export function createEmptyBriefingContext(): BriefingContext {
  return {
    answers: {},
    answeredAt: new Date(),
  };
}

/**
 * 从存储格式还原 Briefing 上下文
 */
export function restoreBriefingContext(
  storage: BriefingStorageFormat,
): BriefingContext {
  const answers: Record<string, string | string[] | number> = {};
  storage.responses.forEach((r) => {
    answers[r.questionId] = r.answer;
  });

  return {
    answers,
    answeredAt: new Date(storage.answeredAt),
  };
}

// ============================================================
// Story 1.9: 快速模式支持
// ============================================================

/**
 * 快速模式存储格式
 */
export interface QuickModeStorageFormat {
  /** 版本号 */
  version: "1.0";
  /** 模式 */
  mode: "quick";
  /** 跳过时间戳 */
  skippedAt: string;
  /** 使用的默认值 */
  defaults: Array<{
    questionId: string;
    defaultValue: string | string[] | number | undefined;
  }>;
}

/**
 * 创建快速模式的 Briefing 上下文
 *
 * 使用问题定义中的默认值创建上下文。
 * 用于用户跳过 Briefing 时。
 *
 * @param questions - 问题定义列表
 * @returns 使用默认值的 Briefing 上下文
 */
export function createQuickModeContext(
  questions: BriefingQuestion[],
): BriefingContext {
  const answers: Record<string, string | string[] | number> = {};

  questions.forEach((q) => {
    if (q.defaultValue !== undefined) {
      answers[q.id] = q.defaultValue;
    }
  });

  return {
    answers,
    answeredAt: new Date(),
  };
}

/**
 * 创建快速模式存储格式
 *
 * 用于记录用户使用了快速模式。
 *
 * @param questions - 问题定义列表
 * @returns 快速模式存储格式
 */
export function createQuickModeStorageFormat(
  questions: BriefingQuestion[],
): QuickModeStorageFormat {
  return {
    version: "1.0",
    mode: "quick",
    skippedAt: new Date().toISOString(),
    defaults: questions.map((q) => ({
      questionId: q.id,
      defaultValue: q.defaultValue,
    })),
  };
}

/**
 * 判断存储格式是否为快速模式
 */
export function isQuickModeStorage(
  storage: BriefingStorageFormat | QuickModeStorageFormat,
): storage is QuickModeStorageFormat {
  return "mode" in storage && storage.mode === "quick";
}

/**
 * 确定生成模式
 *
 * @param hasBriefingContext - 是否有 Briefing 上下文
 * @param briefingEnabled - 蓝图是否启用 Briefing
 * @returns 生成模式
 */
export function determineGenerationMode(
  hasBriefingContext: boolean,
  briefingEnabled: boolean,
): GenerationMode {
  if (!briefingEnabled) {
    return "quick";
  }
  return hasBriefingContext ? "guided" : "quick";
}

/**
 * 创建生成模式元数据
 *
 * 用于存储到 synthesis_reports.generation_mode 字段。
 */
export interface GenerationModeMetadata {
  mode: GenerationMode;
  briefingEnabled: boolean;
  questionsCount: number;
  answeredCount: number;
  skippedAt?: string;
  completedAt?: string;
}

/**
 * 创建生成模式元数据
 */
export function createGenerationModeMetadata(
  mode: GenerationMode,
  questions: BriefingQuestion[],
  context?: BriefingContext,
): GenerationModeMetadata {
  const answeredCount = context ? Object.keys(context.answers).length : 0;

  return {
    mode,
    briefingEnabled: questions.length > 0,
    questionsCount: questions.length,
    answeredCount,
    ...(mode === "quick"
      ? { skippedAt: new Date().toISOString() }
      : { completedAt: context?.answeredAt.toISOString() }),
  };
}
