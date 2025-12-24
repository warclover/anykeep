/**
 * OrchestrationEngine - 编排执行引擎
 *
 * 职责：
 * - 管理编排 Skills 的注册
 * - 执行编排 Skills
 * - 处理执行错误和回退
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import type { SkillContext } from "../core/types";
import type {
  OrchestrationSkill,
  OrchestrationContext,
} from "../orchestration";
import type { OrchestrationStreamChunk } from "../output/types";
import type { EngineContext, OrchestrationEngineConfig } from "./types";

/**
 * 编排引擎
 */
export class OrchestrationEngine {
  private skills: Map<string, OrchestrationSkill<unknown, unknown>> = new Map();
  private config: Required<OrchestrationEngineConfig>;

  constructor(config: OrchestrationEngineConfig = {}) {
    this.config = {
      defaultTimeoutMs: 30000,
      maxConcurrentSkills: 1,
      enableAutoFallback: true,
      ...config,
    };
  }

  /**
   * 注册编排 Skill
   */
  register(skill: OrchestrationSkill<unknown, unknown>): void {
    const skillId = skill.metadata.id;

    if (this.skills.has(skillId)) {
      logger.warn(
        { skillId },
        "OrchestrationEngine: Skill already registered, overwriting",
      );
    }

    this.skills.set(skillId, skill);

    logger.info(
      {
        skillId,
        skillName: skill.metadata.name,
        category: skill.metadata.category,
      },
      "OrchestrationEngine: Skill registered",
    );
  }

  /**
   * 注销编排 Skill
   */
  unregister(skillId: string): boolean {
    const removed = this.skills.delete(skillId);

    if (removed) {
      logger.info({ skillId }, "OrchestrationEngine: Skill unregistered");
    }

    return removed;
  }

  /**
   * 获取编排 Skill
   */
  getSkill(skillId: string): OrchestrationSkill<unknown, unknown> | undefined {
    return this.skills.get(skillId);
  }

  /**
   * 检查 Skill 是否已注册
   */
  hasSkill(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  /**
   * 获取所有已注册的 Skill ID
   */
  getRegisteredSkillIds(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * 执行编排 Skill
   *
   * @param skillId - Skill ID
   * @param input - 用户输入
   * @param context - 引擎上下文
   * @yields 编排流式输出块
   */
  async *execute(
    skillId: string,
    input: string,
    context: EngineContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const skill = this.skills.get(skillId);

    if (!skill) {
      yield {
        type: "error",
        data: {
          message: `Orchestration skill not found: ${skillId}`,
          code: "SKILL_NOT_FOUND",
          retryable: false,
        },
      };
      return;
    }

    const startTime = performance.now();

    logger.info(
      {
        skillId,
        skillName: skill.metadata.name,
        userId: context.userId,
        traceId: context.traceId,
      },
      "OrchestrationEngine: Starting skill execution",
    );

    try {
      // 创建 Skill 上下文
      const skillContext: SkillContext = {
        userId: context.userId,
        conversationId: context.conversationId,
        bookmarkIds: context.bookmarkIds,
        folderId: context.folderId,
        traceId: context.traceId,
        debug: context.debug,
      };

      // 解析输入参数
      const orchestrationContext: OrchestrationContext = {
        ...skillContext,
        params: null, // 将在 parseInput 后设置
        originalMessage: input,
      };

      const params = await skill.parseInput(input, orchestrationContext);
      orchestrationContext.params = params;

      // 执行 Skill
      for await (const chunk of skill.executeStream(orchestrationContext)) {
        // 检查是否已取消
        if (context.signal?.aborted) {
          yield {
            type: "error",
            data: {
              message: "Execution cancelled",
              code: "CANCELLED",
              retryable: false,
            },
          };
          return;
        }

        yield chunk;
      }

      const durationMs = Math.round(performance.now() - startTime);

      logger.info(
        {
          skillId,
          durationMs,
          traceId: context.traceId,
        },
        "OrchestrationEngine: Skill execution completed",
      );
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);

      logger.error(
        {
          skillId,
          error: error instanceof Error ? error.message : String(error),
          durationMs,
          traceId: context.traceId,
        },
        "OrchestrationEngine: Skill execution failed",
      );

      yield {
        type: "error",
        data: {
          message:
            error instanceof Error ? error.message : "Skill execution failed",
          code: "EXECUTION_ERROR",
          retryable: this.config.enableAutoFallback,
        },
      };
    }
  }

  /**
   * 获取 Skill 元数据
   */
  getSkillMetadata(skillId: string) {
    const skill = this.skills.get(skillId);
    return skill?.metadata;
  }

  /**
   * 获取所有 Skill 元数据
   */
  getAllSkillMetadata() {
    return Array.from(this.skills.values()).map((skill) => skill.metadata);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<OrchestrationEngineConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * 创建编排引擎实例
 */
export function createOrchestrationEngine(
  config?: OrchestrationEngineConfig,
): OrchestrationEngine {
  return new OrchestrationEngine(config);
}

/**
 * 默认编排引擎实例
 */
export const orchestrationEngine = new OrchestrationEngine();
