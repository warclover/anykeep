/**
 * 学习路径节点组织器
 *
 * @module learning-path/helpers/node-organizer
 * @version 1.0.0
 * @since 2025-12-25
 */

import type { LearningPathInput, LearningNode } from "../types";
import {
  DIFFICULTY_CONFIG,
  DEFAULT_LEARNING_PATH_CONFIG,
  generateNodeId,
} from "../types";
import type { BookmarkRow } from "./bookmark-fetcher";

// ============================================
// 节点组织函数
// ============================================

/**
 * 将书签组织成学习节点
 */
export function organizeNodes(
  bookmarks: BookmarkRow[],
  difficulty: NonNullable<LearningPathInput["createOptions"]>["difficulty"],
): LearningNode[] {
  const difficultyConfig = DIFFICULTY_CONFIG[difficulty || "intermediate"];
  const nodes: LearningNode[] = [];
  let order = 0;

  // 每 N 个节点添加一个里程碑
  const nodesPerMilestone = DEFAULT_LEARNING_PATH_CONFIG.nodesPerMilestone;

  for (let i = 0; i < bookmarks.length; i++) {
    // 添加里程碑
    if (i > 0 && i % nodesPerMilestone === 0) {
      const milestoneNum = Math.floor(i / nodesPerMilestone);
      nodes.push(createMilestoneNode(milestoneNum, order++));
    }

    const bookmark = bookmarks[i];
    nodes.push(
      createBookmarkNode(
        bookmark,
        difficultyConfig.estimatedMinutesPerNode,
        order++,
      ),
    );
  }

  // 添加最终里程碑
  if (bookmarks.length > 0) {
    nodes.push(createFinalMilestoneNode(order++));
  }

  return nodes;
}

/**
 * 创建里程碑节点
 */
function createMilestoneNode(
  milestoneNum: number,
  order: number,
): LearningNode {
  return {
    id: generateNodeId(),
    type: "milestone",
    title: `阶段 ${milestoneNum} 完成`,
    milestoneName: `阶段 ${milestoneNum}`,
    estimatedMinutes: 0,
    status: "pending",
    order,
  };
}

/**
 * 创建书签学习节点
 */
function createBookmarkNode(
  bookmark: BookmarkRow,
  estimatedMinutes: number,
  order: number,
): LearningNode {
  return {
    id: generateNodeId(),
    type: "bookmark",
    title: bookmark.title,
    description: bookmark.ai_summary || undefined,
    bookmarkId: bookmark.id,
    url: bookmark.url,
    platform: bookmark.platform,
    estimatedMinutes,
    status: "pending",
    order,
  };
}

/**
 * 创建最终完成里程碑
 */
function createFinalMilestoneNode(order: number): LearningNode {
  return {
    id: generateNodeId(),
    type: "milestone",
    title: "学习路径完成",
    milestoneName: "完成",
    estimatedMinutes: 0,
    status: "pending",
    order,
  };
}

/**
 * 计算节点总时长
 */
export function calculateTotalMinutes(nodes: LearningNode[]): number {
  return nodes.reduce((sum, n) => sum + n.estimatedMinutes, 0);
}

/**
 * 估算完成天数
 */
export function estimateCompletionDays(
  totalMinutes: number,
  userEstimatedDays?: number,
): number {
  if (userEstimatedDays) {
    return userEstimatedDays;
  }
  return Math.ceil(totalMinutes / DEFAULT_LEARNING_PATH_CONFIG.minutesPerDay);
}
