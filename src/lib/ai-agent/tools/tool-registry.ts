/**
 * Tool 注册表
 *
 * 管理所有 AI Tools 的注册、查询和导出
 *
 * @version 2.1.0 - 高风险操作确认拦截
 * @since 2025-12-23
 * @updated 2025-12-29 添加 riskLevel 统计和扩展分类支持
 * @updated 2026-01-06 添加工具调用事件发射 (P2-3)
 * @updated 2026-01-09 添加 ConfirmationInterceptor 集成 (Phase 1)
 */

import { z } from "zod";
import { tool as createAITool, zodSchema, type ToolSet } from "ai";
import type {
  Tool,
  ToolCategory,
  ToolRiskLevel,
  ToolRegistryStats,
  ToolSummary,
  ToolContext,
  ToolResult,
} from "./types";
import { extractReasoning, inferRiskLevel } from "./types";
import { logger } from "@/lib/logger";
import { toolEventEmitter } from "./events/tool-event-emitter";
import { confirmationInterceptor } from "../safety/confirmation-interceptor";
import { FeatureFlags } from "../config/feature-flags";

/**
 * Tool 注册表类
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * 注册 Tool
   */
  register<TParams, TResult>(tool: Tool<TParams, TResult>): void {
    const name = tool.definition.name;

    if (this.tools.has(name)) {
      logger.warn(
        { toolName: name },
        "ToolRegistry: Overwriting existing tool",
      );
    }

    this.tools.set(name, tool as Tool);

    logger.info(
      {
        toolName: name,
        category: tool.definition.category,
      },
      "ToolRegistry: Tool registered",
    );
  }

  /**
   * 批量注册 Tools
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerAll(tools: Tool<any, any>[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * 获取 Tool
   */
  get<TParams = unknown, TResult = unknown>(
    name: string,
  ): Tool<TParams, TResult> | undefined {
    return this.tools.get(name) as Tool<TParams, TResult> | undefined;
  }

  /**
   * 检查 Tool 是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 获取所有 Tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 按分类获取 Tools
   */
  getByCategory(category: ToolCategory): Tool[] {
    return this.getAll().filter(
      (tool) => tool.definition.category === category,
    );
  }

  /**
   * 获取 Tool 名称列表
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取 Tool 简要信息列表
   */
  getSummaries(): ToolSummary[] {
    return this.getAll().map((tool) => ({
      name: tool.definition.name,
      description: tool.definition.description,
      category: tool.definition.category,
      riskLevel: inferRiskLevel(tool.definition),
      requiresConfirmation: tool.definition.requiresConfirmation ?? false,
    }));
  }

  /**
   * 获取统计信息
   */
  getStats(): ToolRegistryStats {
    const byCategory: Record<ToolCategory, number> = {
      query: 0,
      read: 0,
      action: 0,
      search: 0,
      analysis: 0,
      export: 0,
      system: 0,
    };

    const byRiskLevel: Record<ToolRiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
    };

    for (const tool of this.tools.values()) {
      byCategory[tool.definition.category]++;
      byRiskLevel[inferRiskLevel(tool.definition)]++;
    }

    return {
      totalTools: this.tools.size,
      byCategory,
      byRiskLevel,
    };
  }

  /**
   * 执行 Tool
   */
  async execute<TResult = unknown>(
    name: string,
    params: unknown,
    context: ToolContext,
  ): Promise<ToolResult<TResult>> {
    const tool = this.get(name);

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${name}`,
        errorCode: "TOOL_NOT_FOUND",
      };
    }

    const startTime = performance.now();
    const toolCategory = tool.definition.category;
    const riskLevel = inferRiskLevel(tool.definition);
    const requiresConfirmation = tool.definition.requiresConfirmation ?? false;

    // 发射工具调用开始事件
    toolEventEmitter.emitCallStarted({
      userId: context.userId,
      toolName: name,
      toolCategory,
      requiresConfirmation,
      riskLevel,
      params: params as Record<string, unknown> | undefined,
    });

    try {
      // 验证参数
      const validatedParams = tool.definition.parameters.parse(params);

      // 提取并记录 reasoning（隐式思考链）
      const reasoning = extractReasoning(validatedParams);
      if (reasoning) {
        logger.debug(
          {
            toolName: name,
            userId: context.userId,
            reasoning,
          },
          "ToolRegistry: Tool reasoning captured",
        );
      }

      // 高风险操作确认拦截（Phase 1 Feature Flag 控制）
      if (FeatureFlags.ENABLE_CONFIRMATION_INTERCEPTOR) {
        const interceptResult = await confirmationInterceptor.intercept(
          tool,
          validatedParams as Record<string, unknown>,
          context,
        );

        if (interceptResult.intercepted && interceptResult.confirmation) {
          const executionTimeMs = Math.round(performance.now() - startTime);

          // 发射工具调用拦截事件
          toolEventEmitter.emitCallCompleted({
            userId: context.userId,
            toolName: name,
            toolCategory,
            success: true,
            durationMs: executionTimeMs,
            resultSummary: `操作需要确认: ${interceptResult.reason || "高风险操作"}`,
            errorMessage: undefined,
            errorCode: undefined,
            retryable: false,
          });

          logger.info(
            {
              toolName: name,
              userId: context.userId,
              confirmationId: interceptResult.confirmation.confirmationId,
              riskLevel: interceptResult.confirmation.riskLevel,
            },
            "ToolRegistry: Tool execution intercepted for confirmation",
          );

          // 返回确认等待结果
          return confirmationInterceptor.createConfirmationResult(
            interceptResult.confirmation,
          ) as ToolResult<TResult>;
        }
      }

      // 执行 Tool
      const result = await tool.execute(validatedParams, context);

      const executionTimeMs = Math.round(performance.now() - startTime);

      // 添加执行时间到元数据
      if (result.success) {
        result.metadata = {
          ...result.metadata,
          executionTimeMs,
        };
      }

      // 发射工具调用完成事件
      toolEventEmitter.emitCallCompleted({
        userId: context.userId,
        toolName: name,
        toolCategory,
        success: result.success,
        durationMs: executionTimeMs,
        resultSummary: result.success
          ? this.generateResultSummary(name, result.data)
          : undefined,
        errorMessage: result.success ? undefined : result.error,
        errorCode: result.success ? undefined : result.errorCode,
        retryable: result.success
          ? undefined
          : this.isRetryableError(result.errorCode),
      });

      logger.info(
        {
          toolName: name,
          userId: context.userId,
          success: result.success,
          executionTimeMs,
        },
        "ToolRegistry: Tool executed",
      );

      return result as ToolResult<TResult>;
    } catch (error) {
      const executionTimeMs = Math.round(performance.now() - startTime);

      // Zod 验证错误
      if (error instanceof z.ZodError) {
        logger.warn(
          {
            toolName: name,
            userId: context.userId,
            validationErrors: error.issues,
          },
          "ToolRegistry: Parameter validation failed",
        );

        // 发射工具调用完成事件（验证失败）
        toolEventEmitter.emitCallCompleted({
          userId: context.userId,
          toolName: name,
          toolCategory,
          success: false,
          durationMs: executionTimeMs,
          errorMessage: `参数验证失败: ${error.issues.map((e) => e.message).join(", ")}`,
          errorCode: "VALIDATION_ERROR",
          retryable: false,
        });

        return {
          success: false,
          error: `参数验证失败: ${error.issues.map((e) => e.message).join(", ")}`,
          errorCode: "VALIDATION_ERROR",
          metadata: { executionTimeMs },
        };
      }

      // 其他错误
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: name,
          userId: context.userId,
          error: errorMessage,
        },
        "ToolRegistry: Tool execution failed",
      );

      // 发射工具调用完成事件（执行失败）
      toolEventEmitter.emitCallCompleted({
        userId: context.userId,
        toolName: name,
        toolCategory,
        success: false,
        durationMs: executionTimeMs,
        errorMessage,
        errorCode: "EXECUTION_ERROR",
        retryable: true,
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: "EXECUTION_ERROR",
        metadata: { executionTimeMs },
      };
    }
  }

  /**
   * 生成结果摘要
   */
  private generateResultSummary(toolName: string, data: unknown): string {
    if (!data) return "操作成功";

    // 尝试从常见字段提取摘要
    if (typeof data === "object" && data !== null) {
      const obj = data as Record<string, unknown>;

      if (Array.isArray(obj)) {
        return `返回 ${obj.length} 条结果`;
      }
      if ("count" in obj && typeof obj.count === "number") {
        return `统计: ${obj.count} 条`;
      }
      if ("total" in obj && typeof obj.total === "number") {
        return `共 ${obj.total} 条`;
      }
      if ("message" in obj && typeof obj.message === "string") {
        return obj.message;
      }
      if ("name" in obj && typeof obj.name === "string") {
        return `操作对象: ${obj.name}`;
      }
    }

    return `${toolName} 执行成功`;
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(errorCode?: string): boolean {
    const retryableCodes = [
      "RATE_LIMIT",
      "TOO_MANY_REQUESTS",
      "NETWORK_ERROR",
      "DB_ERROR",
      "TIMEOUT",
      "EXECUTION_ERROR",
    ];
    return errorCode ? retryableCodes.includes(errorCode) : true;
  }

  /**
   * 转换为 Vercel AI SDK tools 格式
   *
   * 使用 AI SDK 的 tool() 函数确保 Zod schema 正确转换为 JSON Schema
   */
  getAsVercelTools(context: ToolContext): ToolSet {
    const vercelTools: ToolSet = {};

    for (const tool of this.tools.values()) {
      // 使用 Vercel AI SDK 的 tool 函数来正确创建 Tool
      // 使用 zodSchema() 将 Zod schema 转换为 AI SDK Schema
      vercelTools[tool.definition.name] = createAITool({
        description: tool.definition.description,
        inputSchema: zodSchema(tool.definition.parameters),
        execute: async (args) => {
          // 提取并记录 reasoning（隐式思考链）
          const reasoning = extractReasoning(args);
          if (reasoning) {
            logger.debug(
              {
                toolName: tool.definition.name,
                userId: context.userId,
                reasoning,
              },
              "ToolRegistry (Vercel): Tool reasoning captured",
            );
          }

          const result = await this.execute(
            tool.definition.name,
            args,
            context,
          );
          if (result.success) {
            // 检测搜索工具执行成功，记录搜索结果到会话
            if (
              tool.definition.category === "search" &&
              context.onSearchResults
            ) {
              const searchData = result.data as {
                query?: string;
                results?: Array<{ id: number }>;
              };
              if (searchData.query && Array.isArray(searchData.results)) {
                const resultIds = searchData.results.map((r) => r.id);
                context.onSearchResults({
                  query: searchData.query,
                  resultIds,
                });
                logger.debug(
                  {
                    toolName: tool.definition.name,
                    query: searchData.query,
                    resultCount: resultIds.length,
                  },
                  "ToolRegistry: Search results recorded to session",
                );
              }
            }
            return result.data;
          }
          throw new Error(result.error);
        },
      });
    }

    return vercelTools;
  }

  /**
   * 清空注册表
   */
  clear(): void {
    this.tools.clear();
    logger.info({}, "ToolRegistry: Cleared all tools");
  }
}

/**
 * 全局 Tool 注册表实例
 */
export const toolRegistry = new ToolRegistry();
