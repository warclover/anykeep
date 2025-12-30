/**
 * get_plugin_auth_stats Tool
 *
 * 获取插件授权统计概览
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { withReasoning, extractReasoning } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  BrowserType,
  PluginAuthStatsResult,
  PluginAuthorizationRow,
} from "./types";
import {
  BROWSER_DISPLAY_NAMES,
  calculateAuthStatus,
  formatRelativeTime,
} from "./types";

// ============================================
// 参数 Schema
// ============================================

const baseParamsSchema = z.object({
  // 无必填参数
});

const paramsSchema = withReasoning(baseParamsSchema);

type GetPluginAuthStatsParams = z.input<typeof paramsSchema>;

// ============================================
// Tool 实现
// ============================================

export const getPluginAuthStatsTool: Tool<
  GetPluginAuthStatsParams,
  PluginAuthStatsResult
> = {
  definition: {
    name: "get_plugin_auth_stats",
    description: `获取插件授权统计概览。

返回信息：
- 总授权数、活跃数、过期数、已撤销数
- 按浏览器分组的统计
- 最早/最新的活跃授权时间

使用场景：
- "插件授权概览"
- "我有几个设备在用插件"
- "哪个浏览器用得最多"`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: GetPluginAuthStatsParams,
    context: ToolContext,
  ): Promise<ToolResult<PluginAuthStatsResult>> {
    const startTime = performance.now();
    const reasoning = extractReasoning(params);
    const supabase = await createClient();

    try {
      // 获取所有授权
      const { data: allAuths, error } = await supabase
        .from("plugin_authorizations")
        .select("id, browser, last_used_at, expires_at, revoked_at, created_at")
        .eq("user_id", context.userId);

      if (error) {
        logger.error(
          {
            toolName: "get_plugin_auth_stats",
            userId: context.userId,
            error: error.message,
          },
          "get_plugin_auth_stats: DB Error",
        );

        return {
          success: false,
          error: "获取授权统计失败，请稍后重试",
          errorCode: "DB_ERROR",
        };
      }

      const authorizations = (allAuths || []) as PluginAuthorizationRow[];

      // 计算统计
      let activeCount = 0;
      let expiredCount = 0;
      let revokedCount = 0;

      // 按浏览器分组
      const browserMap = new Map<
        BrowserType,
        {
          count: number;
          activeCount: number;
          lastUsed: string | null;
        }
      >();

      // 活跃授权的时间范围
      let oldestActiveDate: string | null = null;
      let newestActiveDate: string | null = null;

      for (const auth of authorizations) {
        const status = calculateAuthStatus(auth.expires_at, auth.revoked_at);
        const browser = auth.browser as BrowserType;

        // 更新状态计数
        if (status === "active") {
          activeCount++;

          // 更新活跃授权时间范围
          if (!oldestActiveDate || auth.created_at < oldestActiveDate) {
            oldestActiveDate = auth.created_at;
          }
          if (!newestActiveDate || auth.created_at > newestActiveDate) {
            newestActiveDate = auth.created_at;
          }
        } else if (status === "expired") {
          expiredCount++;
        } else {
          revokedCount++;
        }

        // 更新浏览器分组
        let browserStats = browserMap.get(browser);
        if (!browserStats) {
          browserStats = {
            count: 0,
            activeCount: 0,
            lastUsed: null,
          };
          browserMap.set(browser, browserStats);
        }
        browserStats.count++;

        if (status === "active") {
          browserStats.activeCount++;
        }

        // 更新最后使用时间（只看活跃的）
        if (
          status === "active" &&
          (!browserStats.lastUsed || auth.last_used_at > browserStats.lastUsed)
        ) {
          browserStats.lastUsed = auth.last_used_at;
        }
      }

      // 转换浏览器统计为数组
      const byBrowser = Array.from(browserMap.entries())
        .map(([browser, stats]) => ({
          browser,
          label: BROWSER_DISPLAY_NAMES[browser] || browser,
          count: stats.count,
          activeCount: stats.activeCount,
          lastUsed: stats.lastUsed,
          lastUsedDescription: stats.lastUsed
            ? formatRelativeTime(stats.lastUsed)
            : null,
        }))
        .sort((a, b) => b.activeCount - a.activeCount); // 按活跃数排序

      // 生成消息
      let message: string;
      if (authorizations.length === 0) {
        message = "您还没有任何插件授权记录";
      } else if (activeCount === 0) {
        message = `共有 ${authorizations.length} 条授权记录，但没有有效的授权`;
      } else {
        const browserSummary = byBrowser
          .filter((b) => b.activeCount > 0)
          .map((b) => `${b.label} ${b.activeCount} 个`)
          .join("、");
        message = `您有 ${activeCount} 个活跃的插件授权：${browserSummary}`;
      }

      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.info(
        {
          toolName: "get_plugin_auth_stats",
          userId: context.userId,
          totalCount: authorizations.length,
          activeCount,
          expiredCount,
          revokedCount,
          browserCount: byBrowser.length,
          executionTimeMs,
          reasoning,
        },
        "get_plugin_auth_stats: Success",
      );

      return {
        success: true,
        data: {
          totalAuthorizations: authorizations.length,
          activeCount,
          expiredCount,
          revokedCount,
          byBrowser,
          oldestActiveDate,
          newestActiveDate,
          message,
        },
        metadata: {
          executionTimeMs,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.error(
        {
          toolName: "get_plugin_auth_stats",
          userId: context.userId,
          error: errorMessage,
          executionTimeMs,
        },
        "get_plugin_auth_stats: Failed",
      );

      return {
        success: false,
        error: "获取授权统计失败，请稍后重试",
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs,
        },
      };
    }
  },
};
