/**
 * Cost Monitor Service (V4.2)
 * LLM 使用成本监控服务
 *
 * 核心功能：
 * - 记录 LLM API 调用
 * - 监控每日/每月成本
 * - 成本预警通知
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ============================================
// Type Definitions
// ============================================

/**
 * LLM operation type
 */
export type LLMOperation =
  | "classification"
  | "folder_naming"
  | "content_analysis"
  | "chat"
  | "embedding"
  | "summarization";

/**
 * Model pricing (per 1M tokens in cents)
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o-mini": { input: 15, output: 60 },
  "gpt-4o": { input: 250, output: 1000 },
  "gpt-4-turbo": { input: 1000, output: 3000 },

  // DeepSeek
  "deepseek-chat": { input: 14, output: 28 },
  "deepseek-reasoner": { input: 55, output: 219 },

  // Alibaba
  "qwen-plus": { input: 50, output: 150 },
  "qwen-turbo": { input: 20, output: 60 },

  // Embedding models
  "text-embedding-v3": { input: 7, output: 0 },
  "text-embedding-3-small": { input: 2, output: 0 },
};

/**
 * Usage record request
 */
export interface RecordUsageRequest {
  userId: string;
  operation: LLMOperation;
  model: string;
  inputTokens: number;
  outputTokens: number;
  requestId?: string;
  executionTimeMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Usage summary
 */
export interface UsageSummary {
  totalCalls: number;
  totalTokens: number;
  totalCostCents: number;
  byOperation: Record<
    string,
    { calls: number; tokens: number; costCents: number }
  >;
  byModel: Record<string, { calls: number; tokens: number; costCents: number }>;
}

/**
 * Cost alert config
 */
interface CostAlertConfig {
  dailyLimitCents: number;
  monthlyLimitCents: number;
  alertThreshold: number; // 0.8 = alert at 80% of limit
}

const DEFAULT_COST_ALERT: CostAlertConfig = {
  dailyLimitCents: 500, // $5/day
  monthlyLimitCents: 5000, // $50/month
  alertThreshold: 0.8,
};

// ============================================
// CostMonitorService Class
// ============================================

export class CostMonitorService {
  private supabase: Awaited<
    ReturnType<typeof createServerSupabaseClient>
  > | null = null;

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createServerSupabaseClient();
    }
    return this.supabase;
  }

  /**
   * Record LLM usage
   */
  async recordUsage(request: RecordUsageRequest): Promise<number | null> {
    try {
      const supabase = await this.getSupabase();

      // Calculate cost
      const costCents = this.calculateCost(
        request.model,
        request.inputTokens,
        request.outputTokens,
      );

      const { data, error } = await supabase.rpc("record_llm_usage", {
        p_user_id: request.userId,
        p_operation: request.operation,
        p_model: request.model,
        p_input_tokens: request.inputTokens,
        p_output_tokens: request.outputTokens,
        p_cost_cents: costCents,
        p_request_id: request.requestId || null,
        p_execution_time_ms: request.executionTimeMs || null,
        p_metadata: request.metadata || {},
      });

      if (error) {
        logger.error(
          { error: error.message },
          "CostMonitor: Failed to record usage",
        );
        return null;
      }

      // Check if we need to send cost alert
      await this.checkCostAlert(request.userId);

      logger.debug(
        {
          userId: request.userId.slice(0, 8) + "...",
          operation: request.operation,
          model: request.model,
          tokens: request.inputTokens + request.outputTokens,
          costCents,
        },
        "CostMonitor: Usage recorded",
      );

      return data;
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "CostMonitor: Exception while recording usage",
      );
      return null;
    }
  }

  /**
   * Calculate cost in cents
   */
  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const pricing = MODEL_PRICING[model];

    if (!pricing) {
      // Default pricing for unknown models
      return Math.ceil((inputTokens + outputTokens) * 0.00003 * 100); // ~$0.03/1K tokens
    }

    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;

    return Math.ceil(inputCost + outputCost);
  }

  /**
   * Get user's daily cost
   */
  async getDailyCost(
    userId: string,
    date?: Date,
  ): Promise<{
    totalCalls: number;
    totalTokens: number;
    totalCostCents: number;
  }> {
    const supabase = await this.getSupabase();
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("get_user_daily_llm_cost", {
      p_user_id: userId,
      p_date: dateStr,
    });

    if (error || !data || data.length === 0) {
      return { totalCalls: 0, totalTokens: 0, totalCostCents: 0 };
    }

    return {
      totalCalls: data[0].total_calls || 0,
      totalTokens: data[0].total_tokens || 0,
      totalCostCents: data[0].total_cost_cents || 0,
    };
  }

  /**
   * Get user's monthly cost
   */
  async getMonthlyCost(userId: string, month?: string): Promise<UsageSummary> {
    const supabase = await this.getSupabase();
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    const { data, error } = await supabase
      .from("llm_usage_monthly")
      .select("*")
      .eq("user_id", userId)
      .eq("month", targetMonth)
      .single();

    if (error || !data) {
      return {
        totalCalls: 0,
        totalTokens: 0,
        totalCostCents: 0,
        byOperation: {},
        byModel: {},
      };
    }

    return {
      totalCalls: data.call_count,
      totalTokens: data.total_tokens,
      totalCostCents: data.total_cost_cents,
      byOperation: {
        classification: {
          calls: data.classification_calls,
          tokens: 0,
          costCents: 0,
        },
        folder_naming: { calls: data.naming_calls, tokens: 0, costCents: 0 },
        content_analysis: {
          calls: data.analysis_calls,
          tokens: 0,
          costCents: 0,
        },
        chat: { calls: data.chat_calls, tokens: 0, costCents: 0 },
      },
      byModel: {},
    };
  }

  /**
   * Get detailed usage breakdown
   */
  async getUsageBreakdown(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<UsageSummary> {
    const supabase = await this.getSupabase();

    const { data, error } = await supabase
      .from("llm_usage_log")
      .select("operation, model, input_tokens, output_tokens, cost_cents")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    if (error || !data) {
      return {
        totalCalls: 0,
        totalTokens: 0,
        totalCostCents: 0,
        byOperation: {},
        byModel: {},
      };
    }

    const byOperation: Record<
      string,
      { calls: number; tokens: number; costCents: number }
    > = {};
    const byModel: Record<
      string,
      { calls: number; tokens: number; costCents: number }
    > = {};

    let totalTokens = 0;
    let totalCostCents = 0;

    for (const row of data) {
      const tokens = row.input_tokens + row.output_tokens;
      totalTokens += tokens;
      totalCostCents += row.cost_cents;

      // By operation
      if (!byOperation[row.operation]) {
        byOperation[row.operation] = { calls: 0, tokens: 0, costCents: 0 };
      }
      byOperation[row.operation].calls++;
      byOperation[row.operation].tokens += tokens;
      byOperation[row.operation].costCents += row.cost_cents;

      // By model
      if (!byModel[row.model]) {
        byModel[row.model] = { calls: 0, tokens: 0, costCents: 0 };
      }
      byModel[row.model].calls++;
      byModel[row.model].tokens += tokens;
      byModel[row.model].costCents += row.cost_cents;
    }

    return {
      totalCalls: data.length,
      totalTokens,
      totalCostCents,
      byOperation,
      byModel,
    };
  }

  /**
   * Check if cost alert should be sent
   */
  private async checkCostAlert(userId: string): Promise<void> {
    try {
      const config = DEFAULT_COST_ALERT;
      const daily = await this.getDailyCost(userId);

      // Check daily limit
      if (
        daily.totalCostCents >=
        config.dailyLimitCents * config.alertThreshold
      ) {
        logger.warn(
          {
            userId: userId.slice(0, 8) + "...",
            dailyCostCents: daily.totalCostCents,
            limitCents: config.dailyLimitCents,
          },
          "CostMonitor: Daily cost alert threshold reached",
        );

        // TODO: Send notification to user
        // await MessageService.notifyCostAlert(userId, 'daily', daily.totalCostCents);
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "CostMonitor: Failed to check cost alert",
      );
    }
  }

  /**
   * Wrapper function for LLM calls with automatic cost tracking
   */
  async trackLLMCall<T>(
    userId: string,
    operation: LLMOperation,
    model: string,
    callFn: () => Promise<{
      result: T;
      usage: { inputTokens: number; outputTokens: number };
    }>,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const { result, usage } = await callFn();

      // Record usage asynchronously
      void this.recordUsage({
        userId,
        operation,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        executionTimeMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      // Still try to record the failed call
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "CostMonitor: LLM call failed",
      );
      throw error;
    }
  }

  /**
   * Get estimated monthly cost based on current usage
   */
  async getEstimatedMonthlyCost(userId: string): Promise<{
    currentCostCents: number;
    estimatedMonthlyCents: number;
    daysRemaining: number;
  }> {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const daysRemaining = daysInMonth - dayOfMonth;

    const monthlyUsage = await this.getMonthlyCost(userId);
    const dailyAverage =
      dayOfMonth > 0 ? monthlyUsage.totalCostCents / dayOfMonth : 0;
    const estimatedMonthlyCents = Math.round(dailyAverage * daysInMonth);

    return {
      currentCostCents: monthlyUsage.totalCostCents,
      estimatedMonthlyCents,
      daysRemaining,
    };
  }
}

// Export singleton
export const costMonitorService = new CostMonitorService();
