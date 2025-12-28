/**
 * 用户画像设置 API
 *
 * GET  /api/user/persona - 获取用户画像（包含推断结果和存储设置）
 * PUT  /api/user/persona - 更新用户画像设置
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import {
  successResponse,
  unauthorizedError,
  databaseError,
  badRequestError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { isPersonaFeatureEnabled } from "@/lib/ai-agent/config";
import { defaultInferenceEngine } from "@/lib/ai-agent/personas/inference";
import type { UserBehaviorData } from "@/lib/ai-agent/personas/inference/types";
import type {
  PersonaType,
  PersonaGroup,
  PersonaPreferences,
} from "@/lib/ai-agent/personas/types";
import { PERSONA_GROUP_MAP } from "@/lib/ai-agent/personas/types";
import type { NextRequest } from "next/server";
import type { Json } from "@/types/supabase";
import { z } from "zod";

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 存储的画像设置结构
 */
interface StoredPersonaSettings {
  primaryType: PersonaType;
  group: PersonaGroup;
  preferences: PersonaPreferences;
  source: "registration" | "settings" | "inferred";
  createdAt: string;
  updatedAt: string;
}

/**
 * API 响应数据结构
 */
interface PersonaApiResponse {
  stored: StoredPersonaSettings | null;
  inferred: {
    primaryType: PersonaType;
    group: PersonaGroup;
    confidence: number;
    alternatives: Array<{
      persona: PersonaType;
      group: PersonaGroup;
      confidence: number;
    }>;
  } | null;
  bookmarkCount: number;
  featureEnabled: boolean;
}

// =============================================================================
// 验证 Schema
// =============================================================================

const PersonaPreferencesSchema = z.object({
  responseStyle: z.enum(["concise", "detailed", "auto"]),
  proactiveReminders: z.boolean(),
  academicCitations: z.boolean(),
  codeBlocks: z.boolean(),
  emojiStyle: z.enum(["none", "minimal", "rich"]),
  language: z.enum(["zh-CN", "en-US", "auto"]),
});

const UpdatePersonaSchema = z.object({
  primaryType: z.string(),
  group: z.string(),
  preferences: PersonaPreferencesSchema,
  source: z.enum(["registration", "settings", "inferred"]),
});

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 从收藏数据构建行为数据
 */
function buildBehaviorData(
  bookmarks: Array<{
    ai_tags: string[] | null;
    platform: string | null;
    url: string | null;
    created_at: string | null;
  }>,
): UserBehaviorData {
  const tags: string[] = [];
  const tagCounts: Record<string, number> = {};
  const platformCounts: Record<string, number> = {};
  const domainCounts: Record<string, number> = {};

  for (const bookmark of bookmarks) {
    // 处理标签
    if (bookmark.ai_tags) {
      for (const tag of bookmark.ai_tags) {
        tags.push(tag);
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    // 处理平台
    if (bookmark.platform) {
      platformCounts[bookmark.platform] =
        (platformCounts[bookmark.platform] || 0) + 1;
    }

    // 处理域名
    if (bookmark.url) {
      try {
        const domain = new URL(bookmark.url).hostname;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      } catch {
        // 忽略无效 URL
      }
    }
  }

  // 计算活跃度指标
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

  const recentWeekCount = bookmarks.filter(
    (b) => b.created_at && new Date(b.created_at).getTime() > oneWeekAgo,
  ).length;

  const recentMonthCount = bookmarks.filter(
    (b) => b.created_at && new Date(b.created_at).getTime() > oneMonthAgo,
  ).length;

  return {
    tags: [...new Set(tags)],
    tagCounts,
    platforms: Object.keys(platformCounts),
    platformCounts,
    contentTypes: [],
    contentTypeCounts: {},
    folders: [],
    folderCounts: {},
    domains: Object.keys(domainCounts),
    domainCounts,
    timePatterns: {
      hourDistribution: new Array(24).fill(0),
      weekdayDistribution: new Array(7).fill(0),
    },
    activityMetrics: {
      totalBookmarks: bookmarks.length,
      recentWeekCount,
      recentMonthCount,
      avgDailyCount: recentMonthCount / 30,
    },
  };
}

// =============================================================================
// GET /api/user/persona
// =============================================================================

/**
 * 获取用户画像
 *
 * 返回：
 * - stored: 用户手动设置的画像（如有）
 * - inferred: AI 推断的画像
 * - bookmarkCount: 收藏数量
 * - featureEnabled: 功能是否启用
 */
export async function GET(): Promise<Response> {
  try {
    // 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 检查功能是否启用
    const featureEnabled = isPersonaFeatureEnabled(user.id);

    // 创建 Supabase 客户端
    const supabase = await createClient();

    // 获取存储的设置
    // 类型断言：persona_settings 是新增字段，尚未在类型定义中
    const profileResult = await supabase
      .from("profiles")
      .select("persona_settings")
      .eq("id", user.id)
      .single();

    const profileError = profileResult.error;
    const profile = profileResult.data as {
      persona_settings: Json | null;
    } | null;

    if (profileError && profileError.code !== "PGRST116") {
      return databaseError("获取画像设置失败", profileError);
    }

    const stored = profile?.persona_settings as StoredPersonaSettings | null;

    // 如果功能未启用，只返回存储的设置
    if (!featureEnabled) {
      const response: PersonaApiResponse = {
        stored,
        inferred: null,
        bookmarkCount: 0,
        featureEnabled: false,
      };
      return successResponse(response);
    }

    // 获取收藏数据用于推断
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from("bookmarks")
      .select("ai_tags, platform, url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);

    if (bookmarksError) {
      logger.warn(
        { error: bookmarksError },
        "Failed to fetch bookmarks for persona inference",
      );
    }

    // 如果没有足够的收藏数据，返回空推断结果
    const bookmarkCount = bookmarks?.length || 0;
    if (bookmarkCount < 10) {
      const response: PersonaApiResponse = {
        stored,
        inferred: null,
        bookmarkCount,
        featureEnabled: true,
      };
      return successResponse(response);
    }

    // 构建行为数据并执行推断
    const behaviorData = buildBehaviorData(bookmarks || []);
    const inferenceResult = await defaultInferenceEngine.infer(behaviorData);

    const response: PersonaApiResponse = {
      stored,
      inferred: {
        primaryType: inferenceResult.recommendedPersona,
        group: inferenceResult.recommendedGroup,
        confidence: Math.round(inferenceResult.confidence * 100),
        alternatives: inferenceResult.alternatives.map((alt) => ({
          persona: alt.persona,
          group: alt.group,
          confidence: Math.round(alt.confidence * 100),
        })),
      },
      bookmarkCount,
      featureEnabled: true,
    };

    return successResponse(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "GET /api/user/persona error");
    return internalError("获取画像失败");
  }
}

// =============================================================================
// PUT /api/user/persona
// =============================================================================

/**
 * 更新用户画像设置
 */
export async function PUT(request: NextRequest): Promise<Response> {
  try {
    // 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 检查功能是否启用
    if (!isPersonaFeatureEnabled(user.id, "settingsUI")) {
      return badRequestError("画像设置功能未启用");
    }

    // 解析请求体
    const body = await request.json();
    const validation = UpdatePersonaSchema.safeParse(body);

    if (!validation.success) {
      return badRequestError(
        `请求参数无效: ${validation.error.issues.map((i) => i.message).join(", ")}`,
      );
    }

    const { primaryType, group, preferences, source } = validation.data;

    // 验证画像类型和分组匹配
    const expectedGroup = PERSONA_GROUP_MAP[primaryType as PersonaType];
    if (expectedGroup && expectedGroup !== group) {
      return badRequestError(
        `画像类型 ${primaryType} 应属于分组 ${expectedGroup}，而非 ${group}`,
      );
    }

    // 创建 Supabase 客户端
    const supabase = await createClient();

    // 构建设置对象
    const now = new Date().toISOString();
    const settings: StoredPersonaSettings = {
      primaryType: primaryType as PersonaType,
      group: group as PersonaGroup,
      preferences: preferences as PersonaPreferences,
      source,
      createdAt: now,
      updatedAt: now,
    };

    // 更新或插入设置
    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        persona_settings: settings as unknown as Json,
        updated_at: now,
      },
      {
        onConflict: "id",
      },
    );

    if (upsertError) {
      return databaseError("保存画像设置失败", upsertError);
    }

    logger.info(
      {
        userId: user.id,
        primaryType,
        group,
        source,
      },
      "User persona settings updated",
    );

    return successResponse({ success: true, data: settings });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "PUT /api/user/persona error");
    return internalError("保存画像设置失败");
  }
}

// =============================================================================
// DELETE /api/user/persona
// =============================================================================

/**
 * 清除用户画像设置（重置为 AI 推断）
 */
export async function DELETE(): Promise<Response> {
  try {
    // 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 创建 Supabase 客户端
    const supabase = await createClient();

    // 清除设置
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        persona_settings: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return databaseError("清除画像设置失败", updateError);
    }

    logger.info({ userId: user.id }, "User persona settings cleared");

    return successResponse({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "DELETE /api/user/persona error");
    return internalError("清除画像设置失败");
  }
}
