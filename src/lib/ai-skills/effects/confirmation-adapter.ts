/**
 * ConfirmationAdapter - 确认适配器
 *
 * 统一 Tool 和 Skill 确认请求的处理，提供一致的 API
 *
 * 职责：
 * - 将 Tool 确认包装为统一的 ConfirmationEffect
 * - 将 Skill 确认包装为统一的 ConfirmationEffect
 * - 转换为统一的流式输出块格式
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import type { UnifiedStreamChunk } from "../output/types";
import type {
  ConfirmationEffect,
  ConfirmOption,
  EffectContext,
  ToolConfirmationConfig,
  SkillConfirmationConfig,
} from "./types";

// ============================================
// 默认配置
// ============================================

/**
 * 默认超时时间（5 分钟）
 */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * 默认确认选项
 */
const DEFAULT_OPTIONS: ConfirmOption[] = [
  { id: "confirm", label: "确认", variant: "default", isDefault: true },
  { id: "cancel", label: "取消", variant: "outline" },
];

// ============================================
// ConfirmationAdapter 实现
// ============================================

/**
 * 确认适配器
 *
 * 提供统一的确认请求创建和转换功能
 *
 * @example
 * ```typescript
 * const context: EffectContext = {
 *   requestId: 'req_123',
 *   userId: 'user_456',
 *   mode: 'atomic',
 *   source: 'tool',
 * };
 *
 * const adapter = new ConfirmationAdapter(context);
 *
 * // 创建 Tool 确认
 * const toolConfirm = adapter.wrapToolConfirmation('delete_bookmark', { id: 'bm_1' }, {
 *   title: '删除书签',
 *   message: '确定要删除这条书签吗？',
 * });
 *
 * // 转换为流式块
 * const chunk = adapter.toStreamChunk(toolConfirm);
 * ```
 */
export class ConfirmationAdapter {
  private context: EffectContext;

  constructor(context: EffectContext) {
    this.context = context;
  }

  /**
   * 将 Tool 确认包装为统一的 ConfirmationEffect
   *
   * @param toolName - Tool 名称
   * @param params - Tool 参数
   * @param config - 确认配置
   * @returns ConfirmationEffect
   */
  wrapToolConfirmation(
    toolName: string,
    params: unknown,
    config: ToolConfirmationConfig,
  ): ConfirmationEffect {
    const confirmationId = this.generateId();

    logger.debug(
      {
        confirmationId,
        toolName,
        mode: this.context.mode,
      },
      "ConfirmationAdapter: 创建 Tool 确认",
    );

    return {
      type: "confirmation",
      payload: {
        id: confirmationId,
        title: config.title,
        message: config.message,
        options: config.options ?? DEFAULT_OPTIONS,
        preview: config.preview,
        timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
        metadata: {
          toolName,
          params,
          source: "tool",
        },
      },
      context: {
        ...this.context,
        source: "tool",
      },
    };
  }

  /**
   * 将 Skill 确认包装为统一的 ConfirmationEffect
   *
   * @param config - Skill 确认配置
   * @returns ConfirmationEffect
   */
  wrapSkillConfirmation(config: SkillConfirmationConfig): ConfirmationEffect {
    const confirmationId = this.generateId();

    logger.debug(
      {
        confirmationId,
        skillId: config.skillId,
        stepIndex: config.stepIndex,
        mode: this.context.mode,
      },
      "ConfirmationAdapter: 创建 Skill 确认",
    );

    return {
      type: "confirmation",
      payload: {
        id: confirmationId,
        title: config.title,
        message: config.message,
        options: config.options ?? DEFAULT_OPTIONS,
        preview: config.preview,
        timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
        metadata: {
          skillId: config.skillId,
          stepIndex: config.stepIndex,
          totalSteps: config.totalSteps,
          source: "skill",
        },
      },
      context: {
        ...this.context,
        source: "skill",
      },
    };
  }

  /**
   * 转换为统一的流式输出块
   *
   * @param effect - ConfirmationEffect
   * @returns UnifiedStreamChunk
   */
  toStreamChunk(effect: ConfirmationEffect): UnifiedStreamChunk {
    return {
      type: "confirmation",
      data: {
        id: effect.payload.id,
        title: effect.payload.title,
        message: effect.payload.message,
        options: effect.payload.options.map((opt) => ({
          id: opt.id,
          label: opt.label,
          description: opt.description,
          primary: opt.isDefault,
          danger: opt.variant === "destructive",
        })),
        preview: effect.payload.preview,
        timeout: effect.payload.timeout,
      },
    };
  }

  /**
   * 从 ConfirmationEffect 提取元数据
   *
   * @param effect - ConfirmationEffect
   * @returns 元数据对象
   */
  extractMetadata(effect: ConfirmationEffect): {
    source: "tool" | "skill";
    mode: "atomic" | "orchestration";
    toolName?: string;
    skillId?: string;
    stepIndex?: number;
  } {
    const metadata = effect.payload.metadata ?? {};

    return {
      source: effect.context.source,
      mode: effect.context.mode,
      toolName: metadata.toolName as string | undefined,
      skillId: metadata.skillId as string | undefined,
      stepIndex: metadata.stepIndex as number | undefined,
    };
  }

  /**
   * 更新上下文
   *
   * @param updates - 要更新的上下文字段
   */
  updateContext(updates: Partial<EffectContext>): void {
    this.context = { ...this.context, ...updates };
  }

  /**
   * 获取当前上下文
   */
  getContext(): EffectContext {
    return { ...this.context };
  }

  /**
   * 生成确认 ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `confirm_${timestamp}_${random}`;
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建确认适配器
 *
 * @param context - Effect 上下文
 * @returns ConfirmationAdapter 实例
 */
export function createConfirmationAdapter(
  context: EffectContext,
): ConfirmationAdapter {
  return new ConfirmationAdapter(context);
}

/**
 * 创建 Tool 模式的确认适配器
 *
 * @param requestId - 请求 ID
 * @param userId - 用户 ID
 * @param conversationId - 会话 ID（可选）
 * @returns ConfirmationAdapter 实例
 */
export function createToolConfirmationAdapter(
  requestId: string,
  userId: string,
  conversationId?: string,
): ConfirmationAdapter {
  return new ConfirmationAdapter({
    requestId,
    userId,
    conversationId,
    mode: "atomic",
    source: "tool",
  });
}

/**
 * 创建 Skill 模式的确认适配器
 *
 * @param requestId - 请求 ID
 * @param userId - 用户 ID
 * @param conversationId - 会话 ID（可选）
 * @returns ConfirmationAdapter 实例
 */
export function createSkillConfirmationAdapter(
  requestId: string,
  userId: string,
  conversationId?: string,
): ConfirmationAdapter {
  return new ConfirmationAdapter({
    requestId,
    userId,
    conversationId,
    mode: "orchestration",
    source: "skill",
  });
}
