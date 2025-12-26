/**
 * 任务模板引擎
 *
 * 用于快速匹配常见任务模式，提升响应速度
 *
 * 设计原则：
 * - 快速匹配：优先使用模板，避免不必要的 LLM 调用
 * - 准确识别：多层匹配策略，确保匹配准确性
 * - 可扩展性：支持动态添加和调整模板
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { createLogger } from "@/lib/logger";
import type { TaskUnderstanding, TaskContext, SmartDefault } from "../types";
import type {
  TaskTemplate,
  TaskTemplateEngineConfig,
  TemplateMatchResult,
} from "./types";

const logger = createLogger("TaskTemplateEngine");

// =============================================================================
// 模板引擎
// =============================================================================

/**
 * 任务模板引擎
 *
 * 负责匹配用户输入与预定义模板，生成任务理解结果
 */
export class TaskTemplateEngine {
  private templates: TaskTemplate[];
  private minConfidence: number;
  private debug: boolean;

  constructor(config: TaskTemplateEngineConfig) {
    // 深拷贝模板以避免修改原始对象
    this.templates = config.templates
      .map((template) => ({
        ...template,
        patterns: [...template.patterns],
        keywords: template.keywords ? [...template.keywords] : undefined,
        excludeKeywords: template.excludeKeywords
          ? [...template.excludeKeywords]
          : undefined,
        executionPlanTemplate: template.executionPlanTemplate.map((step) => ({
          ...step,
          paramsTemplate: step.paramsTemplate
            ? { ...step.paramsTemplate }
            : undefined,
        })),
      }))
      .sort((a, b) => b.priority - a.priority);
    this.minConfidence = config.minConfidence ?? 0.7;
    this.debug = config.debug ?? false;
  }

  // ===========================================================================
  // 公共方法
  // ===========================================================================

  /**
   * 尝试匹配模板
   *
   * @param input 用户输入
   * @param context 任务上下文
   * @returns 匹配结果
   */
  match(input: string, context: TaskContext): TemplateMatchResult {
    const normalizedInput = this.normalizeInput(input);

    // 遍历所有启用的模板
    for (const template of this.templates) {
      if (!template.enabled) continue;

      const matchResult = this.matchTemplate(
        normalizedInput,
        template,
        context,
      );

      if (matchResult.matched && matchResult.confidence >= this.minConfidence) {
        if (this.debug) {
          logger.debug(
            {
              input: input.substring(0, 50),
              templateId: template.id,
              confidence: matchResult.confidence,
              params: matchResult.extractedParams,
            },
            "模板匹配成功",
          );
        }
        return matchResult;
      }
    }

    // 无匹配
    return {
      matched: false,
      extractedParams: {},
      confidence: 0,
    };
  }

  /**
   * 基于匹配结果生成任务理解
   *
   * @param matchResult 匹配结果
   * @param input 用户原始输入
   * @param smartDefaults 智能默认值
   * @returns 任务理解结果
   */
  generateUnderstanding(
    matchResult: TemplateMatchResult,
    input: string,
    smartDefaults: SmartDefault[],
  ): TaskUnderstanding {
    if (!matchResult.matched || !matchResult.template) {
      throw new Error("无法从未匹配的结果生成任务理解");
    }

    const template = matchResult.template;
    const params = matchResult.extractedParams;

    // 渲染目标描述
    const goal = this.renderTemplate(template.goalTemplate, params);

    // 渲染决策依据
    const reasoning = this.renderTemplate(template.reasoningTemplate, params);

    // 渲染执行计划
    const executionPlan = template.executionPlanTemplate.map((step, index) => ({
      step: index + 1,
      description: this.renderTemplate(step.descriptionTemplate, params),
      action: step.action,
      params: step.paramsTemplate
        ? this.renderParams(step.paramsTemplate, params)
        : undefined,
      requiresConfirmation: step.requiresConfirmation,
    }));

    return {
      id: this.generateId(),
      rawInput: input,
      goal,
      reasoning,
      executionPlan,
      confidence: matchResult.confidence,
      requiresConfirmation: template.requiresConfirmation,
      confirmationReason: template.confirmationReason as
        | "删除操作不可撤销，请确认"
        | undefined,
      riskLevel: template.riskLevel,
      appliedDefaults: smartDefaults,
      matchedTemplate: template.id,
      metadata: {
        createdAt: new Date(),
        source: "template",
        processingTimeMs: 0, // 模板匹配几乎不耗时
      },
    };
  }

  /**
   * 获取所有模板
   */
  getTemplates(): TaskTemplate[] {
    return [...this.templates];
  }

  /**
   * 添加模板
   */
  addTemplate(template: TaskTemplate): void {
    this.templates.push(template);
    this.templates.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 移除模板
   */
  removeTemplate(templateId: string): boolean {
    const index = this.templates.findIndex((t) => t.id === templateId);
    if (index === -1) return false;
    this.templates.splice(index, 1);
    return true;
  }

  /**
   * 启用/禁用模板
   */
  setTemplateEnabled(templateId: string, enabled: boolean): boolean {
    const template = this.templates.find((t) => t.id === templateId);
    if (!template) return false;
    template.enabled = enabled;
    return true;
  }

  // ===========================================================================
  // 私有方法
  // ===========================================================================

  /**
   * 标准化输入
   */
  private normalizeInput(input: string): string {
    return input.trim().toLowerCase().replace(/\s+/g, " ");
  }

  /**
   * 匹配单个模板
   */
  private matchTemplate(
    normalizedInput: string,
    template: TaskTemplate,
    context: TaskContext,
  ): TemplateMatchResult {
    // 检查排除词
    if (template.excludeKeywords?.length) {
      for (const exclude of template.excludeKeywords) {
        if (normalizedInput.includes(exclude.toLowerCase())) {
          return {
            matched: false,
            extractedParams: {},
            confidence: 0,
          };
        }
      }
    }

    // 尝试正则匹配
    for (const pattern of template.patterns) {
      const match = normalizedInput.match(pattern);
      if (match) {
        const params = this.extractParams(match, pattern);
        const confidence = this.calculateConfidence(
          template,
          "pattern",
          normalizedInput,
          context,
        );

        return {
          matched: true,
          template,
          extractedParams: params,
          confidence,
          matchDetails: {
            matchType: "pattern",
            matchedBy: pattern.source,
            score: confidence,
          },
        };
      }
    }

    // 尝试关键词匹配
    if (template.keywords?.length) {
      const matchedKeyword = template.keywords.find((kw) =>
        normalizedInput.includes(kw.toLowerCase()),
      );

      if (matchedKeyword) {
        const params = this.extractKeywordParams(normalizedInput, template);
        const confidence = this.calculateConfidence(
          template,
          "keyword",
          normalizedInput,
          context,
        );

        return {
          matched: true,
          template,
          extractedParams: params,
          confidence,
          matchDetails: {
            matchType: "keyword",
            matchedBy: matchedKeyword,
            score: confidence,
          },
        };
      }
    }

    return {
      matched: false,
      extractedParams: {},
      confidence: 0,
    };
  }

  /**
   * 从正则匹配中提取参数
   */
  private extractParams(
    match: RegExpMatchArray,
    _pattern: RegExp,
  ): Record<string, string> {
    const params: Record<string, string> = {};

    // 提取命名捕获组
    if (match.groups) {
      Object.assign(params, match.groups);
    }

    // 提取位置捕获组
    for (let i = 1; i < match.length; i++) {
      if (match[i]) {
        params[`$${i}`] = match[i];
      }
    }

    return params;
  }

  /**
   * 从关键词匹配中提取参数
   */
  private extractKeywordParams(
    input: string,
    _template: TaskTemplate,
  ): Record<string, string> {
    const params: Record<string, string> = {};

    // 尝试提取常见参数模式
    // 文件夹名称
    const folderMatch = input.match(
      /(?:到|移到|移动到|放到)\s*(?<folder>[^\s]+)/,
    );
    if (folderMatch?.groups?.folder) {
      params.folder = folderMatch.groups.folder;
    }

    // 搜索关键词
    const searchMatch = input.match(
      /(?:搜索|查找|找|搜)\s*(?<query>.+?)(?:$|的)/,
    );
    if (searchMatch?.groups?.query) {
      params.query = searchMatch.groups.query.trim();
    }

    // 导出格式
    const formatMatch = input.match(
      /(?:导出为?|导成)\s*(?<format>csv|json|markdown|md|html|obsidian)/i,
    );
    if (formatMatch?.groups?.format) {
      params.format = formatMatch.groups.format.toLowerCase();
    }

    return params;
  }

  /**
   * 计算匹配置信度
   */
  private calculateConfidence(
    template: TaskTemplate,
    matchType: "pattern" | "keyword",
    input: string,
    context: TaskContext,
  ): number {
    let confidence = template.baseConfidence;

    // 正则匹配通常更精确
    if (matchType === "pattern") {
      confidence += 0.1;
    }

    // 输入长度适中时置信度更高
    if (input.length >= 5 && input.length <= 50) {
      confidence += 0.05;
    }

    // 有上下文信息时置信度更高
    if (context.stats.total > 0) {
      confidence += 0.05;
    }

    // 限制在 0-1 范围
    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * 渲染模板字符串
   */
  private renderTemplate(
    template: string,
    params: Record<string, string>,
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }

    // 移除未替换的占位符
    result = result.replace(/\{[^}]+\}/g, "");

    return result.trim();
  }

  /**
   * 渲染参数模板
   */
  private renderParams(
    paramsTemplate: Record<string, string>,
    params: Record<string, string>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, valueTemplate] of Object.entries(paramsTemplate)) {
      result[key] = this.renderTemplate(valueTemplate, params);
    }

    return result;
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `tu_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 创建模板引擎
 */
export function createTaskTemplateEngine(
  config: TaskTemplateEngineConfig,
): TaskTemplateEngine {
  return new TaskTemplateEngine(config);
}
