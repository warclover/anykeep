/**
 * 单个收藏 API 路由
 * GET /api/bookmarks/[id] - 获取收藏详情
 * PUT /api/bookmarks/[id] - 更新收藏
 * PATCH /api/bookmarks/[id] - 切换已读状态
 * DELETE /api/bookmarks/[id] - 删除收藏
 */

import type { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { updateBookmarkSchema, patchBookmarkSchema } from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  notFoundError,
  forbiddenError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { BookmarkUpdate } from "@/types/supabase";
import { BOOKMARK, AUTH } from "@/lib/constants/messages";
import { updateFolderProfilesOnBookmarkChange } from "@/lib/classification/server";

/**
 * GET /api/bookmarks/[id]
 * 获取单个收藏详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const bookmarkId = parseInt(id);

    if (isNaN(bookmarkId)) {
      return notFoundError(BOOKMARK.NOT_FOUND);
    }

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 查询收藏详情
    const { data: bookmark, error: queryError } = await supabase
      .from("bookmarks")
      .select("*, folders(name)")
      .eq("id", bookmarkId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (queryError) {
      if (queryError.code === "PGRST116") {
        return notFoundError(BOOKMARK.NOT_FOUND);
      }
      return databaseError(BOOKMARK.LOAD_ERROR, queryError);
    }

    // 3. 返回收藏详情
    return successResponse(bookmark);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "get_bookmark",
      },
      "GET /api/bookmarks/[id] error",
    );
    return internalError(BOOKMARK.LOAD_ERROR);
  }
}

/**
 * PUT /api/bookmarks/[id]
 * 更新收藏信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const bookmarkId = parseInt(id);

    if (isNaN(bookmarkId)) {
      return notFoundError(BOOKMARK.NOT_FOUND);
    }

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = updateBookmarkSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const {
      title,
      description,
      folderId,
      userTags,
      notes,
      rating,
      isLocked,
      isMarkedForDeletion,
    } = validation.data;

    // 3. 检查收藏是否存在且属于当前用户（包含 folder_id 用于 profile 更新）
    const { data: existingBookmark, error: checkError } = await supabase
      .from("bookmarks")
      .select("id, user_id, folder_id")
      .eq("id", bookmarkId)
      .is("deleted_at", null)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(BOOKMARK.NOT_FOUND);
      }
      return databaseError(BOOKMARK.LOAD_ERROR, checkError);
    }

    if (existingBookmark.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 记录原始 folder_id（用于后续 profile 更新）
    const originalFolderId = existingBookmark.folder_id;

    // 4. 构建更新数据
    const updateData: BookmarkUpdate = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (folderId !== undefined) updateData.folder_id = folderId;
    if (userTags !== undefined) updateData.user_tags = userTags;
    if (notes !== undefined) updateData.notes = notes || null;
    // V6.0新增：评级和锁定功能
    if (rating !== undefined) updateData.rating = rating;
    if (isLocked !== undefined) updateData.is_locked = isLocked;
    if (isMarkedForDeletion !== undefined)
      updateData.is_marked_for_deletion = isMarkedForDeletion;

    // 5. 更新收藏
    const { data: updatedBookmark, error: updateError } = await supabase
      .from("bookmarks")
      .update(updateData)
      .eq("id", bookmarkId)
      .select("*, folders(name)")
      .single();

    if (updateError) {
      return databaseError(BOOKMARK.UPDATE_ERROR, updateError);
    }

    // 5.5 如果 folderId 变更，异步更新源和目标文件夹的 profile
    if (folderId !== undefined && folderId !== originalFolderId) {
      updateFolderProfilesOnBookmarkChange(
        [originalFolderId],
        folderId,
        user.id,
      ).catch((err) => {
        logger.warn(
          { error: err },
          "Failed to update folder profiles after bookmark update",
        );
      });
    }

    // 6. 返回更新后的收藏
    return successResponse(updatedBookmark);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "update_bookmark",
      },
      "PUT /api/bookmarks/[id] error",
    );
    return internalError(BOOKMARK.UPDATE_ERROR);
  }
}

/**
 * PATCH /api/bookmarks/[id]
 * 切换已读状态或星标状态
 * V8.0: 支持星标/Pin置顶功能
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const bookmarkId = parseInt(id);

    if (isNaN(bookmarkId)) {
      return notFoundError(BOOKMARK.NOT_FOUND);
    }

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = patchBookmarkSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { isRead, isStarred } = validation.data;

    // 3. 检查收藏是否存在且属于当前用户
    const { data: existingBookmark, error: checkError } = await supabase
      .from("bookmarks")
      .select("id, user_id")
      .eq("id", bookmarkId)
      .is("deleted_at", null)
      .single();

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(BOOKMARK.NOT_FOUND);
      }
      return databaseError(BOOKMARK.LOAD_ERROR, checkError);
    }

    if (existingBookmark.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // 4. 构建更新数据
    const updateData: BookmarkUpdate = {};
    const now = new Date().toISOString();

    // 处理已读状态
    if (isRead !== undefined) {
      updateData.is_read = isRead;
      updateData.read_at = isRead ? now : null;
    }

    // 处理星标状态
    if (isStarred !== undefined) {
      updateData.is_starred = isStarred;
      updateData.starred_at = isStarred ? now : null;
    }

    const { data: updatedBookmark, error: updateError } = await supabase
      .from("bookmarks")
      .update(updateData)
      .eq("id", bookmarkId)
      .select("*, folders(name)")
      .single();

    if (updateError) {
      return databaseError(BOOKMARK.UPDATE_ERROR, updateError);
    }

    logger.info(
      {
        bookmarkId,
        isRead,
        isStarred,
        action: "patch_bookmark_status",
      },
      "PATCH: Bookmark status updated",
    );

    // 5. 返回更新后的收藏
    return successResponse(updatedBookmark);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "patch_bookmark_status",
      },
      "PATCH /api/bookmarks/[id] error",
    );
    return internalError(BOOKMARK.UPDATE_ERROR);
  }
}

/**
 * DELETE /api/bookmarks/[id]
 * 删除收藏（移入垃圾箱，30天后永久删除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const bookmarkId = parseInt(id);
    logger.debug(
      {
        bookmarkId,
        action: "delete_start",
      },
      "DELETE: Bookmark ID",
    );

    if (isNaN(bookmarkId)) {
      return notFoundError(BOOKMARK.NOT_FOUND);
    }

    // 1. 验证用户身份
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    logger.debug(
      {
        userId: user?.id,
        authError: authError?.message,
        action: "auth_check",
      },
      "DELETE: User authentication",
    );

    if (authError || !user) {
      return unauthorizedError();
    }

    // 2. 检查收藏是否存在且属于当前用户（包含 folder_id 用于 profile 更新）
    const { data: existingBookmark, error: checkError } = await supabase
      .from("bookmarks")
      .select("id, user_id, is_locked, is_in_trash, folder_id")
      .eq("id", bookmarkId)
      .is("deleted_at", null)
      .single();

    logger.debug(
      {
        existingBookmark,
        checkError: checkError?.message,
        action: "bookmark_check",
      },
      "DELETE: Existing bookmark",
    );

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(BOOKMARK.NOT_FOUND);
      }
      return databaseError(BOOKMARK.LOAD_ERROR, checkError);
    }

    if (existingBookmark.user_id !== user.id) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // V6.0：检查是否已锁定
    if (existingBookmark.is_locked) {
      return forbiddenError(BOOKMARK.LOCKED_CANNOT_DELETE);
    }

    // 3. 移入垃圾箱（而非永久删除）
    const serviceClient = await createServiceClient();
    const { error: moveToTrashError } = await serviceClient
      .from("bookmarks")
      .update({
        is_in_trash: true,
        trashed_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId);

    logger.debug(
      {
        moveToTrashError: moveToTrashError?.message,
        action: "move_to_trash",
      },
      "DELETE: Move to trash operation",
    );

    if (moveToTrashError) {
      return databaseError(BOOKMARK.DELETE_ERROR(1), moveToTrashError);
    }

    // 3.5 异步更新源文件夹的 profile（书签离开该文件夹）
    if (existingBookmark.folder_id !== null) {
      updateFolderProfilesOnBookmarkChange(
        [existingBookmark.folder_id],
        null, // 移入垃圾箱，无目标文件夹
        user.id,
      ).catch((err) => {
        logger.warn(
          { error: err },
          "Failed to update folder profile after bookmark deletion",
        );
      });
    }

    // 注意：不减少存储计数，因为收藏还在垃圾箱中
    // 只有永久删除时才减少存储计数

    // 4. 返回成功响应
    logger.info(
      {
        bookmarkId,
        action: "moved_to_trash",
      },
      "DELETE: Moved to trash successfully",
    );
    return successResponse({
      id: bookmarkId,
      deleted: false, // 未永久删除
      movedToTrash: true,
      message: "已移入垃圾箱，30天后自动永久删除",
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "delete_bookmark",
      },
      "DELETE /api/bookmarks/[id] error",
    );
    return internalError(BOOKMARK.DELETE_ERROR(1));
  }
}
