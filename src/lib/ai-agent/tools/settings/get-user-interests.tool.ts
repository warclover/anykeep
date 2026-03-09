/**
 * GetUserInterests Tool - 获取用户兴趣领域
 *
 * 获取用户的兴趣领域配置，包括预设兴趣和自定义兴趣
 *
 * @version 1.0.0
 * @since 2025-12-24
 */

import { z } from "zod";
import type { Tool, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { createInterestService } from "@/lib/classification/services/interest-factory";
import { PRESET_INTEREST_DOMAINS } from "@/lib/user-interest/interest-domains";
import { logger } from "@/lib/logger";
import type { PresetInterestId } from "@/lib/classification/types";

// ============================================
// 参数和结果类型定义
// ============================================

const paramsSchema = z.object({});

type GetUserInterestsParams = z.infer<typeof paramsSchema>;

interface PresetInterestInfo {
  id: string;
  name: string;
  icon: string;
  category: string;
  keywords: string[];
}

interface CustomInterestInfo {
  id: string;
  name: string;
  icon: string;
  keywords: string[];
}

interface GetUserInterestsResult {
  presetInterests: PresetInterestInfo[];
  customInterests: CustomInterestInfo[];
  availablePresets: PresetInterestInfo[];
  summary: {
    totalSelected: number;
    presetCount: number;
    customCount: number;
  };
  message: string;
}

// ============================================
// Tool 实现
// ============================================

export const getUserInterestsTool: Tool<
  GetUserInterestsParams,
  GetUserInterestsResult
> = {
  definition: {
    name: "get_user_interests",
    description: `获取用户的兴趣领域配置。

使用场景：
- 用户要求 "查看我的兴趣设置"
- 用户要求 "我关注哪些领域"
- 用户要求 "显示我的兴趣标签"
- AI 需要了解用户兴趣以提供个性化建议时

返回信息：
- presetInterests: 用户已选择的预设兴趣列表
- customInterests: 用户自定义的兴趣列表
- availablePresets: 所有可选的预设兴趣
- summary: 统计摘要`,
    parameters: paramsSchema,
    category: "query",
    requiresConfirmation: false,
    estimatedDurationMs: 150,
  },

  async execute(
    _params: GetUserInterestsParams,
    context,
  ): Promise<ToolResult<GetUserInterestsResult>> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 创建兴趣服务
      const interestService = createInterestService(supabase);

      // 获取用户兴趣配置
      const userInterests = await interestService.getUserInterests(
        context.userId,
      );

      // 构建预设兴趣信息
      const presetInterests: PresetInterestInfo[] =
        userInterests.presetInterests.map((id) => {
          const domain = PRESET_INTEREST_DOMAINS[id as PresetInterestId];
          return {
            id,
            name: domain?.name || id,
            icon: domain?.icon || "📌",
            category: domain?.category || "other",
            keywords: domain?.keywords || [],
          };
        });

      // 构建自定义兴趣信息
      const customInterests: CustomInterestInfo[] =
        userInterests.customInterests.map((custom) => ({
          id: custom.id,
          name: custom.name,
          icon: custom.icon,
          keywords: custom.keywords,
        }));

      // 构建所有可用预设兴趣
      const availablePresets: PresetInterestInfo[] = Object.entries(
        PRESET_INTEREST_DOMAINS,
      ).map(([id, domain]) => ({
        id,
        name: domain.name,
        icon: domain.icon,
        category: domain.category,
        keywords: domain.keywords,
      }));

      const totalSelected = presetInterests.length + customInterests.length;

      logger.info(
        {
          toolName: "get_user_interests",
          userId: context.userId,
          presetCount: presetInterests.length,
          customCount: customInterests.length,
          executionTimeMs: Math.round(performance.now() - startTime),
        },
        "get_user_interests: Success",
      );

      return {
        success: true,
        data: {
          presetInterests,
          customInterests,
          availablePresets,
          summary: {
            totalSelected,
            presetCount: presetInterests.length,
            customCount: customInterests.length,
          },
          message:
            totalSelected > 0
              ? `已设置 ${totalSelected} 个兴趣领域（${presetInterests.length} 个预设，${customInterests.length} 个自定义）`
              : "尚未设置兴趣领域",
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error(
        {
          toolName: "get_user_interests",
          userId: context.userId,
          error: errorMessage,
        },
        "get_user_interests: Failed",
      );

      return {
        success: false,
        error: `获取兴趣领域失败: ${errorMessage}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  },
};
