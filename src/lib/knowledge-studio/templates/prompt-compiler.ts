/**
 * Knowledge Studio - Prompt 编译器
 * @module knowledge-studio/templates
 * @description Phase 3 存根 - 模板变量插值与 Prompt 编译
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 *
 * TODO Phase 3: 完整实现
 * - 变量插值
 * - 条件逻辑
 * - 循环语法
 * - Token 估算
 */

import { logger } from "@/lib/logger";
import type { IPromptCompiler, CustomTemplate } from "./types";

// ============================================================================
// 存根实现
// ============================================================================

/**
 * Prompt 编译器（Phase 3 存根）
 *
 * @example
 * ```typescript
 * const compiler = new PromptCompilerStub();
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
export class PromptCompilerStub implements IPromptCompiler {
  /**
   * 编译模板为最终 Prompt
   * @stub 返回简单拼接，Phase 3 实现完整编译
   */
  compile(
    template: CustomTemplate,
    variableValues: Record<string, unknown>,
  ): string {
    logger.info(`[PromptCompiler] compile(${template.name}) - Phase 3 存根`);

    // 简单拼接所有 prompt 部分
    const sections = template.promptSections
      .sort((a, b) => a.order - b.order)
      .map((section) => section.content);

    let prompt = sections.join("\n\n");

    // 简单变量替换
    for (const [key, value] of Object.entries(variableValues)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, "g"), String(value));
    }

    return prompt;
  }

  /**
   * 验证变量值
   * @stub 始终返回有效，Phase 3 实现完整验证
   */
  validateVariables(
    template: CustomTemplate,
    variableValues: Record<string, unknown>,
  ): { valid: boolean; errors: string[] } {
    logger.info(
      `[PromptCompiler] validateVariables(${template.name}) - Phase 3 存根`,
    );

    const errors: string[] = [];

    // 检查必填变量
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in variableValues)) {
        errors.push(`变量 "${variable.label}" 是必填项`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 预览编译结果
   * @stub 返回简单估算，Phase 3 实现精确计算
   */
  preview(
    template: CustomTemplate,
    variableValues: Record<string, unknown>,
  ): { prompt: string; estimatedTokens: number } {
    logger.info(`[PromptCompiler] preview(${template.name}) - Phase 3 存根`);

    const prompt = this.compile(template, variableValues);

    // 简单估算：约 4 字符 = 1 token (中文约 2 字符 = 1 token)
    const estimatedTokens = Math.ceil(prompt.length / 3);

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
 * @stub Phase 3 实现完整编译器
 */
export function createPromptCompiler(): IPromptCompiler {
  return new PromptCompilerStub();
}
