/**
 * ResponseStyler - 响应风格化处理器
 *
 * 职责：
 * - 去除机械化表达
 * - 应用响应模板
 * - 添加跟进建议
 * - 格式化输出
 *
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { IntentType } from "../router/types";
import {
  BANNED_PHRASES,
  detectBannedPhrases,
  removeBannedPhrases,
  getResponseTemplate,
  renderTemplate,
  getFollowUpSuggestions,
  type FollowUpSuggestion,
} from "./style-config";

/**
 * 响应风格化配置
 */
export interface ResponseStylerConfig {
  /** 是否启用禁用短语检测 */
  enableBannedPhraseDetection?: boolean;
  /** 是否自动移除禁用短语 */
  autoRemoveBannedPhrases?: boolean;
  /** 是否添加跟进建议 */
  enableFollowUpSuggestions?: boolean;
  /** 跟进建议最大数量 */
  maxFollowUpSuggestions?: number;
}

/**
 * 风格化响应结果
 */
export interface StyledResponse {
  /** 原始文本 */
  originalText: string;
  /** 风格化后的文本 */
  styledText: string;
  /** 跟进建议 */
  followUpSuggestions: FollowUpSuggestion[];
  /** 是否应用了模板 */
  templateApplied: boolean;
  /** 检测到的禁用短语 */
  detectedBannedPhrases: string[];
  /** 是否移除了禁用短语 */
  bannedPhrasesRemoved: boolean;
}

/**
 * 响应风格化处理器
 */
export class ResponseStyler {
  private config: Required<ResponseStylerConfig>;

  constructor(config: ResponseStylerConfig = {}) {
    this.config = {
      enableBannedPhraseDetection: true,
      autoRemoveBannedPhrases: true,
      enableFollowUpSuggestions: true,
      maxFollowUpSuggestions: 3,
      ...config,
    };
  }

  /**
   * 风格化响应
   *
   * @param text - 原始响应文本
   * @param intentType - 意图类型
   * @param subType - 子类型
   * @param variables - 模板变量（可选）
   * @returns 风格化响应结果
   */
  format(
    text: string,
    intentType: IntentType,
    subType?: string,
    variables?: Record<string, string | number>,
  ): StyledResponse {
    let styledText = text;
    let templateApplied = false;
    const detectedBannedPhrases: string[] = [];
    let bannedPhrasesRemoved = false;

    // 1. 检测禁用短语
    if (this.config.enableBannedPhraseDetection) {
      const detected = detectBannedPhrases(text);
      detectedBannedPhrases.push(...detected);

      // 2. 自动移除禁用短语
      if (this.config.autoRemoveBannedPhrases && detected.length > 0) {
        styledText = removeBannedPhrases(styledText);
        bannedPhrasesRemoved = true;
      }
    }

    // 3. 尝试应用响应模板（如果提供了变量）
    if (variables && Object.keys(variables).length > 0) {
      const template = getResponseTemplate(intentType, subType);
      if (template) {
        const templatedText = renderTemplate(template.template, variables);
        // 如果模板渲染成功（无未替换的占位符），使用模板
        if (!templatedText.includes("{")) {
          styledText = templatedText;
          templateApplied = true;
        }
      }
    }

    // 4. 获取跟进建议
    let followUpSuggestions: FollowUpSuggestion[] = [];
    if (this.config.enableFollowUpSuggestions) {
      followUpSuggestions = getFollowUpSuggestions(intentType, subType).slice(
        0,
        this.config.maxFollowUpSuggestions,
      );
    }

    return {
      originalText: text,
      styledText: styledText.trim(),
      followUpSuggestions,
      templateApplied,
      detectedBannedPhrases,
      bannedPhrasesRemoved,
    };
  }

  /**
   * 快速风格化（仅处理文本，不添加建议）
   *
   * @param text - 原始响应文本
   * @returns 风格化后的文本
   */
  quickFormat(text: string): string {
    if (this.config.autoRemoveBannedPhrases) {
      return removeBannedPhrases(text);
    }
    return text;
  }

  /**
   * 使用模板生成响应
   *
   * @param intentType - 意图类型
   * @param subType - 子类型
   * @param variables - 模板变量
   * @returns 生成的响应文本，如果没有匹配模板返回 null
   */
  generateFromTemplate(
    intentType: IntentType,
    subType?: string,
    variables?: Record<string, string | number>,
  ): string | null {
    const template = getResponseTemplate(intentType, subType);
    if (!template || !variables) {
      return null;
    }

    const rendered = renderTemplate(template.template, variables);
    // 检查是否还有未替换的占位符
    if (rendered.includes("{")) {
      return null;
    }

    return rendered;
  }

  /**
   * 获取跟进建议
   *
   * @param intentType - 意图类型
   * @param subType - 子类型
   * @returns 跟进建议列表
   */
  getSuggestions(
    intentType: IntentType,
    subType?: string,
  ): FollowUpSuggestion[] {
    return getFollowUpSuggestions(intentType, subType).slice(
      0,
      this.config.maxFollowUpSuggestions,
    );
  }

  /**
   * 检测文本中的禁用短语
   *
   * @param text - 要检测的文本
   * @returns 检测到的禁用短语列表
   */
  detectProblems(text: string): string[] {
    return detectBannedPhrases(text);
  }

  /**
   * 验证响应质量
   *
   * @param text - 响应文本
   * @returns 验证结果
   */
  validate(text: string): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // 检测禁用短语
    const bannedPhrases = detectBannedPhrases(text);
    if (bannedPhrases.length > 0) {
      issues.push(`包含禁用短语: ${bannedPhrases.join(", ")}`);
    }

    // 检测过长的响应
    if (text.length > 2000) {
      issues.push("响应过长（>2000字符）");
    }

    // 检测空响应
    if (text.trim().length === 0) {
      issues.push("响应为空");
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ResponseStylerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): Required<ResponseStylerConfig> {
    return { ...this.config };
  }

  /**
   * 获取禁用短语列表
   */
  getBannedPhrases(): string[] {
    return [...BANNED_PHRASES];
  }
}

/**
 * 创建响应风格化处理器
 */
export function createResponseStyler(
  config?: ResponseStylerConfig,
): ResponseStyler {
  return new ResponseStyler(config);
}

/**
 * 默认响应风格化处理器实例
 */
export const responseStyler = new ResponseStyler();
