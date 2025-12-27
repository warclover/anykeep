/**
 * revoke_plugin_authorization Tool
 *
 * 撤销单个浏览器插件授权
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { withReasoning, extractReasoning } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { RevokeAuthorizationResult, BrowserType } from "./types";
import { BROWSER_DISPLAY_NAMES } from "./types";

// ============================================
// 参数 Schema
// ============================================

const baseParamsSchema = z.object({
  authorizationId: z
    .string()
    .uuid("授权 ID 必须是有效的 UUID")
    .describe("要撤销的授权 ID"),
});

const paramsSchema = withReasoning(baseParamsSchema);

type RevokePluginAuthorizationParams = z.input<typeof paramsSchema>;

// ============================================
// Tool 实现
// ============================================

export const revokePluginAuthorizationTool: Tool<
  RevokePluginAuthorizationParams,
  RevokeAuthorizationResult
> = {
  definition: {
    name: "revoke_plugin_authorization",
    description: `撤销单个浏览器插件授权。

⚠️ 此操作会：
- 立即使该设备的插件登录失效
- 用户需要在该设备重新授权

使用场景：
- "退出这个 Chrome 插件"
- "撤销 ID 为 xxx 的授权"
- 用户选择列表中的某个授权进行撤销`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 150,
  },

  async execute(
    params: RevokePluginAuthorizationParams,
    context: ToolContext,
  ): Promise<ToolResult<RevokeAuthorizationResult>> {
    const startTime = performance.now();
    const reasoning = extractReasoning(params);
    const supabase = await createClient();

    const { authorizationId } = params;

    try {
      // 1. 验证授权存在且属于当前用户
      const { data: auth, error: selectError } = await supabase
        .from("plugin_authorizations")
        .select("id, browser, revoked_at")
        .eq("id", authorizationId)
        .eq("user_id", context.userId)
        .single();

      if (selectError || !auth) {
        logger.warn(
          {
            toolName: "revoke_plugin_authorization",
            userId: context.userId,
            authorizationId,
            error: selectError?.message,
          },
          "revoke_plugin_authorization: Not Found",
        );

        return {
          success: false,
          error: "授权不存在或无权操作",
          errorCode: "NOT_FOUND",
        };
      }

      // 2. 检查是否已撤销
      if (auth.revoked_at) {
        return {
          success: false,
          error: "该授权已被撤销",
          errorCode: "ALREADY_REVOKED",
        };
      }

      // 3. 执行撤销
      const { error: updateError } = await supabase
        .from("plugin_authorizations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", authorizationId)
        .eq("user_id", context.userId);

      if (updateError) {
        logger.error(
          {
            toolName: "revoke_plugin_authorization",
            userId: context.userId,
            authorizationId,
            error: updateError.message,
          },
          "revoke_plugin_authorization: Update Error",
        );

        return {
          success: false,
          error: `撤销授权失败: ${updateError.message}`,
          errorCode: "DB_ERROR",
        };
      }

      const browser = auth.browser as BrowserType;
      const browserLabel = BROWSER_DISPLAY_NAMES[browser] || auth.browser;
      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.info(
        {
          toolName: "revoke_plugin_authorization",
          userId: context.userId,
          authorizationId,
          browser,
          executionTimeMs,
          reasoning,
        },
        "revoke_plugin_authorization: Success",
      );

      return {
        success: true,
        data: {
          revokedId: authorizationId,
          browser: auth.browser,
          browserLabel,
          message: `已撤销 ${browserLabel} 浏览器的插件授权`,
        },
        metadata: {
          executionTimeMs,
          affectedCount: 1,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.error(
        {
          toolName: "revoke_plugin_authorization",
          userId: context.userId,
          authorizationId,
          error: errorMessage,
          executionTimeMs,
        },
        "revoke_plugin_authorization: Failed",
      );

      return {
        success: false,
        error: `撤销授权失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs,
        },
      };
    }
  },
};
