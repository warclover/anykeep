import type { LiteContext, LiteTask, TaskResult } from "../types";
import { createLogger } from "./logger";

// Simple in-memory deduplication map for short-term idempotency checks
// Key: dedupKey, Value: timestamp
const executionHistory = new Map<string, number>();
const DEDUP_WINDOW_MS = 60 * 1000; // 1 minute window

function generateTraceId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15);
}

export async function runLiteTask<T>(
  taskName: string,
  dedupKey: string | null,
  taskLogic: LiteTask<T>,
  contextData: Partial<LiteContext> = {},
): Promise<TaskResult<T>> {
  // 1. Idempotency Check (Simple memory-based for now)
  if (dedupKey) {
    const lastRun = executionHistory.get(dedupKey);
    const now = Date.now();

    // Clean up old keys occasionally could be added here,
    // but for now relying on runtime restart or minimal memory usage

    if (lastRun && now - lastRun < DEDUP_WINDOW_MS) {
      console.info(
        `[LITE:${taskName}] Skipping duplicate execution for key: ${dedupKey}`,
      );
      return {
        success: true, // Treat as success to stop retries from caller
        durationMs: 0,
        data: undefined,
      } as unknown as TaskResult<T>;
    }
    executionHistory.set(dedupKey, now);
  }

  const startTime = Date.now();
  const traceId = generateTraceId();
  const logger = createLogger(taskName, traceId);

  const ctx: LiteContext = {
    logger,
    traceId,
    executionTime: startTime,
    ...contextData,
  };

  try {
    logger.info(`Starting task execution`);

    const data = await taskLogic(ctx);

    const durationMs = Date.now() - startTime;
    logger.info(`Task completed successfully in ${durationMs}ms`);

    return {
      success: true,
      data,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error(`Task failed after ${durationMs}ms`, error);

    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      durationMs,
    };
  }
}
