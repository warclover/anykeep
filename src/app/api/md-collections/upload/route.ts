/**
 * MD 文件上传 API 路由
 * P2-007: Markdown 内容收藏
 *
 * POST /api/md-collections/upload - 上传 MD/TXT 文件
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  successResponse,
  unauthorizedError,
  forbiddenError,
  badRequestError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import { MD_COLLECTION } from "@/lib/constants/messages";
import {
  computeContentHash,
  preprocessMarkdownForAI,
  validateMarkdownContent,
  sanitizeMarkdownContent,
  extractTitle,
  canCreateMdCollection,
} from "@/features/md-collections/lib";
import { triggerMdAIProcessing } from "@/features/md-collections/lib/ai";
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MD_COLLECTION_LIMITS,
} from "@/features/md-collections/constants";

/**
 * POST /api/md-collections/upload
 * 上传 MD/TXT 文件并创建收藏
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 检查用户会员类型和功能权限
    // 类型断言: 手动维护类型文件时需要此断言
    type ProfileRow = { membership_type: string | null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileError } = await (supabase.from("profiles") as any)
      .select("membership_type")
      .eq("id", user.id)
      .single() as { data: ProfileRow | null; error: { message: string } | null };

    if (profileError) {
      logger.warn({ error: profileError }, "Failed to get user profile");
    }

    const membershipType = profile?.membership_type || "FREE";

    // 3. 获取当前 MD 收藏数量并检查权限
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: currentCount, error: countError } = await (supabase.from("md_collections") as any)
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null) as { count: number | null; error: { message: string } | null };

    if (countError) {
      return databaseError(MD_COLLECTION.LOAD_ERROR, countError);
    }

    const gateResult = canCreateMdCollection(membershipType, currentCount || 0);
    if (!gateResult.allowed) {
      return forbiddenError(
        gateResult.reason || MD_COLLECTION.FEATURE_DISABLED,
      );
    }

    // 4. 解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const contentTypeParam = formData.get("contentType") as string | null;
    const userTagsParam = formData.get("userTags") as string | null;
    const folderIdParam = formData.get("folderId") as string | null;

    if (!file) {
      return badRequestError("请选择要上传的文件");
    }

    // 5. 验证文件类型
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf("."));
    const mimeType = file.type;

    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(fileExtension)) {
      return badRequestError(MD_COLLECTION.INVALID_FILE_TYPE);
    }

    if (
      mimeType &&
      !(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)
    ) {
      // 有些系统可能返回空的 MIME 类型，只在有值时验证
      logger.warn(
        { mimeType, fileName },
        "Unknown MIME type, proceeding anyway",
      );
    }

    // 6. 验证文件大小
    if (file.size > MD_COLLECTION_LIMITS.maxFileSize) {
      return badRequestError(MD_COLLECTION.FILE_TOO_LARGE);
    }

    // 7. 读取文件内容
    const rawContent = await file.text();

    // 8. 验证内容
    const contentValidation = validateMarkdownContent(rawContent);
    if (!contentValidation.valid) {
      return badRequestError(
        contentValidation.error || MD_COLLECTION.CONTENT_REQUIRED,
      );
    }

    // 9. 清理内容
    const sanitizedContent = sanitizeMarkdownContent(rawContent);

    // 10. 计算内容哈希
    const contentHash = computeContentHash(sanitizedContent);

    // 11. 检查重复
    // 类型断言: 手动维护类型文件时需要此断言
    type ExistingCollectionRow = { id: number; title: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingCollection, error: dupError } = await (supabase.from("md_collections") as any)
      .select("id, title")
      .eq("user_id", user.id)
      .eq("content_hash", contentHash)
      .is("deleted_at", null)
      .maybeSingle() as { data: ExistingCollectionRow | null; error: { message: string } | null };

    if (dupError) {
      logger.warn({ error: dupError }, "Failed to check duplicate");
    }

    if (existingCollection) {
      return forbiddenError(
        `${MD_COLLECTION.DUPLICATE_FOUND}: "${existingCollection.title}"`,
      );
    }

    // 12. 预处理 Markdown
    const preprocessResult = preprocessMarkdownForAI(sanitizedContent);

    // 13. 处理标题（从文件名或内容提取）
    const fileNameWithoutExt = fileName.replace(/\.(md|txt|markdown)$/i, "");
    const extractedTitle = extractTitle(sanitizedContent);
    const finalTitle = extractedTitle || fileNameWithoutExt || "无标题";

    // 14. 解析可选参数
    const contentType = contentTypeParam || "article";
    let userTags: string[] = [];
    if (userTagsParam) {
      try {
        userTags = JSON.parse(userTagsParam);
      } catch {
        // 尝试按逗号分隔
        userTags = userTagsParam
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }
    const folderId = folderIdParam ? parseInt(folderIdParam) : null;

    // 15. 创建记录
    // 类型断言: 手动维护类型文件时需要此断言
    type NewCollectionRow = { id: number; [key: string]: unknown };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newCollection, error: createError } = await (supabase.from("md_collections") as any)
      .insert({
        user_id: user.id,
        title: finalTitle,
        raw_content: sanitizedContent,
        content_hash: contentHash,
        content_type: contentType,
        word_count: preprocessResult.metadata.wordCount,
        code_block_count: preprocessResult.metadata.codeBlockCount,
        reading_time_minutes: preprocessResult.metadata.readingTimeMinutes,
        user_tags: userTags,
        folder_id: folderId,
        processing_status: "pending",
        source_type: "upload",
        source_filename: file.name,
      })
      .select()
      .single() as { data: NewCollectionRow | null; error: { message: string } | null };

    if (createError) {
      return databaseError(MD_COLLECTION.CREATE_ERROR, createError);
    }

    if (!newCollection) {
      return databaseError(MD_COLLECTION.CREATE_ERROR, { message: "Failed to create collection" });
    }

    logger.info(
      {
        userId: user.id,
        collectionId: newCollection.id,
        fileName: file.name,
        fileSize: file.size,
        wordCount: preprocessResult.metadata.wordCount,
        action: "md_collection_uploaded",
      },
      "MD collection created from file upload",
    );

    // 16. 异步触发 AI 处理（不阻塞响应）
    triggerMdAIProcessing(newCollection.id, user.id);

    return successResponse(newCollection, 201);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "upload_md_collection",
      },
      "POST /api/md-collections/upload error",
    );
    return internalError(MD_COLLECTION.UPLOAD_ERROR);
  }
}
