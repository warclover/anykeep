/**
 * AI Agent 抽象基类
 *
 * 定义 Agent 的通用接口和行为
 * 支持多种 Agent 类型的扩展
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import type {
  AgentContext,
  AgentExecuteOptions,
  AgentExecuteResult,
  AgentStreamChunk,
  AgentConfig,
} from "./types";
import { AgentMemory } from "./agent-memory";
import { logger } from "@/lib/logger";

/**
 * Agent 执行策略接口
 */
export interface AgentExecutionStrategy {
  /** 策略名称 */
  name: string;

  /**
   * 执行 Agent 任务
   */
  execute(
    input: string,
    context: AgentContext,
    options: AgentExecuteOptions,
    agent: BaseAgent,
  ): Promise<AgentExecuteResult>;

  /**
   * 流式执行 Agent 任务
   */
  executeStream(
    input: string,
    context: AgentContext,
    options: AgentExecuteOptions,
    agent: BaseAgent,
  ): AsyncGenerator<AgentStreamChunk>;
}

/**
 * Agent 生命周期钩子
 */
export interface AgentLifecycleHooks {
  /** 执行前钩子 */
  beforeExecute?: (input: string, context: AgentContext) => Promise<void>;

  /** 执行后钩子 */
  afterExecute?: (
    result: AgentExecuteResult,
    context: AgentContext,
  ) => Promise<void>;

  /** 错误钩子 */
  onError?: (error: Error, context: AgentContext) => Promise<void>;

  /** 工具调用前钩子 */
  beforeToolCall?: (toolName: string, args: unknown) => Promise<unknown>;

  /** 工具调用后钩子 */
  afterToolCall?: (toolName: string, result: unknown) => Promise<unknown>;
}

/**
 * 抽象 Agent 基类
 *
 * 提供 Agent 的通用功能：
 * - 配置管理
 * - 会话记忆
 * - 生命周期钩子
 * - 日志记录
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected memory: AgentMemory;
  protected hooks: AgentLifecycleHooks;
  protected log = logger.child({ namespace: "agent" });

  constructor(
    config: AgentConfig,
    memory: AgentMemory = new AgentMemory(),
    hooks: AgentLifecycleHooks = {},
  ) {
    this.config = config;
    this.memory = memory;
    this.hooks = hooks;
    this.log = logger.child({ namespace: `agent:${config.type}` });
  }

  /**
   * 获取 Agent 配置
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * 获取 Agent 类型
   */
  getType(): string {
    return this.config.type;
  }

  /**
   * 获取 Agent 名称
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * 获取会话记忆
   */
  getMemory(): AgentMemory {
    return this.memory;
  }

  /**
   * 设置生命周期钩子
   */
  setHooks(hooks: Partial<AgentLifecycleHooks>): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  /**
   * 执行 Agent（非流式）
   *
   * @param input - 用户输入
   * @param context - 执行上下文
   * @param options - 执行选项
   */
  abstract execute(
    input: string,
    context: AgentContext,
    options?: Partial<AgentExecuteOptions>,
  ): Promise<AgentExecuteResult>;

  /**
   * 流式执行 Agent
   *
   * @param input - 用户输入
   * @param context - 执行上下文
   * @param options - 执行选项
   */
  abstract executeStream(
    input: string,
    context: AgentContext,
    options?: Partial<AgentExecuteOptions>,
  ): AsyncGenerator<AgentStreamChunk>;

  /**
   * 准备执行上下文
   *
   * 子类可重写以添加自定义上下文准备逻辑
   */
  protected async prepareContext(context: AgentContext): Promise<AgentContext> {
    return context;
  }

  /**
   * 处理执行错误
   *
   * 子类可重写以添加自定义错误处理逻辑
   */
  protected async handleError(
    error: Error,
    context: AgentContext,
  ): Promise<void> {
    this.log.error(
      { error: error.message, stack: error.stack, userId: context.userId },
      "Agent execution error",
    );

    if (this.hooks.onError) {
      await this.hooks.onError(error, context);
    }
  }
}

/**
 * Agent 工厂接口
 */
export interface AgentFactory {
  /**
   * 创建 Agent 实例
   *
   * @param type - Agent 类型
   * @param options - 创建选项
   */
  create(type: string, options?: Partial<AgentConfig>): BaseAgent;

  /**
   * 注册 Agent 类型
   *
   * @param type - Agent 类型名称
   * @param factory - 创建函数
   */
  register(type: string, factory: () => BaseAgent): void;

  /**
   * 获取所有已注册的 Agent 类型
   */
  getRegisteredTypes(): string[];
}

/**
 * 简单的 Agent 工厂实现
 */
export class SimpleAgentFactory implements AgentFactory {
  private factories = new Map<string, () => BaseAgent>();

  create(type: string, _options?: Partial<AgentConfig>): BaseAgent {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Unknown agent type: ${type}`);
    }
    return factory();
  }

  register(type: string, factory: () => BaseAgent): void {
    this.factories.set(type, factory);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.factories.keys());
  }
}
