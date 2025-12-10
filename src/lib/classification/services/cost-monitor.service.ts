/**
 * Cost Monitor Service (V4.2)
 * LLM 使用成本监控服务
 *
 * 核心功能：
 * - 记录 LLM API 调用
 * - 监控每日/每月成本
 * - 成本预警通知
 */

import { logger } from "@/lib/logger";
import { BaseSupabaseService } from "./base-supabase.service";
import { MessageService } from "@/lib/messages/message-service";
import type { Json } from "@/types/supabase";

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
  metadata?: Json;
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

export class CostMonitorService extends BaseSupabaseService {
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

      // V4.2 RPC
      const { data, error } = await supabase.rpc("record_llm_usage", {
        p_user_id: request.userId,
        p_operation: request.operation,
        p_model: request.model,
        p_input_tokens: request.inputTokens,
        p_output_tokens: request.outputTokens,
        p_cost_cents: costCents,
        p_request_id: request.requestId ?? undefined,
        p_execution_time_ms: request.executionTimeMs ?? undefined,
        p_metadata: request.metadata ?? null,
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

    // V4.2 RPC
    const { data, error } = await supabase.rpc("get_user_daily_llm_cost", {
      p_user_id: userId,
      p_date: dateStr,
    });

    // 类型断言
    type DailyCostRow = {
      total_calls?: number;
      total_tokens?: number;
      total_cost_cents?: number;
    };
    const typedData = data as DailyCostRow[] | null;

    if (error || !typedData || typedData.length === 0) {
      return { totalCalls: 0, totalTokens: 0, totalCostCents: 0 };
    }

    return {
      totalCalls: typedData[0].total_calls || 0,
      totalTokens: typedData[0].total_tokens || 0,
      totalCostCents: typedData[0].total_cost_cents || 0,
    };
  }

  /**
   * Get user's monthly cost
   */
  async getMonthlyCost(userId: string, month?: string): Promise<UsageSummary> {
    const supabase = await this.getSupabase();
    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // V4.2 表
    const { data, error } = await supabase
      .from("llm_usage_monthly")
      .select("*")
      .eq("user_id", userId)
      .eq("month", targetMonth)
      .single();

    // 类型断言
    type MonthlyUsageRow = {
      call_count?: number;
      total_tokens?: number;
      total_cost_cents?: number;
      classification_calls?: number;
      naming_calls?: number;
      analysis_calls?: number;
      chat_calls?: number;
    };
    const typedData = data as MonthlyUsageRow | null;

    if (error || !typedData) {
      return {
        totalCalls: 0,
        totalTokens: 0,
        totalCostCents: 0,
        byOperation: {},
        byModel: {},
      };
    }

    return {
      totalCalls: typedData.call_count || 0,
      totalTokens: typedData.total_tokens || 0,
      totalCostCents: typedData.total_cost_cents || 0,
      byOperation: {
        classification: {
          calls: typedData.classification_calls || 0,
          tokens: 0,
          costCents: 0,
        },
        folder_naming: {
          calls: typedData.naming_calls || 0,
          tokens: 0,
          costCents: 0,
        },
        content_analysis: {
          calls: typedData.analysis_calls || 0,
          tokens: 0,
          costCents: 0,
        },
        chat: { calls: typedData.chat_calls || 0, tokens: 0, costCents: 0 },
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

    // V4.2 表
    const { data, error } = await supabase
      .from("llm_usage_log")
      .select("operation, model, input_tokens, output_tokens, cost_cents")
      .eq("user_id", userId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    // 类型断言
    type UsageLogRow = {
      operation: string;
      model: string;
      input_tokens: number;
      output_tokens: number;
      cost_cents: number;
    };
    const typedData = data as UsageLogRow[] | null;

    if (error || !typedData) {
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

    for (const row of typedData) {
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
      totalCalls: typedData.length,
      totalTokens,
      totalCostCents,
      byOperation,
      byModel,
    };
  }

  /**
   * Check if cost alert should be sent
   * V4.2: Implemented notification via MessageService
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

        // V4.2: Send notification to user
        await MessageService.notifyCostAlert(
          userId,
          "daily",
          daily.totalCostCents,
          config.dailyLimitCents,
        );
      }

      // Also check monthly limit
      const monthly = await this.getMonthlyCost(userId);
      if (
        monthly.totalCostCents >=
        config.monthlyLimitCents * config.alertThreshold
      ) {
        logger.warn(
          {
            userId: userId.slice(0, 8) + "...",
            monthlyCostCents: monthly.totalCostCents,
            limitCents: config.monthlyLimitCents,
          },
          "CostMonitor: Monthly cost alert threshold reached",
        );

        // V4.2: Send monthly notification
        await MessageService.notifyCostAlert(
          userId,
          "monthly",
          monthly.totalCostCents,
          config.monthlyLimitCents,
        );
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
