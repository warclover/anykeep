/**
 * InputPreprocessor - 输入预处理模块
 *
 * 职责：
 * - 输入验证和清洗
 * - 解析指代词（通过 MemoryManager）
 * - 记录用户消息
 * - 生成记忆块
 *
 * 从 UnifiedEngine 中拆分，遵循单一职责原则
 *
 * @version 1.1.0
 * @since 2025-12-26
 */

import { logger } from "@/lib/logger";
import type { MemoryManager, ReferenceResolutionResult } from "../../ai-memory";
import type { UnifiedStreamChunk } from "../output/types";
import type { EngineContext } from "./types";
import type { InputValidator } from "./input-validator";
import {
  createInputValidator,
  type InputValidatorConfig,
} from "./input-validator";

// ============================================
// 类型定义
// ============================================

/**
 * 预处理结果
 */
export interface PreprocessResult {
  /** 处理后的输入（指代词已替换） */
  processedInput: string;
  /** 指代解析结果 */
  resolution: ReferenceResolutionResult | null;
  /** 记忆块（如果有变化需要发送给客户端） */
  memoryChunk: UnifiedStreamChunk | null;
  /** 验证警告 */
  validationWarnings: string[];
  /** 输入是否被修改 */
  inputWasModified: boolean;
}

/**
 * InputPreprocessor 配置
 */
export interface InputPreprocessorConfig {
  /** 输入验证配置 */
  validatorConfig?: InputValidatorConfig;
  /** 是否启用调试模式 */
  debug?: boolean;
}

// ============================================
// InputPreprocessor 类
// ============================================

/**
 * 输入预处理器
 *
 * 处理用户输入的预处理逻辑，包括：
 * 1. 输入验证和清洗
 * 2. 确保会话存在
 * 3. 解析指代词
 * 4. 记录用户消息
 * 5. 生成记忆块通知前端
 */
export class InputPreprocessor {
  private validator: InputValidator;
  private debug: boolean;

  constructor(
    private memoryManager: MemoryManager,
    config: InputPreprocessorConfig = {},
  ) {
    this.validator = createInputValidator(config.validatorConfig);
    this.debug = config.debug ?? false;
  }

  /**
   * 预处理用户输入
   *
   * @param input - 原始用户输入
   * @param context - 引擎上下文
   * @param enableMemory - 是否启用记忆功能
   * @returns 预处理结果
   */
  preprocess(
    input: string,
    context: EngineContext,
    enableMemory: boolean,
  ): PreprocessResult {
    // 1. 输入验证和清洗
    const validationResult = this.validator.validate(input);

    if (!validationResult.valid) {
      // 输入无效，返回错误状态
      if (this.debug) {
        logger.warn(
          { error: validationResult.error },
          "InputPreprocessor: Input validation failed",
        );
      }
      return {
        processedInput: validationResult.sanitizedInput || "",
        resolution: null,
        memoryChunk: null,
        validationWarnings: validationResult.warnings,
        inputWasModified: validationResult.wasModified,
      };
    }

    const sanitizedInput = validationResult.sanitizedInput;

    // 如果记忆功能未启用或没有会话 ID，直接返回清洗后的输入
    if (!enableMemory || !context.conversationId) {
      return {
        processedInput: sanitizedInput,
        resolution: null,
        memoryChunk: null,
        validationWarnings: validationResult.warnings,
        inputWasModified: validationResult.wasModified,
      };
    }

    // 2. 确保会话存在
    this.memoryManager.getOrCreateSession(
      context.conversationId,
      context.userId,
    );

    // 3. 预处理输入（解析指代词）
    const preprocessResult = this.memoryManager.preprocessInput(
      sanitizedInput,
      context.conversationId,
    );

    // 4. 记录用户消息（使用原始输入，保留用户原意）
    this.memoryManager.recordUserMessage(
      context.conversationId,
      context.userId,
      input,
    );

    // 5. 生成记忆块（如果有变化）
    let memoryChunk: UnifiedStreamChunk | null = null;
    if (preprocessResult.hasChanges) {
      if (this.debug) {
        logger.debug(
          {
            original: sanitizedInput.substring(0, 100),
            processed: preprocessResult.processedInput.substring(0, 100),
            referenceCount: preprocessResult.resolution?.references.length || 0,
          },
          "InputPreprocessor: Reference resolution applied",
        );
      }

      memoryChunk = {
        type: "memory",
        data: {
          resolved: true,
          originalInput: sanitizedInput,
          resolvedInput: preprocessResult.processedInput,
          referenceCount: preprocessResult.resolution?.references.length || 0,
          referenceTypes:
            preprocessResult.resolution?.references.map((r) => r.type) || [],
        },
      };
    }

    return {
      processedInput: preprocessResult.processedInput,
      resolution: preprocessResult.resolution,
      memoryChunk,
      validationWarnings: validationResult.warnings,
      inputWasModified:
        validationResult.wasModified || preprocessResult.hasChanges,
    };
  }

  /**
   * 获取 MemoryManager 实例
   *
   * 用于其他模块需要访问记忆管理器时
   */
  getMemoryManager(): MemoryManager {
    return this.memoryManager;
  }

  /**
   * 获取 InputValidator 实例
   */
  getValidator(): InputValidator {
    return this.validator;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建 InputPreprocessor 实例
 */
export function createInputPreprocessor(
  memoryManager: MemoryManager,
  config?: InputPreprocessorConfig,
): InputPreprocessor {
  return new InputPreprocessor(memoryManager, config);
}
