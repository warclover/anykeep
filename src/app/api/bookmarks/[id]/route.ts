/**
 * 单个收藏 API 路由
 * GET /api/bookmarks/[id] - 获取收藏详情
 * PUT /api/bookmarks/[id] - 更新收藏
 * PATCH /api/bookmarks/[id] - 切换已读状态
 * DELETE /api/bookmarks/[id] - 删除收藏
 */

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { updateBookmarkSchema, patchBookmarkSchema } from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  notFoundError,
  forbiddenError,
  databaseError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { BookmarkUpdate } from "@/types/supabase";
import { BOOKMARK, AUTH } from "@/lib/constants/messages";
import { updateFolderProfilesOnBookmarkChange } from "@/lib/folder-profile/manager";
import { triggerMoveLearning } from "@/lib/classification-learning/trigger-move-learning";
import { BOOKMARK_DETAIL_FIELDS } from "@/lib/constants/query-fields";
import { withAuthMiddleware } from "@/lib/api/middleware";
// NOTE: 公共类型已提取到 @/types/api-helpers，后续重构时使用

/**
 * V4.2.1: HTTP 缓存配置（详情页）
 * - private: 仅客户端缓存（用户数据敏感）
 * - max-age=30: 30 秒内使用缓存（详情变化频率较高）
 * - stale-while-revalidate=60: 缓存过期后 1 分钟内可后台刷新
 */
const DETAIL_CACHE_CONTROL = "private, max-age=30, stale-while-revalidate=60";

/**
 * V4.2.7: 生成数据版本号
 * 用于客户端缓存失效验证
 */
function generateDataVersion(): string {
  return Date.now().toString();
}

/**
 * GET /api/bookmarks/[id]
 * 获取单个收藏详情
 */
export const GET = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
    const { id } = await params;
    const bookmarkId = parseInt(id);

    if (isNaN(bookmarkId)) {
      return notFoundError(BOOKMARK.NOT_FOUND);
    }

    // 2. 查询收藏详情
    const supabase = await createClient();
    // V4.2.1: 使用统一字段常量
    const { data: bookmark, error: queryError } = await supabase
      .from("bookmarks")
      .select(BOOKMARK_DETAIL_FIELDS)
      .eq("id", bookmarkId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (queryError) {
      if (queryError.code === "PGRST116") {
        return notFoundError(BOOKMARK.NOT_FOUND);
      }
      return databaseError(BOOKMARK.LOAD_ERROR, queryError);
    }

    // 3. 返回收藏详情（带缓存头）
    return NextResponse.json(
      { success: true, data: bookmark },
      {
        status: 200,
        headers: {
          "Cache-Control": DETAIL_CACHE_CONTROL,
        },
      },
    );
  },
);

/**
 * PUT /api/bookmarks/[id]
 * 更新收藏信息
 */
export const PUT = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    const { id } = await params;
    const bookmarkId = parseInt(id);

    if (isNaN(bookmarkId)) {
      return notFoundError(BOOKMARK.NOT_FOUND);
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

    // 3. 检查收藏是否存在且属于当前用户（包含 folder_id + ai_tags 用于 profile 更新和学习）
    const supabase = await createClient();
    // 类型断言: 手动维护类型文件时需要此断言
    const { data: existingBookmark, error: checkError } = (await supabase
      .from("bookmarks")
      .select("id, user_id, folder_id, ai_tags")
      .eq("id", bookmarkId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: {
        id: number;
        user_id: string;
        folder_id: number | null;
        ai_tags: string[] | null;
      } | null;
      error: { code?: string; message: string } | null;
    };

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(BOOKMARK.NOT_FOUND);
      }
      return databaseError(BOOKMARK.LOAD_ERROR, checkError);
    }

    if (!existingBookmark) {
      return notFoundError(BOOKMARK.NOT_FOUND);
    }

    if (existingBookmark.user_id !== userId) {
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
    // 使用类型断言替代 `as any`，保持类型安全的同时处理关联查询
    type BookmarkWithFolder = {
      id: number;
      title: string;
      folder_id: number | null;
      folders: { name: string } | null;
      [key: string]: unknown;
    };

    const { data: updatedBookmark, error: updateError } = await supabase
      .from("bookmarks")
      .update(updateData)
      .eq("id", bookmarkId)
      .select("*, folders!bookmarks_folder_id_fkey(name)")
      .single<BookmarkWithFolder>();

    if (updateError) {
      return databaseError(BOOKMARK.UPDATE_ERROR, updateError);
    }

    // 5.5 如果 folderId 变更，异步更新源和目标文件夹的 profile
    if (folderId !== undefined && folderId !== originalFolderId) {
      updateFolderProfilesOnBookmarkChange(
        [originalFolderId],
        folderId,
        userId,
      ).catch((err) => {
        logger.warn(
          { error: err },
          "Failed to update folder profiles after bookmark update",
        );
      });

      // 5.6 异步触发 AI 学习（不阻塞响应）
      triggerMoveLearning({
        userId,
        bookmarks: [
          {
            id: bookmarkId,
            folder_id: originalFolderId,
            ai_tags: existingBookmark.ai_tags,
          },
        ],
        targetFolderId: folderId,
      }).catch((err) => {
        logger.warn(
          { error: err },
          "Failed to trigger move learning after bookmark update",
        );
      });
    }

    // 6. 返回更新后的收藏
    return successResponse(updatedBookmark);
  },
);

/**
 * PATCH /api/bookmarks/[id]
 * 切换已读状态或星标状态
 * V8.0: 支持星标/Pin置顶功能
 */
export const PATCH = withAuthMiddleware<{ id: string }>(
  async (request, { userId, params }) => {
    const { id } = await params;
    const bookmarkId = parseInt(id);

    if (isNaN(bookmarkId)) {
      return notFoundError(BOOKMARK.NOT_FOUND);
    }

    // 2. 解析并验证请求体
    const supabase = await createClient();
    const body = await request.json();
    const validation = patchBookmarkSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { isRead, isStarred } = validation.data;

    // 3. 检查收藏是否存在且属于当前用户
    // 类型断言: 手动维护类型文件时需要此断言
    const { data: existingBookmark, error: checkError } = (await supabase
      .from("bookmarks")
      .select("id, user_id")
      .eq("id", bookmarkId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: { id: number; user_id: string } | null;
      error: { code?: string; message: string } | null;
    };

    if (checkError) {
      if (checkError.code === "PGRST116") {
        return notFoundError(BOOKMARK.NOT_FOUND);
      }
      return databaseError(BOOKMARK.LOAD_ERROR, checkError);
    }

    if (!existingBookmark) {
      return notFoundError(BOOKMARK.NOT_FOUND);
    }

    if (existingBookmark.user_id !== userId) {
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

    // 使用类型断言替代 `as any`
    type BookmarkWithFolderPatch = {
      id: number;
      is_read: boolean;
      is_starred: boolean;
      folders: { name: string } | null;
      [key: string]: unknown;
    };

    const { data: updatedBookmark, error: updateError } = await supabase
      .from("bookmarks")
      .update(updateData)
      .eq("id", bookmarkId)
      .select("*, folders!bookmarks_folder_id_fkey(name)")
      .single<BookmarkWithFolderPatch>();

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
    // V4.2.7: 添加数据版本号用于客户端缓存失效
    return successResponse({
      ...(updatedBookmark as Record<string, unknown>),
      dataVersion: generateDataVersion(),
    });
  },
);

/**
 * DELETE /api/bookmarks/[id]
 * 删除收藏（移入垃圾箱，30天后永久删除）
 */
export const DELETE = withAuthMiddleware<{ id: string }>(
  async (_request, { userId, params }) => {
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

    // 2. 检查收藏是否存在且属于当前用户（包含 folder_id 用于 profile 更新）
    const supabase = await createClient();
    // 类型断言: 手动维护类型文件时需要此断言
    const { data: existingBookmark, error: checkError } = (await supabase
      .from("bookmarks")
      .select("id, user_id, is_locked, is_in_trash, folder_id")
      .eq("id", bookmarkId)
      .is("deleted_at", null)
      .single()) as unknown as {
      data: {
        id: number;
        user_id: string;
        is_locked: boolean;
        is_in_trash: boolean;
        folder_id: number | null;
      } | null;
      error: { code?: string; message: string } | null;
    };

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

    if (!existingBookmark) {
      return notFoundError(BOOKMARK.NOT_FOUND);
    }

    if (existingBookmark.user_id !== userId) {
      return forbiddenError(AUTH.FORBIDDEN);
    }

    // V6.0：检查是否已锁定
    if (existingBookmark.is_locked) {
      return forbiddenError(BOOKMARK.LOCKED_CANNOT_DELETE);
    }

    // 3. 移入垃圾箱（而非永久删除）
    // 使用 Service Client 绕过 RLS，但已验证用户所有权
    const serviceClient = await createServiceClient();
    const { error: moveToTrashError } = await serviceClient
      .from("bookmarks")
      .update({
        is_in_trash: true,
        trashed_at: new Date().toISOString(),
      })
      .eq("id", bookmarkId)
      .eq("user_id", userId); // 双重保险：即使用 Service Client 也验证所有权

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
        userId,
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
    // V4.2.7: 添加数据版本号用于客户端缓存失效
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
      dataVersion: generateDataVersion(),
    });
  },
);
