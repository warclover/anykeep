/**
 * Classification V2 Integration Layer
 * Integrates the V2 classification service with the existing bookmark creation flow
 */

import { z } from "zod";
import { ClassificationContainer } from "./container";
import { CLASSIFICATION_THRESHOLDS, FOLDER_LIMITS } from "./constants";
import { logger } from "@/lib/logger";
import { MessageService } from "@/lib/messages/server";
import type { ClassificationResult, BookmarkInput } from "./types";
import type {
  ClassificationStatus,
  ClassificationResultData,
} from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// Thresholds from centralized constants
const AUTO_CLASSIFY_THRESHOLD = CLASSIFICATION_THRESHOLDS.HIGH_CONFIDENCE;
const SUGGEST_THRESHOLD = CLASSIFICATION_THRESHOLDS.MEDIUM_CONFIDENCE;

/**
 * Input validation schema for classifyBookmarkV2
 */
const classifyBookmarkInputSchema = z.object({
  bookmarkId: z
    .number()
    .int()
    .positive("Bookmark ID must be a positive integer"),
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  summary: z.string().max(2000, "Summary too long").nullable(),
  tags: z.array(z.string().max(100)).max(50, "Too many tags"),
  userId: z.string().uuid("Invalid user ID format"),
});

/**
 * Process bookmark classification using V2 system
 * Replaces the legacy processAIFolderRecommendation function
 */
export async function classifyBookmarkV2(
  bookmarkId: number,
  title: string,
  summary: string | null,
  tags: string[],
  userId: string,
): Promise<{
  classified: boolean;
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  action: ClassificationResult["action"];
  suggestionId?: number;
}> {
  // Input validation
  const validationResult = classifyBookmarkInputSchema.safeParse({
    bookmarkId,
    title,
    summary,
    tags,
    userId,
  });

  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");

    logger.error(
      { bookmarkId, userId, validationErrors: validationResult.error.issues },
      `Classification V2: Input validation failed - ${errorMessage}`,
    );

    return {
      classified: false,
      folderId: null,
      folderName: null,
      confidence: 0,
      action: "inbox",
    };
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Initialize classification container
    const container = ClassificationContainer.initialize(supabase);
    const classificationService = container.getClassificationService();

    // Prepare bookmark input
    const bookmarkInput: BookmarkInput = {
      id: bookmarkId, // 传入 ID 用于排除自匹配
      title,
      summary: summary || undefined,
      tags,
    };

    // Run classification
    const result = await classificationService.classify(userId, bookmarkInput);

    logger.info(
      {
        bookmarkId,
        title: title.substring(0, 30),
        action: result.action,
        confidence: result.confidence,
        folderId: result.folderId,
        folderName: result.folderName,
        scores: result.scores,
      },
      "Classification V2: Result received",
    );

    // Handle result based on action and confidence
    if (result.action === "classify" && result.folderId) {
      // High confidence - auto-classify
      if (result.confidence >= AUTO_CLASSIFY_THRESHOLD) {
        // Move bookmark to classified folder
        const { error: moveError } = await supabase
          .from("bookmarks")
          .update({ folder_id: result.folderId })
          .eq("id", bookmarkId)
          .eq("user_id", userId);

        if (moveError) {
          logger.error(
            { error: moveError, bookmarkId, folderId: result.folderId },
            "Classification V2: Failed to move bookmark",
          );
          return {
            classified: false,
            folderId: null,
            folderName: null,
            confidence: result.confidence,
            action: "inbox",
          };
        }

        logger.info(
          {
            bookmarkId,
            folderId: result.folderId,
            folderName: result.folderName,
            confidence: result.confidence,
          },
          "Classification V2: Auto-classified (high confidence)",
        );

        // 发送自动分类完成消息（静默级别）
        await MessageService.notifyClassificationComplete(
          userId,
          bookmarkId,
          result.folderName || "未知文件夹",
          result.confidence,
          true, // isAuto = true
        ).catch((err) => {
          logger.warn(
            { error: err },
            "Failed to create classification message",
          );
        });

        // V3.1: Write classification status for frontend polling
        await updateBookmarkClassificationStatus(
          supabase,
          bookmarkId,
          userId,
          "classified",
          {
            folderId: result.folderId,
            folderName: result.folderName,
            confidence: result.confidence,
            action: "classify",
            timestamp: new Date().toISOString(),
            reason: result.reason,
          },
        );

        return {
          classified: true,
          folderId: result.folderId,
          folderName: result.folderName,
          confidence: result.confidence,
          action: "classify",
        };
      }

      // Medium confidence - save suggestion
      if (result.confidence >= SUGGEST_THRESHOLD) {
        const { data: suggestion, error: suggestionError } = await supabase
          .from("classification_suggestions")
          .insert({
            user_id: userId,
            bookmark_id: bookmarkId,
            suggested_folder_id: result.folderId,
            suggested_folder_name: result.folderName,
            suggest_new_folder: false,
            confidence: result.confidence,
            reason: result.reason,
            status: "pending",
            batch_id: crypto.randomUUID(),
          })
          .select("id")
          .single();

        if (!suggestionError && suggestion) {
          logger.info(
            {
              bookmarkId,
              suggestionId: suggestion.id,
              folderId: result.folderId,
              folderName: result.folderName,
              confidence: result.confidence,
            },
            "Classification V2: Saved suggestion (medium confidence)",
          );

          // 发送分类建议消息（普通级别）
          await MessageService.notifyClassificationComplete(
            userId,
            bookmarkId,
            result.folderName || "未知文件夹",
            result.confidence,
            false, // isAuto = false，表示需要用户确认
          ).catch((err) => {
            logger.warn(
              { error: err },
              "Failed to create classification suggestion message",
            );
          });

          // V3.1: Write classification status for frontend polling
          await updateBookmarkClassificationStatus(
            supabase,
            bookmarkId,
            userId,
            "suggested",
            {
              folderId: result.folderId,
              folderName: result.folderName,
              confidence: result.confidence,
              action: "classify",
              suggestionId: suggestion.id,
              timestamp: new Date().toISOString(),
              reason: result.reason,
            },
          );

          return {
            classified: false,
            folderId: result.folderId,
            folderName: result.folderName,
            confidence: result.confidence,
            action: "classify",
            suggestionId: suggestion.id,
          };
        }
      }
    }

    // Handle suggest_new action
    if (result.action === "suggest_new" && result.folderName) {
      // Check daily folder creation limit
      const today = new Date().toISOString().split("T")[0];
      const { count: todayCount } = await supabase
        .from("folders")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", `${today}T00:00:00Z`)
        .lt("created_at", `${today}T23:59:59Z`);

      if ((todayCount || 0) >= FOLDER_LIMITS.MAX_AUTO_CREATE_PER_DAY) {
        logger.warn(
          { userId, todayCount },
          "Classification V2: Daily folder creation limit reached",
        );
        // Save as suggestion instead
        const { data: suggestion, error: suggestionError } = await supabase
          .from("classification_suggestions")
          .insert({
            user_id: userId,
            bookmark_id: bookmarkId,
            suggested_folder_id: null,
            suggested_folder_name: result.folderName,
            suggest_new_folder: true,
            confidence: result.confidence,
            reason: result.reason || "Suggest creating new folder",
            status: "pending",
            batch_id: crypto.randomUUID(),
          })
          .select("id")
          .single();

        if (!suggestionError && suggestion) {
          // V3.1: Write classification status for frontend polling
          await updateBookmarkClassificationStatus(
            supabase,
            bookmarkId,
            userId,
            "suggested",
            {
              folderId: null,
              folderName: result.folderName,
              confidence: result.confidence,
              action: "suggest_new",
              suggestionId: suggestion.id,
              timestamp: new Date().toISOString(),
              reason: "每日文件夹创建数量已达上限",
            },
          );

          return {
            classified: false,
            folderId: null,
            folderName: result.folderName,
            confidence: result.confidence,
            action: "suggest_new",
            suggestionId: suggestion.id,
          };
        }
      }

      // High confidence - auto-create folder
      if (result.confidence >= AUTO_CLASSIFY_THRESHOLD) {
        // Create new folder
        const { data: newFolder, error: createError } = await supabase
          .from("folders")
          .insert({
            user_id: userId,
            name: result.folderName,
            sort_order: 0,
          })
          .select("id")
          .single();

        if (!createError && newFolder) {
          // Move bookmark to new folder
          const { error: moveError } = await supabase
            .from("bookmarks")
            .update({ folder_id: newFolder.id })
            .eq("id", bookmarkId)
            .eq("user_id", userId);

          if (!moveError) {
            logger.info(
              {
                bookmarkId,
                folderId: newFolder.id,
                folderName: result.folderName,
                confidence: result.confidence,
              },
              "Classification V2: Created new folder and classified",
            );

            // V3.1: Write classification status for frontend polling
            await updateBookmarkClassificationStatus(
              supabase,
              bookmarkId,
              userId,
              "classified",
              {
                folderId: newFolder.id,
                folderName: result.folderName,
                confidence: result.confidence,
                action: "suggest_new",
                timestamp: new Date().toISOString(),
                reason: "创建新文件夹并归类",
              },
            );

            return {
              classified: true,
              folderId: newFolder.id,
              folderName: result.folderName,
              confidence: result.confidence,
              action: "suggest_new",
            };
          }
        }
      }

      // Medium confidence - save suggestion for new folder
      if (result.confidence >= SUGGEST_THRESHOLD) {
        const { data: suggestion, error: suggestionError } = await supabase
          .from("classification_suggestions")
          .insert({
            user_id: userId,
            bookmark_id: bookmarkId,
            suggested_folder_id: null,
            suggested_folder_name: result.folderName,
            suggest_new_folder: true,
            confidence: result.confidence,
            reason: result.reason || "Suggest creating new folder",
            status: "pending",
            batch_id: crypto.randomUUID(),
          })
          .select("id")
          .single();

        if (!suggestionError && suggestion) {
          logger.info(
            {
              bookmarkId,
              suggestionId: suggestion.id,
              folderName: result.folderName,
              confidence: result.confidence,
            },
            "Classification V2: Saved new folder suggestion",
          );

          // V3.1: Write classification status for frontend polling
          await updateBookmarkClassificationStatus(
            supabase,
            bookmarkId,
            userId,
            "suggested",
            {
              folderId: null,
              folderName: result.folderName,
              confidence: result.confidence,
              action: "suggest_new",
              suggestionId: suggestion.id,
              timestamp: new Date().toISOString(),
              reason: result.reason || "建议创建新文件夹",
            },
          );

          return {
            classified: false,
            folderId: null,
            folderName: result.folderName,
            confidence: result.confidence,
            action: "suggest_new",
            suggestionId: suggestion.id,
          };
        }
      }
    }

    // Low confidence or inbox action - stay in inbox
    logger.info(
      {
        bookmarkId,
        confidence: result.confidence,
        action: result.action,
      },
      "Classification V2: Staying in inbox (low confidence)",
    );

    // V3.1: Write classification status for frontend polling
    await updateBookmarkClassificationStatus(
      supabase,
      bookmarkId,
      userId,
      "inbox",
      {
        folderId: null,
        folderName: "待整理",
        confidence: result.confidence,
        action: "inbox",
        timestamp: new Date().toISOString(),
        reason: `置信度 ${result.confidence}% 低于阈值`,
      },
    );

    return {
      classified: false,
      folderId: null,
      folderName: null,
      confidence: result.confidence,
      action: "inbox",
    };
  } catch (error) {
    logger.error(
      {
        bookmarkId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Classification V2: Failed",
    );

    return {
      classified: false,
      folderId: null,
      folderName: null,
      confidence: 0,
      action: "inbox",
    };
  }
}

/**
 * Update folder profile after bookmark classification
 * Should be called after a bookmark is added to a folder
 */
export async function updateFolderProfileAfterClassification(
  folderId: number,
  userId: string,
): Promise<void> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Call the SQL function to compute folder profile
    // Note: compute_folder_profile is defined in migration but not yet in generated types
    // Using type assertion as a workaround until types are regenerated
    const { error } = await (supabase.rpc as CallableFunction)(
      "compute_folder_profile",
      { p_folder_id: folderId },
    );

    if (error) {
      logger.error(
        { error, folderId, userId },
        "Classification V2: Failed to update folder profile",
      );
    } else {
      logger.info(
        { folderId, userId },
        "Classification V2: Folder profile updated",
      );
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        folderId,
        userId,
      },
      "Classification V2: Exception updating folder profile",
    );
  }
}

/**
 * Check if V2 classification system should be used
 * Can be controlled via feature flag or environment variable
 */
export function shouldUseV2Classification(): boolean {
  // Default to V2 enabled
  // Can be overridden via environment variable
  const v2Enabled = process.env.CLASSIFICATION_V2_ENABLED;
  return v2Enabled !== "false";
}

/**
 * Update bookmark classification status
 * V3.1: Writes classification result to bookmark record for frontend polling
 */
async function updateBookmarkClassificationStatus(
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
        "Classification V2: Failed to update classification status",
      );
    } else {
      logger.debug(
        { bookmarkId, status, folderName: resultData.folderName },
        "Classification V2: Updated classification status",
      );
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        bookmarkId,
      },
      "Classification V2: Exception updating classification status",
    );
  }
}
