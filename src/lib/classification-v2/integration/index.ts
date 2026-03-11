/**
 * Classification V2 Integration Layer
 *
 * Wraps the pure `classify()` function with side effects:
 * - Moving bookmarks to folders
 * - Creating classification suggestions
 * - Updating bookmark classification status
 * - Updating folder profiles
 *
 * Migrated from _archived/classification-v1/integration.ts (Phase 5 path).
 *
 * @version 2.0.0
 * @since 2026-03-11
 */

import { z } from "zod";
import { logger } from "@/lib/logger";
import { MessageService } from "@/lib/messages/server";
import { confirmationService } from "@/lib/confirmation";
import { trustModeService } from "@/lib/trust-mode/trust-mode.service";
import type { ClassificationSuggestion } from "@/types/confirmation";
import type {
  ClassificationStatus,
  ClassificationResultData,
} from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Constants
// ============================================================================

/** Auto-classify threshold (percentage, 0-100) */
const AUTO_CLASSIFY_THRESHOLD = 80;

/** Suggest threshold (percentage, 0-100) */
const SUGGEST_THRESHOLD = 60;

/** Maximum auto-created folders per day */
const MAX_AUTO_CREATE_PER_DAY = 8;

// Classification status constants
const CLASSIFICATION_STATUS = {
  CLASSIFIED: "classified" as const,
  SUGGESTED: "suggested" as const,
  INBOX: "inbox" as const,
};

// ============================================================================
// Input validation
// ============================================================================

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

// ============================================================================
// Internal result type (maps v2 ClassifyResult to legacy format)
// ============================================================================

interface MappedResult {
  folderId: number | null;
  folderName: string;
  confidence: number; // 0-100 percentage
  reason: string;
  action: "classify" | "suggest" | "suggest_new" | "inbox";
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check whether V2 classification is enabled.
 *
 * Can be controlled via the `CLASSIFICATION_V2_ENABLED` env variable.
 * Defaults to `true`.
 */
export function shouldUseV2Classification(): boolean {
  const v2Enabled = process.env.CLASSIFICATION_V2_ENABLED;
  return v2Enabled !== "false";
}

/**
 * Classify a bookmark and apply side effects.
 *
 * 1. Calls `classify()` from classification-v2 to get a pure result.
 * 2. Maps the v2 result (confidence 0-1) to legacy format (0-100).
 * 3. Applies side effects based on the action:
 *    - `classify` (high confidence): moves bookmark to folder
 *    - `suggest`: creates a suggestion record for user confirmation
 *    - `suggest_create`: may auto-create folder or save suggestion
 *    - `inbox`: marks bookmark as pending
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
  action: string;
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
      {
        bookmarkId,
        userId,
        validationErrors: validationResult.error.issues,
      },
      `Classification V2 Integration: Input validation failed - ${errorMessage}`,
    );

    return {
      classified: false,
      folderId: null,
      folderName: null,
      confidence: 0,
      action: CLASSIFICATION_STATUS.INBOX,
    };
  }

  try {
    const { classify } = await import("@/lib/classification-v2");
    const v2Result = await classify({
      bookmarkId: String(bookmarkId),
      title,
      summary: summary ?? undefined,
      tags,
      userId,
    });

    // v2 confidence is 0-1, legacy uses 0-100
    const confidencePercent = Math.round(v2Result.confidence * 100);

    logger.info(
      {
        bookmarkId,
        userId,
        v2Action: v2Result.action,
        v2Confidence: v2Result.confidence,
        confidencePercent,
        folderId: v2Result.folderId,
        folderName: v2Result.folderName,
      },
      "Classification V2 Integration: Result received",
    );

    // Map v2 action to legacy action
    const actionMap: Record<string, string> = {
      classify: "classify",
      suggest: "suggest",
      suggest_create: "suggest_new",
      inbox: "inbox",
    };

    const mappedResult: MappedResult = {
      folderId: v2Result.folderId,
      folderName:
        v2Result.folderName ??
        ("suggestedFolderName" in v2Result
          ? ((v2Result as { suggestedFolderName?: string })
              .suggestedFolderName ?? "")
          : ""),
      confidence: confidencePercent,
      reason: v2Result.reason ?? "",
      action: (actionMap[v2Result.action] ??
        v2Result.action) as MappedResult["action"],
    };

    // Apply side effects
    return await applyClassificationResult(
      bookmarkId,
      title,
      tags,
      userId,
      mappedResult,
    );
  } catch (error) {
    logger.error(
      { bookmarkId, userId, error },
      "Classification V2 Integration: Failed",
    );

    return {
      classified: false,
      folderId: null,
      folderName: null,
      confidence: 0,
      action: CLASSIFICATION_STATUS.INBOX,
    };
  }
}

// ============================================================================
// Side-effect application
// ============================================================================

/**
 * Apply classification result side effects:
 * - Move bookmark to folder (auto-classify)
 * - Create suggestion records
 * - Update classification status
 * - Update folder profiles
 *
 * @internal
 */
async function applyClassificationResult(
  bookmarkId: number,
  title: string,
  tags: string[],
  userId: string,
  result: MappedResult,
): Promise<{
  classified: boolean;
  folderId: number | null;
  folderName: string | null;
  confidence: number;
  action: string;
  suggestionId?: number;
}> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  // --- classify / suggest to existing folder ---
  if (
    (result.action === "classify" || result.action === "suggest") &&
    result.folderId
  ) {
    const trustMode = await trustModeService.getUserTrustMode(userId);

    // Determine if we should auto-classify
    const shouldAutoClassify =
      (result.confidence >= AUTO_CLASSIFY_THRESHOLD &&
        trustMode !== "manual") ||
      (trustMode === "full_auto" && result.confidence >= SUGGEST_THRESHOLD);

    if (shouldAutoClassify) {
      // Move bookmark to target folder
      const { error: moveError } = await supabase
        .from("bookmarks")
        .update({
          folder_id: result.folderId,
          pending_cluster: false,
          pending_since: null,
          cluster_id: null,
          cluster_confidence: null,
        })
        .eq("id", bookmarkId)
        .eq("user_id", userId);

      if (moveError) {
        logger.error(
          { error: moveError, bookmarkId, folderId: result.folderId },
          "Classification V2 Integration: Failed to move bookmark",
        );
        return {
          classified: false,
          folderId: null,
          folderName: null,
          confidence: result.confidence,
          action: CLASSIFICATION_STATUS.INBOX,
        };
      }

      logger.info(
        {
          bookmarkId,
          folderId: result.folderId,
          folderName: result.folderName,
          confidence: result.confidence,
          trustMode,
        },
        "Classification V2 Integration: Auto-classified",
      );

      // Notify user
      await MessageService.notifyClassificationComplete(
        userId,
        bookmarkId,
        result.folderName || "",
        result.confidence,
        true,
      ).catch((err) => {
        logger.warn(
          { error: err },
          "Classification V2 Integration: Failed to create classification message",
        );
      });

      // Update classification status
      await updateBookmarkClassificationStatus(
        supabase,
        bookmarkId,
        userId,
        CLASSIFICATION_STATUS.CLASSIFIED,
        {
          folder_id: result.folderId,
          folder_name: result.folderName,
          confidence: result.confidence,
          method: trustMode === "full_auto" ? "full-auto" : "auto-classify",
          action: "select_existing",
          reason: result.reason,
        },
      );

      // Update folder profile
      try {
        const { updateFolderProfileAfterClassification } = await import(
          "@/lib/folder-profile/manager"
        );
        await updateFolderProfileAfterClassification(result.folderId, userId);
      } catch (profileErr) {
        logger.warn(
          {
            error:
              profileErr instanceof Error
                ? profileErr.message
                : String(profileErr),
            folderId: result.folderId,
          },
          "Classification V2 Integration: Folder profile update failed (non-blocking)",
        );
      }

      return {
        classified: true,
        folderId: result.folderId,
        folderName: result.folderName,
        confidence: result.confidence,
        action: "classify",
      };
    }

    // Not auto-classifying: create suggestion
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
          confidence: result.confidence,
          trustMode,
        },
        "Classification V2 Integration: Saved suggestion",
      );

      // Create confirmation for non-full_auto modes
      if (trustMode !== "full_auto") {
        const { data: bookmarkData } = await supabase
          .from("bookmarks")
          .select("url")
          .eq("id", bookmarkId)
          .single();

        const confirmationSuggestion: ClassificationSuggestion = {
          folderId: result.folderId,
          folderName: result.folderName,
          confidence: Math.round(result.confidence),
          reason: result.reason || "",
          alternatives: [],
        };

        await confirmationService
          .createClassificationConfirmation({
            userId,
            bookmarkId,
            bookmarkTitle: title,
            bookmarkUrl: bookmarkData?.url || "",
            suggestion: confirmationSuggestion,
          })
          .catch((err) => {
            logger.warn(
              { error: err },
              "Classification V2 Integration: Failed to create confirmation",
            );
          });
      }

      await updateBookmarkClassificationStatus(
        supabase,
        bookmarkId,
        userId,
        CLASSIFICATION_STATUS.SUGGESTED,
        {
          folder_id: result.folderId,
          folder_name: result.folderName,
          confidence: result.confidence,
          method: "suggestion",
          action: "select_existing",
          reason: result.reason,
        },
      );

      // Clear pending_cluster status
      await supabase
        .from("bookmarks")
        .update({ pending_cluster: false, pending_since: null })
        .eq("id", bookmarkId)
        .eq("user_id", userId);

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

  // --- suggest_new: suggest creating a new folder ---
  if (result.action === "suggest_new" && result.folderName) {
    const trustMode = await trustModeService.getUserTrustMode(userId);

    // Check daily creation limit
    const today = new Date().toISOString().split("T")[0];
    const { count: todayCount } = await supabase
      .from("folders")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", `${today}T00:00:00Z`)
      .lt("created_at", `${today}T23:59:59Z`);

    if ((todayCount || 0) >= MAX_AUTO_CREATE_PER_DAY) {
      logger.warn(
        { userId, todayCount },
        "Classification V2 Integration: Daily folder creation limit reached",
      );

      // Save as suggestion instead
      const { data: suggestion } = await supabase
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

      if (suggestion) {
        await updateBookmarkClassificationStatus(
          supabase,
          bookmarkId,
          userId,
          CLASSIFICATION_STATUS.SUGGESTED,
          {
            folder_id: null,
            folder_name: result.folderName,
            confidence: result.confidence,
            method: "limit-reached",
            action: "suggest_new",
            reason: "",
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

    // High confidence: auto-create folder
    if (
      result.confidence >= AUTO_CLASSIFY_THRESHOLD &&
      trustMode !== "manual"
    ) {
      // Create new folder
      const { data: newFolder, error: createError } = await supabase
        .from("folders")
        .insert({ user_id: userId, name: result.folderName, sort_order: 0 })
        .select("id")
        .single();

      if (!createError && newFolder) {
        // Initialize folder name profile
        try {
          const { initializeFolderNameProfile } = await import(
            "@/lib/folder-profile/manager"
          );
          await initializeFolderNameProfile(
            newFolder.id,
            result.folderName,
            userId,
          );
        } catch (profileErr) {
          logger.warn(
            { error: profileErr, folderId: newFolder.id },
            "Classification V2 Integration: initializeFolderNameProfile failed",
          );
        }

        // Move bookmark to new folder
        const { error: moveError } = await supabase
          .from("bookmarks")
          .update({
            folder_id: newFolder.id,
            pending_cluster: false,
            pending_since: null,
            cluster_id: null,
            cluster_confidence: null,
          })
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
            "Classification V2 Integration: Created new folder and classified",
          );

          await updateBookmarkClassificationStatus(
            supabase,
            bookmarkId,
            userId,
            CLASSIFICATION_STATUS.CLASSIFIED,
            {
              folder_id: newFolder.id,
              folder_name: result.folderName,
              confidence: result.confidence,
              method: "auto-create",
              action: "suggest_new",
              reason: "",
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

    // Medium confidence: save suggestion
    if (result.confidence >= SUGGEST_THRESHOLD) {
      const { data: suggestion } = await supabase
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

      if (suggestion) {
        await updateBookmarkClassificationStatus(
          supabase,
          bookmarkId,
          userId,
          CLASSIFICATION_STATUS.SUGGESTED,
          {
            folder_id: null,
            folder_name: result.folderName,
            confidence: result.confidence,
            method: "suggestion-new",
            action: "suggest_new",
            reason: result.reason || "",
          },
        );

        await supabase
          .from("bookmarks")
          .update({ pending_cluster: false, pending_since: null })
          .eq("id", bookmarkId)
          .eq("user_id", userId);

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

  // --- inbox: low confidence, stay in inbox ---
  logger.info(
    { bookmarkId, confidence: result.confidence, action: result.action },
    "Classification V2 Integration: Staying in inbox",
  );

  await supabase
    .from("bookmarks")
    .update({
      pending_cluster: true,
      pending_since: new Date().toISOString(),
    })
    .eq("id", bookmarkId)
    .eq("user_id", userId);

  await updateBookmarkClassificationStatus(
    supabase,
    bookmarkId,
    userId,
    CLASSIFICATION_STATUS.INBOX,
    {
      folder_id: null,
      folder_name: "",
      confidence: result.confidence,
      method: "inbox-fallback",
      action: "inbox",
      reason: `confidence ${result.confidence}% below threshold`,
    },
  );

  return {
    classified: false,
    folderId: null,
    folderName: null,
    confidence: result.confidence,
    action: CLASSIFICATION_STATUS.INBOX,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Update bookmark classification status for frontend polling.
 */
async function updateBookmarkClassificationStatus(
  supabase: SupabaseClient,
  bookmarkId: number,
  userId: string,
  status: string,
  resultData: ClassificationResultData,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("bookmarks")
      .update({
        classification_status: status as ClassificationStatus,
        classification_result: resultData,
      })
      .eq("id", bookmarkId)
      .eq("user_id", userId);

    if (error) {
      logger.error(
        { error, bookmarkId, status },
        "Classification V2 Integration: Failed to update classification status",
      );
    } else {
      logger.debug(
        { bookmarkId, status },
        "Classification V2 Integration: Updated classification status",
      );
    }
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        bookmarkId,
      },
      "Classification V2 Integration: Exception updating classification status",
    );
  }
}
