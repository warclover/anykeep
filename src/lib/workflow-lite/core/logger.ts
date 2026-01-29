import type { LiteLogger } from "../types";

export function createLogger(taskName: string, traceId: string): LiteLogger {
  const prefix = `[LITE:${taskName}] [${traceId}]`;

  return {
    info: (message: string, data?: unknown) => {
      if (data) {
        console.info(`${prefix} ${message}`, JSON.stringify(data, null, 2));
      } else {
        console.info(`${prefix} ${message}`);
      }
    },
    error: (message: string, error?: unknown) => {
      console.error(`${prefix} ERROR: ${message}`, error);
    },
    step: (
      stepName: string,
      status: "start" | "success" | "failed",
      data?: unknown,
    ) => {
      const icon =
        status === "success" ? "✅" : status === "failed" ? "❌" : "⏳";
      const dataStr = data ? ` ${JSON.stringify(data)}` : "";
      console.info(
        `${prefix} ${icon} Step: ${stepName} -> ${status.toUpperCase()}${dataStr}`,
      );
    },
  };
}
