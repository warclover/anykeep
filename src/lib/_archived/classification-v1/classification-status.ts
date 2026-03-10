/**
 * 分类状态写入器
 *
 * 更新书签的分类状态，用于前端轮询
 *
 * @module classification/classification-status
 * @version 1.0.0
 * @since 2025-12-25
 */

import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassificationStatus,
  ClassificationResultData,
} from "@/types/supabase";

/**
 * 更新书签分类状态
 * V3.1: 将分类结果写入书签记录供前端轮询
 */
export async function updateBookmarkClassificationStatus(
  supabase: SupabaseClient,
  bookmarkId: number,
  userId: string,
  status: ClassificationStatus,
  resultData: ClassificationResultData,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("bookmarks")
      .update({
        classification_status: status,
        classification_result: resultData,
      })
      .eq("id", bookmarkId)
      .eq("user_id", userId);

    if (error) {
      logger.error(
        { error, bookmarkId, status },
        "ClassificationStatus: Failed to update classification status",
      );
    } else {
      logger.debug(
        { bookmarkId, status, folderName: resultData.folderName },
        "ClassificationStatus: Updated classification status",
      );
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        bookmarkId,
      },
      "ClassificationStatus: Exception updating classification status",
    );
  }
}
