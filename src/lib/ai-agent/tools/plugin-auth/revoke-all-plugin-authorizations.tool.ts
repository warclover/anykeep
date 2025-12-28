/**
 * revoke_all_plugin_authorizations Tool
 *
 * 撤销用户所有（或指定浏览器的）插件授权
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { withReasoning, extractReasoning } from "../types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { RevokeAllResult } from "./types";
import { BROWSER_DISPLAY_NAMES } from "./types";

// ============================================
// 参数 Schema
// ============================================

const baseParamsSchema = z.object({
  browser: z
    .enum(["chrome", "edge", "firefox", "other"])
    .optional()
    .describe("仅撤销指定浏览器的授权，不填则撤销全部"),
  confirmReason: z.string().optional().describe("确认原因（安全审计用）"),
});

const paramsSchema = withReasoning(baseParamsSchema);

type RevokeAllPluginAuthorizationsParams = z.input<typeof paramsSchema>;

// ============================================
// Tool 实现
// ============================================

export const revokeAllPluginAuthorizationsTool: Tool<
  RevokeAllPluginAuthorizationsParams,
  RevokeAllResult
> = {
  definition: {
    name: "revoke_all_plugin_authorizations",
    description: `撤销用户所有（或指定浏览器的）插件授权。

⚠️ 高风险操作：
- 所有设备的插件将立即失效
- 需要在每个设备重新授权
- 建议仅在安全问题时使用

使用场景：
- "退出所有浏览器插件"
- "我怀疑账号被盗，撤销所有授权"
- "只退出 Chrome 的所有插件"`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: true, // ⚠️ 高风险，需要确认
    estimatedDurationMs: 300,
  },

  async execute(
    params: RevokeAllPluginAuthorizationsParams,
    context: ToolContext,
  ): Promise<ToolResult<RevokeAllResult>> {
    const startTime = performance.now();
    const reasoning = extractReasoning(params);
    const supabase = await createClient();

    const { browser, confirmReason } = params;

    try {
      let revokedCount = 0;

      if (!browser) {
        // 撤销全部 - 使用已有的 RPC 函数
        const { data, error } = await supabase.rpc(
          "revoke_all_plugin_authorizations",
          { p_user_id: context.userId },
        );

        if (error) {
          logger.error(
            {
              toolName: "revoke_all_plugin_authorizations",
              userId: context.userId,
              error: error.message,
            },
            "revoke_all_plugin_authorizations: RPC Error",
          );

          return {
            success: false,
            error: "撤销所有授权失败，请稍后重试",
            errorCode: "DB_ERROR",
          };
        }

        revokedCount = data ?? 0;
      } else {
        // 撤销指定浏览器
        const { data, error } = await supabase
          .from("plugin_authorizations")
          .update({ revoked_at: new Date().toISOString() })
          .eq("user_id", context.userId)
          .eq("browser", browser)
          .is("revoked_at", null)
          .select("id");

        if (error) {
          logger.error(
            {
              toolName: "revoke_all_plugin_authorizations",
              userId: context.userId,
              browser,
              error: error.message,
            },
            "revoke_all_plugin_authorizations: Update Error",
          );

          return {
            success: false,
            error: `撤销 ${BROWSER_DISPLAY_NAMES[browser]} 授权失败，请稍后重试`,
            errorCode: "DB_ERROR",
          };
        }

        revokedCount = data?.length ?? 0;
      }

      // 生成消息
      let message: string;
      if (revokedCount === 0) {
        if (browser) {
          message = `没有找到 ${BROWSER_DISPLAY_NAMES[browser]} 的有效授权`;
        } else {
          message = "没有找到有效的插件授权";
        }
      } else {
        if (browser) {
          message = `已撤销 ${revokedCount} 个 ${BROWSER_DISPLAY_NAMES[browser]} 插件授权`;
        } else {
          message = `已撤销所有 ${revokedCount} 个插件授权`;
        }
      }

      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.info(
        {
          toolName: "revoke_all_plugin_authorizations",
          userId: context.userId,
          browser: browser ?? "all",
          revokedCount,
          confirmReason,
          executionTimeMs,
          reasoning,
        },
        "revoke_all_plugin_authorizations: Success",
      );

      return {
        success: true,
        data: {
          revokedCount,
          browser: browser ?? null,
          message,
        },
        metadata: {
          executionTimeMs,
          affectedCount: revokedCount,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const executionTimeMs = Math.round(performance.now() - startTime);

      logger.error(
        {
          toolName: "revoke_all_plugin_authorizations",
          userId: context.userId,
          browser,
          error: errorMessage,
          executionTimeMs,
        },
        "revoke_all_plugin_authorizations: Failed",
      );

      return {
        success: false,
        error: "撤销授权失败，请稍后重试",
        errorCode: "EXECUTION_ERROR",
        metadata: {
          executionTimeMs,
        },
      };
    }
  },
};
