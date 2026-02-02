import type { Bookmark } from "@/types/bookmark";
import type {
  OperationContext,
  OperationResult,
  OperationStep,
} from "../types";
import { snapshotManager } from "./snapshot-manager";

type OperationCallback = (context: OperationContext) => void;

class OperationExecutor {
  private activeOperations: Map<string, OperationContext> = new Map();
  private subscribers: Map<string, Set<OperationCallback>> = new Map();

  /**
   * 执行操作
   */
  async execute(
    action: string,
    selection: Bookmark[],
    params?: Record<string, unknown>,
  ): Promise<OperationResult> {
    const operationId = crypto.randomUUID();

    const context: OperationContext = {
      operationId,
      userId: "", // 将在后续步骤中填充
      action,
      selection,
      steps: this.buildSteps(action),
      startedAt: new Date(),
      isCancelled: false,
    };

    this.activeOperations.set(operationId, context);
    this.notifySubscribers(operationId);

    try {
      // Step 1: 创建快照
      this.updateStepStatus(context, 0, "running");
      this.notifySubscribers(operationId);

      await snapshotManager.createSnapshot(
        operationId,
        selection.map((b) => ({ type: "bookmark", id: b.id, data: b })),
      );

      this.updateStepStatus(context, 0, "completed");
      this.notifySubscribers(operationId);

      // Step 2: 模拟 AI 思考延迟
      this.updateStepStatus(context, 1, "running");
      this.notifySubscribers(operationId);

      await this.simulateThinking();

      this.updateStepStatus(context, 1, "completed");
      this.notifySubscribers(operationId);

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

        // TODO: 执行实际操作（调用对应的 Tool/Skill）
        await this.executeAction(action, bookmark, params);

        affectedCount++;

        // 更新进度
        context.steps[2].progress = Math.round(
          ((i + 1) / selection.length) * 100,
        );
        this.notifySubscribers(operationId);
      }

      this.updateStepStatus(context, 2, "completed");
      this.notifySubscribers(operationId);

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
      // 清理
      setTimeout(() => {
        this.activeOperations.delete(operationId);
        this.subscribers.delete(operationId);
      }, 60000); // 1 分钟后清理
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
    const delay = 300 + Math.random() * 200; // 300-500ms
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async executeAction(
    _action: string,
    _bookmark: Bookmark,
    _params?: Record<string, unknown>,
  ): Promise<void> {
    // TODO: 根据 action 调用对应的 Tool/Skill
    // 这里先用模拟延迟代替
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private notifySubscribers(operationId: string): void {
    const context = this.activeOperations.get(operationId);
    if (!context) return;

    this.subscribers.get(operationId)?.forEach((callback) => {
      try {
        callback({ ...context });
      } catch (error) {
        console.error("[OperationExecutor] Subscriber callback failed:", error);
      }
    });
  }
}

export const operationExecutor = new OperationExecutor();
