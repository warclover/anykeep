/**
 * Knowledge Studio - Prompt 编译器
 * @module knowledge-studio/templates
 * @description P4 实现 - 模板变量插值与 Prompt 编译
 * @version 1.0.0
 * @since 2026-01-02
 */

import { logger } from "@/lib/logger";
import type {
  IPromptCompiler,
  CustomTemplate,
  TemplateVariable,
} from "./types";

// ============================================================================
// Token 估算配置
// ============================================================================

/** 不同语言的 Token 估算比例 */
const TOKEN_RATIO = {
  chinese: 1.5, // 中文约 1.5 字符 = 1 token
  english: 4, // 英文约 4 字符 = 1 token
  mixed: 2.5, // 混合内容平均
};

/** 检测文本中中文字符的比例 */
function detectChineseRatio(text: string): number {
  const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
  return chineseChars.length / text.length;
}

/** 估算 Token 数量 */
function estimateTokens(text: string): number {
  const chineseRatio = detectChineseRatio(text);
  let ratio: number;

  if (chineseRatio > 0.6) {
    ratio = TOKEN_RATIO.chinese;
  } else if (chineseRatio < 0.2) {
    ratio = TOKEN_RATIO.english;
  } else {
    ratio = TOKEN_RATIO.mixed;
  }

  return Math.ceil(text.length / ratio);
}

// ============================================================================
// 变量验证
// ============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateVariableValue(
  variable: TemplateVariable,
  value: unknown,
): ValidationResult {
  const errors: string[] = [];

  // 检查必填
  if (
    variable.required &&
    (value === undefined || value === null || value === "")
  ) {
    errors.push(`变量 "${variable.label}" 是必填项`);
    return { valid: false, errors };
  }

  // 非必填且无值，跳过其他验证
  if (value === undefined || value === null || value === "") {
    return { valid: true, errors: [] };
  }

  // 类型验证
  switch (variable.type) {
    case "text": {
      if (typeof value !== "string") {
        errors.push(`变量 "${variable.label}" 必须是文本`);
        break;
      }
      const strValue = value as string;
      if (
        variable.validation?.minLength &&
        strValue.length < variable.validation.minLength
      ) {
        errors.push(
          `变量 "${variable.label}" 最少需要 ${variable.validation.minLength} 个字符`,
        );
      }
      if (
        variable.validation?.maxLength &&
        strValue.length > variable.validation.maxLength
      ) {
        errors.push(
          `变量 "${variable.label}" 最多允许 ${variable.validation.maxLength} 个字符`,
        );
      }
      if (variable.validation?.pattern) {
        const regex = new RegExp(variable.validation.pattern);
        if (!regex.test(strValue)) {
          errors.push(`变量 "${variable.label}" 格式不正确`);
        }
      }
      break;
    }

    case "number": {
      const numValue = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(numValue)) {
        errors.push(`变量 "${variable.label}" 必须是数字`);
        break;
      }
      if (
        variable.validation?.min !== undefined &&
        numValue < variable.validation.min
      ) {
        errors.push(
          `变量 "${variable.label}" 不能小于 ${variable.validation.min}`,
        );
      }
      if (
        variable.validation?.max !== undefined &&
        numValue > variable.validation.max
      ) {
        errors.push(
          `变量 "${variable.label}" 不能大于 ${variable.validation.max}`,
        );
      }
      break;
    }

    case "select": {
      if (!variable.options?.some((opt) => opt.value === value)) {
        errors.push(`变量 "${variable.label}" 的值无效`);
      }
      break;
    }

    case "multiselect": {
      if (!Array.isArray(value)) {
        errors.push(`变量 "${variable.label}" 必须是数组`);
        break;
      }
      const invalidValues = (value as string[]).filter(
        (v) => !variable.options?.some((opt) => opt.value === v),
      );
      if (invalidValues.length > 0) {
        errors.push(
          `变量 "${variable.label}" 包含无效值: ${invalidValues.join(", ")}`,
        );
      }
      break;
    }

    case "boolean": {
      if (typeof value !== "boolean") {
        errors.push(`变量 "${variable.label}" 必须是布尔值`);
      }
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Prompt 编译器实现
// ============================================================================

/**
 * Prompt 编译器
 *
 * @example
 * ```typescript
 * const compiler = new PromptCompiler();
 *
 * // 编译模板
 * const prompt = compiler.compile(template, {
 *   topic: 'AI 技术',
 *   tone: 'professional',
 * });
 *
 * // 预览结果
 * const preview = compiler.preview(template, variables);
 * console.log(`预计 Token: ${preview.estimatedTokens}`);
 * ```
 */
export class PromptCompiler implements IPromptCompiler {
  /**
   * 编译模板为最终 Prompt
   */
  compile(
    template: CustomTemplate,
    variableValues: Record<string, unknown>,
  ): string {
    // 验证变量
    const validation = this.validateVariables(template, variableValues);
    if (!validation.valid) {
      logger.warn(
        { templateId: template.id, errors: validation.errors },
        "Template compilation with invalid variables",
      );
    }

    // 按顺序拼接 prompt 部分
    const sections = template.promptSections
      .filter((section) => {
        // 检查条件部分是否应该包含
        if (!section.required) {
          // 检查是否有关联变量决定是否显示
          const conditionalMatch = section.content.match(/\{\{#if\s+(\w+)\}\}/);
          if (conditionalMatch) {
            const conditionVar = conditionalMatch[1];
            return Boolean(variableValues[conditionVar]);
          }
        }
        return true;
      })
      .sort((a, b) => a.order - b.order)
      .map((section) => this.processSection(section.content, variableValues));

    let prompt = sections.join("\n\n");

    // 添加输出格式指引
    if (template.outputFormat) {
      prompt += `\n\n## 输出格式\n${template.outputFormat}`;
    }

    return prompt.trim();
  }

  /**
   * 处理单个 section 的变量替换
   */
  private processSection(
    content: string,
    variableValues: Record<string, unknown>,
  ): string {
    let result = content;

    // 处理条件块 {{#if variable}}...{{/if}}
    result = result.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_match, variable, innerContent) => {
        const value = variableValues[variable];
        if (value && value !== false && value !== "") {
          return innerContent;
        }
        return "";
      },
    );

    // 处理反向条件块 {{#unless variable}}...{{/unless}}
    result = result.replace(
      /\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
      (_match, variable, innerContent) => {
        const value = variableValues[variable];
        if (!value || value === false || value === "") {
          return innerContent;
        }
        return "";
      },
    );

    // 处理循环 {{#each array}}...{{/each}}
    result = result.replace(
      /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (_match, variable, innerContent) => {
        const value = variableValues[variable];
        if (!Array.isArray(value)) {
          return "";
        }
        return value
          .map((item, index) => {
            let itemContent = innerContent;
            // 替换 {{this}} 为当前项
            itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
            // 替换 {{@index}} 为索引
            itemContent = itemContent.replace(
              /\{\{@index\}\}/g,
              String(index + 1),
            );
            return itemContent;
          })
          .join("\n");
      },
    );

    // 简单变量替换 {{variable}}
    for (const [key, value] of Object.entries(variableValues)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      let replacement: string;

      if (Array.isArray(value)) {
        replacement = value.join("、");
      } else if (typeof value === "boolean") {
        replacement = value ? "是" : "否";
      } else {
        replacement = String(value ?? "");
      }

      result = result.replace(placeholder, replacement);
    }

    // 清理未替换的变量占位符
    result = result.replace(/\{\{[^}]+\}\}/g, "");

    // 清理多余的空行
    result = result.replace(/\n{3,}/g, "\n\n");

    return result.trim();
  }

  /**
   * 验证变量值
   */
  validateVariables(
    template: CustomTemplate,
    variableValues: Record<string, unknown>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const variable of template.variables) {
      const value = variableValues[variable.name];
      const result = validateVariableValue(variable, value);
      errors.push(...result.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 预览编译结果
   */
  preview(
    template: CustomTemplate,
    variableValues: Record<string, unknown>,
  ): { prompt: string; estimatedTokens: number } {
    // 使用默认值填充未提供的变量
    const filledValues: Record<string, unknown> = { ...variableValues };

    for (const variable of template.variables) {
      if (
        !(variable.name in filledValues) &&
        variable.defaultValue !== undefined
      ) {
        filledValues[variable.name] = variable.defaultValue;
      }
    }

    const prompt = this.compile(template, filledValues);
    const estimatedTokens = estimateTokens(prompt);

    logger.debug(
      { templateId: template.id, tokenCount: estimatedTokens },
      "Template preview generated",
    );

    return {
      prompt,
      estimatedTokens,
    };
  }
}

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建 Prompt 编译器实例
 */
export function createPromptCompiler(): IPromptCompiler {
  return new PromptCompiler();
}

// 保留旧名称以兼容
export { PromptCompiler as PromptCompilerStub };
