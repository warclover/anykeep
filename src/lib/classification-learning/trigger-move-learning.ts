/**
 * Move Learning Trigger
 *
 * 在书签移动操作完成后触发 AI 学习。
 * 供所有 batch-move API 路由共享调用。
 *
 * ⚠️ 活跃模块 — 请勿删除
 * 消费者：bookmarks/[id] PUT、bookmarks/batch-move POST、v1/bookmarks/batch/move POST
 *
 * @version 1.0.0
 * @since 2026-02-27
 */

import { learningEventHandler } from "./learning-event-handler";
import { logger } from "@/lib/logger";

interface BookmarkMoveData {
  id: number;
  folder_id: number | null;
  ai_tags?: string[] | null;
  source_id?: string | null;
}

interface TriggerMoveLearningParams {
  userId: string;
  bookmarks: BookmarkMoveData[];
  targetFolderId: number | null;
}

/**
 * 从书签移动操作中触发学习
 *
 * - 只在移动到具体文件夹时触发（移动到根目录不学习）
 * - 过滤掉没有原文件夹、或原文件夹与目标相同的书签
 * - 单个书签使用 learnFromBookmarkMove，多个按源文件夹分组使用 learnFromBulkMove
 */
export async function triggerMoveLearning(
  params: TriggerMoveLearningParams,
): Promise<void> {
  const { userId, bookmarks, targetFolderId } = params;

  if (targetFolderId === null) return;
  if (!bookmarks || bookmarks.length === 0) return;

  const validBookmarks = bookmarks.filter(
    (b) => b.folder_id !== null && b.folder_id !== targetFolderId,
  );

  if (validBookmarks.length === 0) return;

  try {
    if (validBookmarks.length === 1) {
      const bm = validBookmarks[0];
      await learningEventHandler.learnFromBookmarkMove({
        userId,
        bookmarkId: bm.id,
        sourceFolderId: bm.folder_id ?? 0,
        targetFolderId,
        bookmarkTags: bm.ai_tags ?? undefined,
        bookmarkSourceId: bm.source_id ?? undefined,
      });

      logger.debug(
        { userId, bookmarkId: bm.id, sourceFolderId: bm.folder_id },
        "[triggerMoveLearning] Single move learning triggered",
      );
    } else {
      const byFolder = new Map<number, BookmarkMoveData[]>();
      for (const bm of validBookmarks) {
        const fid = bm.folder_id ?? 0;
        if (!byFolder.has(fid)) byFolder.set(fid, []);
        byFolder.get(fid)?.push(bm);
      }

      for (const [sourceFolderId, group] of byFolder) {
        const allTags = group.flatMap((b) => b.ai_tags || []);
        const tagCounts = new Map<string, number>();
        for (const tag of allTags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
        const majorityThreshold = Math.ceil(group.length / 2);
        const commonTags = [...tagCounts.entries()]
          .filter(([, count]) => count >= majorityThreshold)
          .map(([tag]) => tag);

        const sourceIds = group
          .map((b) => b.source_id)
          .filter((s): s is string => s != null);
        const sourceCounts = new Map<string, number>();
        for (const sid of sourceIds) {
          sourceCounts.set(sid, (sourceCounts.get(sid) || 0) + 1);
        }
        const commonSourceId = [...sourceCounts.entries()]
          .filter(([, count]) => count >= majorityThreshold)
          .map(([sid]) => sid)[0];

        await learningEventHandler.learnFromBulkMove({
          userId,
          bookmarkIds: group.map((b) => b.id),
          sourceFolderId,
          targetFolderId,
          commonTags: commonTags.length > 0 ? commonTags : undefined,
          commonSourceId,
        });

        logger.debug(
          {
            userId,
            sourceFolderId,
            bookmarkCount: group.length,
            commonTagCount: commonTags.length,
          },
          "[triggerMoveLearning] Bulk move learning triggered for folder group",
        );
      }
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "[triggerMoveLearning] Failed to trigger move learning",
    );
  }
}
