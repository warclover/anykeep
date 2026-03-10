/**
 * UpdateUserInterests Tool - 更新用户兴趣领域
 *
 * 更新用户的预设兴趣领域选择
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { createInterestService } from "@/lib/interests";
import {
  PRESET_INTEREST_DOMAINS,
  getAllPresetInterestIds,
} from "@/lib/user-interest/interest-domains";
import { logger } from "@/lib/logger";
import type { PresetInterestId } from "@/lib/classification/types";

// ============================================
// 参数和结果类型定义
// ============================================

const presetInterestIdSchema = z.enum([
  "tech_frontend",
  "tech_backend",
  "tech_ai",
  "tech_mobile",
  "design_ui",
  "design_graphic",
  "product",
  "marketing",
  "reading",
  "investment",
  "lifestyle",
  "learning",
]);

const paramsSchema = z.object({
  presetInterests: z
    .array(presetInterestIdSchema)
    .min(0)
    .max(12)
    .describe("要设置的预设兴趣 ID 列表"),
  action: z
    .enum(["replace", "add", "remove"])
    .optional()
    .default("replace")
    .describe("操作类型：replace(替换全部)、add(追加)、remove(移除)"),
});

type UpdateUserInterestsParams = z.infer<typeof paramsSchema>;

interface UpdateUserInterestsResult {
  previousInterests: string[];
  currentInterests: string[];
  added: string[];
  removed: string[];
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const updateUserInterestsTool: Tool<
  UpdateUserInterestsParams,
  UpdateUserInterestsResult
> = {
  definition: {
    name: "update_user_interests",
    description: `更新用户的预设兴趣领域。

使用场景：
- 用户要求 "添加 AI 和前端开发兴趣"
- 用户要求 "我对投资理财感兴趣"
- 用户要求 "移除营销运营标签"
- 用户要求 "重新设置我的兴趣领域"

可选预设兴趣（12 个）：
- 技术类: tech_frontend(前端开发), tech_backend(后端开发), tech_ai(AI/机器学习), tech_mobile(移动开发)
- 设计类: design_ui(UI/UX设计), design_graphic(平面设计)
- 商业类: product(产品经理), marketing(营销运营)
- 生活类: reading(阅读写作), investment(投资理财), lifestyle(生活方式), learning(学习提升)

操作类型：
- replace: 用新列表完全替换现有兴趣
- add: 追加到现有兴趣列表
- remove: 从现有列表中移除指定兴趣`,
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
    estimatedDurationMs: 200,
  },

  async execute(
    params: UpdateUserInterestsParams,
    context,
  ): Promise<ToolResult<UpdateUserInterestsResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 创建兴趣服务
      const interestService = createInterestService(supabase);

      // 获取当前兴趣配置
      const currentConfig = await interestService.getUserInterests(
        context.userId,
      );
      const previousInterests = [...currentConfig.presetInterests];

      // 验证输入的兴趣 ID
      const validInterestIds = getAllPresetInterestIds();
      const validInputIds = params.presetInterests.filter((id) =>
        validInterestIds.includes(id as PresetInterestId),
      );

      // 计算新的兴趣列表
      let newInterests: PresetInterestId[];

      switch (params.action) {
        case "add":
          // 追加模式：合并去重
          newInterests = [
            ...new Set([
              ...previousInterests,
              ...(validInputIds as PresetInterestId[]),
            ]),
          ];
          break;

        case "remove":
          // 移除模式：过滤掉指定的
          newInterests = previousInterests.filter(
            (id) => !validInputIds.includes(id),
          );
          break;

        case "replace":
        default:
          // 替换模式：直接使用新列表
          newInterests = validInputIds as PresetInterestId[];
          break;
      }

      // 限制最大数量
      if (newInterests.length > 12) {
        newInterests = newInterests.slice(0, 12);
      }

      // 更新兴趣配置
      await interestService.setPresetInterests(context.userId, newInterests);

      // 计算变化
      const added = newInterests.filter(
        (id) => !previousInterests.includes(id),
      );
      const removed = previousInterests.filter(
        (id) => !newInterests.includes(id),
      );

      // 获取兴趣名称用于消息
      const getInterestName = (id: string) =>
        PRESET_INTEREST_DOMAINS[id as PresetInterestId]?.name || id;

      let message: string;
      if (added.length > 0 && removed.length > 0) {
        message = `已添加 ${added.map(getInterestName).join("、")}，移除 ${removed.map(getInterestName).join("、")}`;
      } else if (added.length > 0) {
        message = `已添加兴趣领域：${added.map(getInterestName).join("、")}`;
      } else if (removed.length > 0) {
        message = `已移除兴趣领域：${removed.map(getInterestName).join("、")}`;
      } else {
        message = "兴趣领域未发生变化";
      }

      logger.info(
        {
          toolName: "update_user_interests",
          userId: context.userId,
          action: params.action,
          added,
          removed,
          newCount: newInterests.length,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "update_user_interests: Success",
      );

      return {
        success: true,
        data: {
          previousInterests,
          currentInterests: newInterests,
          added,
          removed,
          message,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
          affectedCount: added.length + removed.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "update_user_interests",
          userId: context.userId,
          error: errorMessage,
        },
        "update_user_interests: Failed",
      );

      return {
        success: false,
        error: `更新兴趣领域失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
