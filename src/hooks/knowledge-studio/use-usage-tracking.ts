/**
 * Usage Tracking Hook for Knowledge Studio
 * @module hooks/knowledge-studio/use-usage-tracking
 *
 * Provides a unified interface for recording blueprint usage statistics.
 * Handles fire-and-forget API calls with proper error suppression.
 */

import { useCallback } from "react";

/**
 * Usage record parameters
 */
export interface UsageRecordParams {
  /** Blueprint ID */
  blueprintId: string;
  /** Whether the operation was successful */
  success: boolean;
  /** Platform style (wechat, xiaohongshu, general) */
  platformStyle?: string;
  /** Length mode (short, medium, long) */
  lengthMode?: string;
}

/**
 * Hook for tracking blueprint usage
 *
 * @example
 * ```typescript
 * const { recordUsage } = useUsageTracking();
 *
 * // Record successful usage
 * recordUsage({ blueprintId: 'geek-arxiv', success: true, platformStyle: 'wechat' });
 *
 * // Record failed usage (await if needed)
 * await recordUsage({ blueprintId: 'geek-arxiv', success: false }, { await: true });
 * ```
 */
export function useUsageTracking() {
  /**
   * Record usage statistics
   *
   * @param params - Usage record parameters
   * @param options - Options for the record call
   * @param options.await - If true, returns a promise that resolves when the call completes
   */
  const recordUsage = useCallback(
    (
      params: UsageRecordParams,
      options?: { await?: boolean },
    ): Promise<void> | void => {
      const doRecord = async (): Promise<void> => {
        try {
          await fetch("/api/knowledge-studio/v2/usage/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blueprintId: params.blueprintId,
              success: params.success,
              platformStyle: params.platformStyle,
              lengthMode: params.lengthMode ?? "medium",
            }),
          });
        } catch {
          // Silently ignore usage tracking errors
          // This is intentional - usage tracking should never block user operations
        }
      };

      if (options?.await) {
        return doRecord();
      }

      // Fire-and-forget mode (default)
      void doRecord();
    },
    [],
  );

  return { recordUsage };
}

/**
 * Standalone function for recording usage (for non-React contexts)
 *
 * @param params - Usage record parameters
 * @returns Promise that resolves when the call completes
 */
export async function recordBlueprintUsage(
  params: UsageRecordParams,
): Promise<void> {
  try {
    await fetch("/api/knowledge-studio/v2/usage/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blueprintId: params.blueprintId,
        success: params.success,
        platformStyle: params.platformStyle,
        lengthMode: params.lengthMode ?? "medium",
      }),
    });
  } catch {
    // Silently ignore usage tracking errors
  }
}
