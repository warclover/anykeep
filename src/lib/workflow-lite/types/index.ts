export interface LiteLogger {
  info: (message: string, data?: unknown) => void;
  error: (message: string, error?: unknown) => void;
  step: (
    name: string,
    status: "start" | "success" | "failed",
    data?: unknown,
  ) => void;
}

export interface LiteContext {
  logger: LiteLogger;
  traceId: string;
  executionTime: number; // Timestamp when task started
  userId?: string; // Optional context for user-specific tasks
}

export type LiteTask<T = void> = (ctx: LiteContext) => Promise<T>;

export interface TaskResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  durationMs: number;
}
