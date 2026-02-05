/**
 * BackendConfirmationAdapter - 后端确认适配器
 *
 * 用于 Skills 执行时的自动确认决策：
 * - 低风险操作：自动确认执行
 * - 高风险操作：返回需要用户确认
 *
 * 这解决了 Agent/Skills 确认系统的隔离问题：
 * - Agent 使用交互式 RequireConfirmation（通过 Tool 系统）
 * - Skills 使用 BackendConfirmationAdapter（后端自动决策）
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { logger } from "@/lib/logger";
import {
  confirmationHandler,
  type ConfirmationRequestOptions,
  type ConfirmationResult,
  type PendingConfirmation,
} from "./confirmation-handler";

// ============================================
// 类型定义
// ============================================

/**
 * 操作类型
 */
export type OperationType =
  | "read" // 只读操作
  | "create" // 创建
  | "update" // 更新
  | "delete" // 删除
  | "move" // 移动
  | "batch_read" // 批量读取
  | "batch_create" // 批量创建
  | "batch_update" // 批量更新
  | "batch_delete" // 批量删除
  | "batch_move" // 批量移动
  | "export"; // 导出

/**
 * 风险等级
 */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/**
 * 确认决策输入
 */
export interface ConfirmationDecisionInput {
  /** 操作类型 */
  operationType: OperationType;
  /** 受影响的数量 */
  affectedCount: number;
  /** 手动指定风险等级（可选，覆盖自动计算） */
  riskLevel?: RiskLevel;
  /** 操作描述 */
  description?: string;
  /** 是否是可逆操作 */
  reversible?: boolean;
  /** 用户 ID */
  userId?: string;
  /** Skill ID */
  skillId?: string;
}

/**
 * 确认决策结果
 */
export interface ConfirmationDecision {
  /** 是否需要用户确认 */
  requiresUserConfirmation: boolean;
  /** 计算出的风险等级 */
  riskLevel: RiskLevel;
  /** 决策原因 */
  reason: string;
  /** 如果自动确认，返回确认结果 */
  autoConfirmResult?: ConfirmationResult;
  /** 如果需要用户确认，返回待确认对象 */
  pendingConfirmation?: PendingConfirmation;
}

/**
 * 自动确认策略配置
 */
export interface AutoConfirmPolicy {
  /** 允许自动确认的最大影响数量 */
  maxAutoConfirmCount: number;
  /** 允许自动确认的操作类型 */
  autoConfirmOperations: OperationType[];
  /** 是否允许自动确认删除操作 */
  allowAutoDelete: boolean;
  /** 是否允许自动确认批量操作 */
  allowAutoBatch: boolean;
  /** 自动确认的最高风险等级 */
  maxAutoConfirmRiskLevel: RiskLevel;
}

// ============================================
// 默认配置
// ============================================

/**
 * 默认自动确认策略
 *
 * 保守策略：
 * - 只自动确认读取和导出操作
 * - 单条更新操作在可逆时可自动确认
 * - 删除操作始终需要确认
 * - 批量操作始终需要确认
 */
const DEFAULT_POLICY: AutoConfirmPolicy = {
  maxAutoConfirmCount: 10,
  autoConfirmOperations: [
    "read",
    "batch_read",
    "export",
    "create", // 创建通常是安全的
  ],
  allowAutoDelete: false,
  allowAutoBatch: false,
  maxAutoConfirmRiskLevel: "low",
};

/**
 * 操作类型到基础风险等级映射
 */
const OPERATION_RISK_MAP: Record<OperationType, RiskLevel> = {
  read: "low",
  batch_read: "low",
  export: "low",
  create: "low",
  update: "medium",
  move: "medium",
  batch_create: "medium",
  batch_update: "high",
  batch_move: "high",
  delete: "high",
  batch_delete: "critical",
};

/**
 * 风险等级权重（用于比较）
 */
const RISK_LEVEL_WEIGHT: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ============================================
// 后端确认适配器
// ============================================

/**
 * 后端确认适配器
 *
 * @example
 * ```typescript
 * const adapter = new BackendConfirmationAdapter();
 *
 * // 评估是否需要用户确认
 * const decision = adapter.evaluate({
 *   operationType: 'batch_delete',
 *   affectedCount: 5,
 *   description: '删除 5 条书签',
 * });
 *
 * if (decision.requiresUserConfirmation) {
 *   // 需要用户确认，返回确认请求
 *   yield* emitConfirmation(decision.pendingConfirmation!);
 * } else {
 *   // 自动确认，直接执行
 *   await executeOperation();
 * }
 * ```
 */
export class BackendConfirmationAdapter {
  private policy: AutoConfirmPolicy;

  constructor(policy: Partial<AutoConfirmPolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  /**
   * 评估操作是否需要用户确认
   *
   * @param input - 确认决策输入
   * @returns 确认决策结果
   */
  async evaluate(
    input: ConfirmationDecisionInput,
  ): Promise<ConfirmationDecision> {
    const riskLevel = this.calculateRiskLevel(input);
    const requiresConfirmation = this.shouldRequireConfirmation(
      input,
      riskLevel,
    );

    logger.debug(
      {
        operationType: input.operationType,
        affectedCount: input.affectedCount,
        riskLevel,
        requiresConfirmation,
      },
      "BackendConfirmationAdapter: 评估确认需求",
    );

    if (requiresConfirmation) {
      // 需要用户确认
      const pendingConfirmation = await this.createPendingConfirmation(
        input,
        riskLevel,
      );
      return {
        requiresUserConfirmation: true,
        riskLevel,
        reason: this.getConfirmationReason(input, riskLevel),
        pendingConfirmation,
      };
    }

    // 自动确认
    return {
      requiresUserConfirmation: false,
      riskLevel,
      reason: "低风险操作，自动确认",
      autoConfirmResult: {
        confirmed: true,
        selectedOption: "auto_confirm",
        status: "confirmed",
        contextData: input.description
          ? { description: input.description }
          : undefined,
      },
    };
  }

  /**
   * 快捷方法：检查是否需要用户确认
   */
  async shouldRequireUserConfirmation(
    input: ConfirmationDecisionInput,
  ): Promise<boolean> {
    const result = await this.evaluate(input);
    return result.requiresUserConfirmation;
  }

  /**
   * 快捷方法：自动确认并返回结果
   */
  autoConfirm(contextData?: Record<string, unknown>): ConfirmationResult {
    return {
      confirmed: true,
      selectedOption: "auto_confirm",
      status: "confirmed",
      contextData,
    };
  }

  /**
   * 创建用户确认请求
   *
   * @param options - 确认请求选项
   * @returns 待确认对象
   */
  async requestUserConfirmation(
    options: ConfirmationRequestOptions,
  ): Promise<PendingConfirmation> {
    return confirmationHandler.createConfirmation(options);
  }

  /**
   * 等待用户确认
   *
   * @param confirmationId - 确认 ID
   * @returns 确认结果
   */
  waitForUserConfirmation(confirmationId: string): Promise<ConfirmationResult> {
    return confirmationHandler.waitForConfirmation(confirmationId);
  }

  /**
   * 更新策略
   */
  updatePolicy(policy: Partial<AutoConfirmPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  /**
   * 获取当前策略
   */
  getPolicy(): Readonly<AutoConfirmPolicy> {
    return { ...this.policy };
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(input: ConfirmationDecisionInput): RiskLevel {
    // 如果手动指定了风险等级，直接使用
    if (input.riskLevel) {
      return input.riskLevel;
    }

    // 获取基础风险等级
    let riskLevel = OPERATION_RISK_MAP[input.operationType] || "medium";

    // 根据影响数量调整
    if (input.affectedCount > 100) {
      riskLevel = this.elevateRiskLevel(riskLevel);
    } else if (input.affectedCount > 50) {
      if (riskLevel !== "critical") {
        riskLevel = this.elevateRiskLevel(riskLevel);
      }
    }

    // 不可逆操作提升风险
    if (input.reversible === false && riskLevel !== "critical") {
      riskLevel = this.elevateRiskLevel(riskLevel);
    }

    return riskLevel;
  }

  /**
   * 提升风险等级
   */
  private elevateRiskLevel(level: RiskLevel): RiskLevel {
    switch (level) {
      case "low":
        return "medium";
      case "medium":
        return "high";
      case "high":
      case "critical":
        return "critical";
    }
  }

  /**
   * 检查是否需要用户确认
   */
  private shouldRequireConfirmation(
    input: ConfirmationDecisionInput,
    riskLevel: RiskLevel,
  ): boolean {
    // 检查风险等级是否超过自动确认阈值
    if (
      RISK_LEVEL_WEIGHT[riskLevel] >
      RISK_LEVEL_WEIGHT[this.policy.maxAutoConfirmRiskLevel]
    ) {
      return true;
    }

    // 检查影响数量
    if (input.affectedCount > this.policy.maxAutoConfirmCount) {
      return true;
    }

    // 检查操作类型是否在自动确认列表中
    if (!this.policy.autoConfirmOperations.includes(input.operationType)) {
      // 删除操作特殊处理
      if (
        input.operationType === "delete" ||
        input.operationType === "batch_delete"
      ) {
        return !this.policy.allowAutoDelete;
      }

      // 批量操作特殊处理
      if (input.operationType.startsWith("batch_")) {
        return !this.policy.allowAutoBatch;
      }

      return true;
    }

    return false;
  }

  /**
   * 创建待确认对象
   */
  private async createPendingConfirmation(
    input: ConfirmationDecisionInput,
    riskLevel: RiskLevel,
  ): Promise<PendingConfirmation> {
    const options = this.getConfirmationOptions(riskLevel);
    const title = this.getConfirmationTitle(input);
    const message = this.getConfirmationMessage(input, riskLevel);

    return confirmationHandler.createConfirmation({
      title,
      message,
      options,
      contextData: {
        operationType: input.operationType,
        affectedCount: input.affectedCount,
        riskLevel,
        description: input.description,
      },
      skillId: input.skillId,
      userId: input.userId,
    });
  }

  /**
   * 获取确认选项
   */
  private getConfirmationOptions(riskLevel: RiskLevel) {
    const isDangerous = riskLevel === "high" || riskLevel === "critical";

    return [
      {
        id: "confirm",
        label: isDangerous ? "确认执行" : "确认",
        primary: true,
        danger: isDangerous,
      },
      {
        id: "cancel",
        label: "取消",
      },
    ];
  }

  /**
   * 获取确认标题
   */
  private getConfirmationTitle(input: ConfirmationDecisionInput): string {
    const operationLabels: Record<OperationType, string> = {
      read: "读取",
      batch_read: "批量读取",
      export: "导出",
      create: "创建",
      update: "更新",
      move: "移动",
      batch_create: "批量创建",
      batch_update: "批量更新",
      batch_move: "批量移动",
      delete: "删除",
      batch_delete: "批量删除",
    };

    return `确认${operationLabels[input.operationType]}操作`;
  }

  /**
   * 获取确认消息
   */
  private getConfirmationMessage(
    input: ConfirmationDecisionInput,
    riskLevel: RiskLevel,
  ): string {
    const parts: string[] = [];

    if (input.description) {
      parts.push(input.description);
    } else {
      parts.push(`此操作将影响 ${input.affectedCount} 个项目`);
    }

    if (riskLevel === "high" || riskLevel === "critical") {
      parts.push("此操作无法撤销，请谨慎操作。");
    }

    return parts.join("\n\n");
  }

  /**
   * 获取需要确认的原因
   */
  private getConfirmationReason(
    input: ConfirmationDecisionInput,
    riskLevel: RiskLevel,
  ): string {
    const reasons: string[] = [];

    if (
      RISK_LEVEL_WEIGHT[riskLevel] >
      RISK_LEVEL_WEIGHT[this.policy.maxAutoConfirmRiskLevel]
    ) {
      reasons.push(`风险等级 (${riskLevel}) 超过自动确认阈值`);
    }

    if (input.affectedCount > this.policy.maxAutoConfirmCount) {
      reasons.push(
        `影响数量 (${input.affectedCount}) 超过自动确认限制 (${this.policy.maxAutoConfirmCount})`,
      );
    }

    if (
      (input.operationType === "delete" ||
        input.operationType === "batch_delete") &&
      !this.policy.allowAutoDelete
    ) {
      reasons.push("删除操作需要用户确认");
    }

    if (
      input.operationType.startsWith("batch_") &&
      !this.policy.allowAutoBatch
    ) {
      reasons.push("批量操作需要用户确认");
    }

    return reasons.join("; ") || "需要用户确认";
  }
}

// ============================================
// 工厂函数和单例
// ============================================

/**
 * 创建后端确认适配器
 */
export function createBackendConfirmationAdapter(
  policy?: Partial<AutoConfirmPolicy>,
): BackendConfirmationAdapter {
  return new BackendConfirmationAdapter(policy);
}

/**
 * 默认后端确认适配器实例
 */
export const backendConfirmationAdapter = new BackendConfirmationAdapter();
