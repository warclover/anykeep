import type { Bookmark } from "@/types/bookmark";
import type {
  OperationContext,
  OperationResult,
  OperationStep,
} from "../types";
import { snapshotManager } from "./snapshot-manager";
import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

type OperationCallback = (context: OperationContext) => void;

// 常量配置
const OPERATION_CONFIG = {
  CLEANUP_DELAY: 60000, // 1分钟后清理
  THINKING_MIN: 300,
  THINKING_MAX: 500,
  NOTIFY_THROTTLE: 100, // 通知节流间隔
} as const;

class OperationExecutor {
  private activeOperations: Map<string, OperationContext> = new Map();
  private subscribers: Map<string, Set<OperationCallback>> = new Map();
  private userOperationLock: Set<string> = new Set(); // 用户级操作锁
  private lastNotifyTime: Map<string, number> = new Map(); // 通知节流

  /**
   * 执行操作
   */
  async execute(
    action: string,
    selection: Bookmark[],
    params?: Record<string, unknown>,
  ): Promise<OperationResult> {
    // 获取用户 ID
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        operationId: "",
        affectedCount: 0,
        error: "User not authenticated",
      };
    }

    // 检查用户是否有进行中的操作（防止竞态）
    if (this.userOperationLock.has(user.id)) {
      return {
        success: false,
        operationId: "",
        affectedCount: 0,
        error: "Another operation is in progress",
      };
    }

    // 加锁
    this.userOperationLock.add(user.id);
    const operationId = crypto.randomUUID();

    const context: OperationContext = {
      operationId,
      userId: user.id,
      action,
      selection,
      steps: this.buildSteps(action),
      startedAt: new Date(),
      isCancelled: false,
    };

    this.activeOperations.set(operationId, context);
    this.notifySubscribersThrottled(operationId);

    try {
      // Step 1: 创建快照
      this.updateStepStatus(context, 0, "running");
      this.notifySubscribersThrottled(operationId);

      await snapshotManager.createSnapshot(
        operationId,
        selection.map((b) => ({ type: "bookmark", id: b.id, data: b })),
      );

      this.updateStepStatus(context, 0, "completed");
      this.notifySubscribersThrottled(operationId);

      // Step 2: 模拟 AI 思考延迟
      this.updateStepStatus(context, 1, "running");
      this.notifySubscribersThrottled(operationId);

      await this.simulateThinking();

      this.updateStepStatus(context, 1, "completed");
      this.notifySubscribersThrottled(operationId);

      // Step 3: 执行操作
      this.updateStepStatus(context, 2, "running");

      let affectedCount = 0;

      for (let i = 0; i < selection.length; i++) {
        // 检查取消
        if (context.isCancelled) {
          await snapshotManager.rollback(operationId);
          return {
            success: false,
            operationId,
            affectedCount: i,
            error: "Operation cancelled",
          };
        }

        const bookmark = selection[i];

        // TODO(@backlog): 执行实际操作（调用对应的 Tool/Skill）
        await this.executeAction(action, bookmark, params);

        affectedCount++;

        // 更新进度
        context.steps[2].progress = Math.round(
          ((i + 1) / selection.length) * 100,
        );
        this.notifySubscribersThrottled(operationId);
      }

      this.updateStepStatus(context, 2, "completed");
      this.notifySubscribers(operationId); // 最终状态强制通知

      return { success: true, operationId, affectedCount };
    } catch (error) {
      // 操作失败，自动回滚
      await snapshotManager.rollback(operationId);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        operationId,
        affectedCount: 0,
        error: errorMessage,
      };
    } finally {
      // 释放用户锁
      this.userOperationLock.delete(user.id);

      // 延迟清理操作记录
      setTimeout(() => {
        this.activeOperations.delete(operationId);
        this.subscribers.delete(operationId);
        this.lastNotifyTime.delete(operationId);
      }, OPERATION_CONFIG.CLEANUP_DELAY);
    }
  }

  /**
   * 取消操作
   */
  async cancel(operationId: string): Promise<void> {
    const context = this.activeOperations.get(operationId);
    if (context) {
      context.isCancelled = true;
      this.notifySubscribers(operationId);
    }
  }

  /**
   * 获取操作状态
   */
  getStatus(operationId: string): OperationContext | null {
    return this.activeOperations.get(operationId) || null;
  }

  /**
   * 订阅操作状态变化
   */
  subscribe(operationId: string, callback: OperationCallback): () => void {
    if (!this.subscribers.has(operationId)) {
      this.subscribers.set(operationId, new Set());
    }
    this.subscribers.get(operationId)?.add(callback);

    return () => {
      this.subscribers.get(operationId)?.delete(callback);
    };
  }

  /**
   * 检查是否有活跃操作
   */
  hasActiveOperation(): boolean {
    return this.activeOperations.size > 0;
  }

  private buildSteps(action: string): OperationStep[] {
    return [
      { id: "snapshot", name: "保存状态", status: "pending" },
      { id: "analyze", name: "分析内容", status: "pending" },
      {
        id: "execute",
        name: `执行${this.getActionLabel(action)}`,
        status: "pending",
      },
    ];
  }

  private getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      translate_batch: "翻译",
      generate_summary: "摘要生成",
      deduplicate: "去重",
      smart_archive: "归档",
      smart_tagging: "标签",
    };
    return labels[action] || "操作";
  }

  private updateStepStatus(
    context: OperationContext,
    stepIndex: number,
    status: OperationStep["status"],
  ): void {
    if (context.steps[stepIndex]) {
      context.steps[stepIndex].status = status;
    }
  }

  private async simulateThinking(): Promise<void> {
    const delay =
      OPERATION_CONFIG.THINKING_MIN +
      Math.random() *
        (OPERATION_CONFIG.THINKING_MAX - OPERATION_CONFIG.THINKING_MIN);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async executeAction(
    _action: string,
    _bookmark: Bookmark,
    _params?: Record<string, unknown>,
  ): Promise<void> {
    // TODO(@backlog): 根据 action 调用对应的 Tool/Skill
    // 这里先用模拟延迟代替
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * 带节流的通知（避免频繁重渲染）
   */
  private notifySubscribersThrottled(operationId: string): void {
    const now = Date.now();
    const lastTime = this.lastNotifyTime.get(operationId) || 0;

    if (now - lastTime < OPERATION_CONFIG.NOTIFY_THROTTLE) {
      return; // 节流期内跳过
    }

    this.lastNotifyTime.set(operationId, now);
    this.notifySubscribers(operationId);
  }

  private notifySubscribers(operationId: string): void {
    const context = this.activeOperations.get(operationId);
    if (!context) return;

    this.subscribers.get(operationId)?.forEach((callback) => {
      try {
        callback({ ...context });
      } catch (error) {
        logger.error(
          { error },
          "[OperationExecutor] Subscriber callback failed:",
        );
      }
    });
  }
}

export const operationExecutor = new OperationExecutor();
