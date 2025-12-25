/**
 * InputValidator - 输入验证模块
 *
 * 职责：
 * - 输入长度限制
 * - 特殊字符过滤（防止 XSS）
 * - 编码规范化
 * - 空白字符处理
 *
 * 在 UnifiedEngine 入口处使用，确保输入安全
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { logger } from "@/lib/logger";

// ============================================
// 常量定义
// ============================================

/**
 * 默认配置
 */
export const INPUT_VALIDATOR_DEFAULTS = {
  /** 最大输入长度（字符） */
  MAX_INPUT_LENGTH: 10000,
  /** 最小输入长度（字符） */
  MIN_INPUT_LENGTH: 1,
  /** 是否启用 XSS 过滤 */
  ENABLE_XSS_FILTER: true,
  /** 是否规范化空白字符 */
  NORMALIZE_WHITESPACE: true,
  /** 是否移除控制字符 */
  REMOVE_CONTROL_CHARS: true,
} as const;

/**
 * XSS 危险模式
 */
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*>/gi,
  /data:text\/html/gi,
];

/**
 * 控制字符正则（除了常见空白字符）
 */
const CONTROL_CHARS_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// ============================================
// 类型定义
// ============================================

/**
 * 输入验证配置
 */
export interface InputValidatorConfig {
  /** 最大输入长度 */
  maxInputLength?: number;
  /** 最小输入长度 */
  minInputLength?: number;
  /** 是否启用 XSS 过滤 */
  enableXssFilter?: boolean;
  /** 是否规范化空白字符 */
  normalizeWhitespace?: boolean;
  /** 是否移除控制字符 */
  removeControlChars?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 清洗后的输入 */
  sanitizedInput: string;
  /** 验证错误（如果无效） */
  error?: string;
  /** 警告信息列表 */
  warnings: string[];
  /** 是否进行了修改 */
  wasModified: boolean;
}

// ============================================
// InputValidator 类
// ============================================

/**
 * 输入验证器
 *
 * 提供输入验证和清洗功能
 */
export class InputValidator {
  private config: Required<InputValidatorConfig>;

  constructor(config: InputValidatorConfig = {}) {
    this.config = {
      maxInputLength:
        config.maxInputLength ?? INPUT_VALIDATOR_DEFAULTS.MAX_INPUT_LENGTH,
      minInputLength:
        config.minInputLength ?? INPUT_VALIDATOR_DEFAULTS.MIN_INPUT_LENGTH,
      enableXssFilter:
        config.enableXssFilter ?? INPUT_VALIDATOR_DEFAULTS.ENABLE_XSS_FILTER,
      normalizeWhitespace:
        config.normalizeWhitespace ??
        INPUT_VALIDATOR_DEFAULTS.NORMALIZE_WHITESPACE,
      removeControlChars:
        config.removeControlChars ??
        INPUT_VALIDATOR_DEFAULTS.REMOVE_CONTROL_CHARS,
      debug: config.debug ?? false,
    };
  }

  /**
   * 验证并清洗输入
   *
   * @param input - 原始输入
   * @returns 验证结果
   */
  validate(input: string): ValidationResult {
    const warnings: string[] = [];
    let sanitized = input;
    let wasModified = false;

    // 1. 检查输入是否为字符串
    if (typeof input !== "string") {
      return {
        valid: false,
        sanitizedInput: "",
        error: "输入必须是字符串",
        warnings: [],
        wasModified: false,
      };
    }

    // 2. 移除控制字符
    if (this.config.removeControlChars) {
      const cleaned = sanitized.replace(CONTROL_CHARS_PATTERN, "");
      if (cleaned !== sanitized) {
        wasModified = true;
        warnings.push("已移除控制字符");
        sanitized = cleaned;
      }
    }

    // 3. 规范化空白字符
    if (this.config.normalizeWhitespace) {
      // 将多个空白字符合并为单个空格
      const normalized = sanitized.replace(/\s+/g, " ").trim();
      if (normalized !== sanitized.trim()) {
        wasModified = true;
        warnings.push("已规范化空白字符");
      }
      sanitized = normalized;
    } else {
      sanitized = sanitized.trim();
    }

    // 4. 检查最小长度
    if (sanitized.length < this.config.minInputLength) {
      return {
        valid: false,
        sanitizedInput: sanitized,
        error: `输入长度不能少于 ${this.config.minInputLength} 个字符`,
        warnings,
        wasModified,
      };
    }

    // 5. 检查最大长度
    if (sanitized.length > this.config.maxInputLength) {
      sanitized = sanitized.substring(0, this.config.maxInputLength);
      wasModified = true;
      warnings.push(`输入已截断至 ${this.config.maxInputLength} 个字符`);
    }

    // 6. XSS 过滤
    if (this.config.enableXssFilter) {
      const xssFiltered = this.filterXss(sanitized);
      if (xssFiltered !== sanitized) {
        wasModified = true;
        warnings.push("已过滤潜在的 XSS 内容");
        sanitized = xssFiltered;
      }
    }

    // 7. 记录调试日志
    if (this.config.debug && wasModified) {
      logger.debug(
        {
          originalLength: input.length,
          sanitizedLength: sanitized.length,
          warnings,
        },
        "InputValidator: Input was modified",
      );
    }

    return {
      valid: true,
      sanitizedInput: sanitized,
      warnings,
      wasModified,
    };
  }

  /**
   * 快速验证（仅检查有效性，不返回清洗后的输入）
   *
   * @param input - 输入字符串
   * @returns 是否有效
   */
  isValid(input: string): boolean {
    if (typeof input !== "string") return false;
    const trimmed = input.trim();
    return (
      trimmed.length >= this.config.minInputLength &&
      trimmed.length <= this.config.maxInputLength
    );
  }

  /**
   * 过滤 XSS 危险内容
   *
   * @param input - 输入字符串
   * @returns 过滤后的字符串
   */
  private filterXss(input: string): string {
    let filtered = input;

    for (const pattern of XSS_PATTERNS) {
      filtered = filtered.replace(pattern, "");
    }

    // HTML 实体编码危险字符
    filtered = filtered.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // 解码回来用于显示（因为这是用户输入，不是 HTML 渲染）
    // 只过滤掉脚本标签，保留其他内容
    filtered = filtered.replace(/&lt;/g, "<").replace(/&gt;/g, ">");

    return filtered;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<InputValidatorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<Required<InputValidatorConfig>> {
    return { ...this.config };
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 InputValidator 实例
 */
export function createInputValidator(
  config?: InputValidatorConfig,
): InputValidator {
  return new InputValidator(config);
}

/**
 * 默认输入验证器实例
 */
export const inputValidator = createInputValidator();

// ============================================
// 便捷函数
// ============================================

/**
 * 快速验证并清洗输入
 *
 * @param input - 原始输入
 * @param config - 可选配置
 * @returns 验证结果
 */
export function validateInput(
  input: string,
  config?: InputValidatorConfig,
): ValidationResult {
  const validator = config ? createInputValidator(config) : inputValidator;
  return validator.validate(input);
}

/**
 * 快速清洗输入（不关心验证结果）
 *
 * @param input - 原始输入
 * @param maxLength - 最大长度
 * @returns 清洗后的输入
 */
export function sanitizeInput(input: string, maxLength?: number): string {
  const result = validateInput(input, { maxInputLength: maxLength });
  return result.sanitizedInput;
}
