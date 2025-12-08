/**
 * 智能分类调试工具 - Mock 上下文服务
 *
 * 管理测试场景的 Mock 数据和真实数据加载
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DebugScenario, MockFolder, MockHistoryItem } from "../types";
import { MOCK_SCENARIOS } from "../constants";
import { logger } from "@/lib/logger";

/**
 * 执行上下文
 */
export interface ExecutionContext {
  userId: string;
  folders: MockFolder[];
  history: MockHistoryItem[];
  scenario: DebugScenario;
}

/**
 * 获取 Mock 上下文
 */
export function getMockContext(scenario: DebugScenario): ExecutionContext {
  const scenarioData = MOCK_SCENARIOS[scenario];

  return {
    userId: scenarioData.userId,
    folders: scenarioData.folders,
    history: scenarioData.classificationHistory,
    scenario,
  };
}

/**
 * 加载真实用户上下文（只读模式）
 */
export async function loadRealContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<ExecutionContext> {
  logger.debug(
    { userId },
    "[ClassificationDebugger] Loading real user context",
  );

  try {
    // 加载用户文件夹
    const { data: folders, error: foldersError } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", userId)
      .eq("is_system", false)
      .is("deleted_at", null)
      .order("name");

    if (foldersError) {
      logger.error(
        { error: foldersError, userId },
        "[ClassificationDebugger] Failed to load folders",
      );
      throw new Error("加载文件夹失败");
    }

    // 计算每个文件夹的书签数量
    const folderWithCounts: MockFolder[] = [];

    for (const folder of folders || []) {
      const { count } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("folder_id", folder.id)
        .eq("user_id", userId)
        .is("deleted_at", null);

      // 获取文件夹的 top tags
      const { data: bookmarkTags } = await supabase
        .from("bookmarks")
        .select("tags")
        .eq("folder_id", folder.id)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .limit(20);

      const tagCounts: Record<string, number> = {};
      for (const bookmark of bookmarkTags || []) {
        for (const tag of bookmark.tags || []) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }

      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);

      folderWithCounts.push({
        id: String(folder.id),
        name: folder.name,
        bookmarkCount: count || 0,
        topTags,
      });
    }

    // 加载最近的分类历史（从 classification_decisions 表）
    const { data: decisions, error: decisionsError } = await supabase
      .from("classification_decisions")
      .select(
        `
        bookmark_title,
        final_folder_id,
        final_confidence
      `,
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const history: MockHistoryItem[] = [];

    if (!decisionsError && decisions) {
      for (const decision of decisions) {
        if (decision.final_folder_id) {
          history.push({
            title: decision.bookmark_title,
            folderId: String(decision.final_folder_id),
            confidence: decision.final_confidence || 0,
          });
        }
      }
    }

    logger.info(
      {
        userId,
        folderCount: folderWithCounts.length,
        historyCount: history.length,
      },
      "[ClassificationDebugger] Real context loaded",
    );

    return {
      userId,
      folders: folderWithCounts,
      history,
      scenario: "real-readonly",
    };
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        userId,
      },
      "[ClassificationDebugger] Failed to load real context",
    );

    // 返回空上下文
    return {
      userId,
      folders: [],
      history: [],
      scenario: "real-readonly",
    };
  }
}

/**
 * 验证场景是否可用
 */
export function isScenarioAvailable(
  scenario: DebugScenario,
  hasRealUser: boolean,
): boolean {
  if (scenario === "real-readonly") {
    return hasRealUser;
  }
  return true;
}
