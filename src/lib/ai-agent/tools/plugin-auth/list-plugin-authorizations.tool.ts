/**
 * list_plugin_authorizations Tool
 *
 * 列出用户的浏览器插件授权记录
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
  ListAuthorizationsResult,
  PluginAuthorizationRow,
} from "./types";
import { transformAuthorization, BROWSER_DISPLAY_NAMES } from "./types";

// ============================================
// 参数 Schema
// ============================================

const baseParamsSchema = z.object({
  status: z
    .enum(["active", "expired", "revoked", "all"])
    .optional()
    .default("active")
    .describe(
      "筛选状态：active-有效，expired-已过期，revoked-已撤销，all-全部",
    ),
  browser: z
    .enum(["chrome", "edge", "firefox", "other"])
    .optional()
    .describe("筛选浏览器类型"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(20)
    .describe("返回数量，默认 20"),
});

const paramsSchema = withReasoning(baseParamsSchema);

type ListPluginAuthorizationsParams = z.input<typeof paramsSchema>;

// ============================================
// Tool 实现
// ============================================

export const listPluginAuthorizationsTool: Tool<
  ListPluginAuthorizationsParams,
  ListAuthorizationsResult
> = {
  definition: {
    name: "list_plugin_authorizations",
    description: `列出用户的浏览器插件授权记录。

返回信息：
- 每个授权的浏览器类型、版本、状态
- 最后使用时间（友好格式：如"3小时前"）
- 过期时间
- 总数和活跃数统计

使用场景：
- "我有多少个设备登录了插件"
- "查看我的插件授权"
- "Chrome 插件最后什么时候用的"
- "哪些插件授权已过期"`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: ListPluginAuthorizationsParams,
    context: ToolContext,
  ): Promise<ToolResult<ListAuthorizationsResult>> {
    const startTime = performance.now();
    const reasoning = extractReasoning(params);
    const supabase = await createClient();

    const { status = "active", browser, limit = 20 } = params;

    try {
      // 构建查询
      let query = supabase
        .from("plugin_authorizations")
        .select("*")
        .eq("user_id", context.userId)
        .order("last_used_at", { ascending: false })
        .limit(limit);

      // 状态筛选
      const now = new Date().toISOString();
      if (status === "active") {
        query = query.is("revoked_at", null).gt("expires_at", now);
      } else if (status === "expired") {
        query = query.is("revoked_at", null).lte("expires_at", now);
      } else if (status === "revoked") {
        query = query.not("revoked_at", "is", null);
      }

      // 浏览器筛选
      if (browser) {
        query = query.eq("browser", browser);
      }

      const { data, error } = await query;

      if (error) {
        logger.error(
          {
            toolName: "list_plugin_authorizations",
            userId: context.userId,
            params: { status, browser, limit },
            error: error.message,
          },
          "list_plugin_authorizations: DB Error",
        );

        return {
          success: false,
          error: `查询授权列表失败: ${error.message}`,
          errorCode: "DB_ERROR",
        };
      }

      // 转换数据
      const authorizations = ((data || []) as PluginAuthorizationRow[]).map(
        transformAuthorization,
      );

      // 计算活跃数
      const activeCount = authorizations.filter(
        (a) => a.status === "active",
      ).length;

      // 生成消息
      let message: string;
      if (authorizations.length === 0) {
        if (browser) {
          message = `没有找到 ${BROWSER_DISPLAY_NAMES[browser as BrowserType]} 的插件授权`;
        } else if (status !== "all") {
          message = `没有${status === "active" ? "有效" : status === "expired" ? "已过期" : "已撤销"}的插件授权`;
        } else {
          message = "您还没有任何插件授权记录";
        }
      } else {
        const browserText = browser
          ? ` ${BROWSER_DISPLAY_NAMES[browser as BrowserType]} `
          : "";
        message = `找到 ${authorizations.length} 个${browserText}插件授权${activeCount > 0 ? `，其中 ${activeCount} 个有效` : ""}`;
      }

      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.info(
        {
          toolName: "list_plugin_authorizations",
          userId: context.userId,
          params: { status, browser, limit },
          resultCount: authorizations.length,
          activeCount,
          executionTimeMs,
          reasoning,
        },
        "list_plugin_authorizations: Success",
      );

      return {
        success: true,
        data: {
          authorizations,
          total: authorizations.length,
          activeCount,
          message,
        },
        metadata: {
          executionTimeMs,
          affectedCount: authorizations.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.error(
        {
          toolName: "list_plugin_authorizations",
          userId: context.userId,
          error: errorMessage,
          executionTimeMs,
        },
        "list_plugin_authorizations: Failed",
      );

      return {
        success: false,
        error: `查询授权列表失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs,
        },
      };
    }
  },
};
