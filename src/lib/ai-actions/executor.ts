/**
 * AI Actions 执行器
 *
 * 职责：
 * - 统一执行 AI 操作请求
 * - 权限验证和审计
 * - 调用底层数据服务
 * - 返回结构化结果
 *
 * @version 1.0.0
 * @since 2025-12-22
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase query result types require any for nested joins */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  AIActionType,
  AIActionRequest,
  AIActionResult,
  BookmarkBrief,
  FolderBrief,
  TagBrief,
  UserStatsBrief,
} from "./types";
import {
  isWriteAction as checkWriteAction,
  getDefaultConfirmationRequirement as getConfirmation,
  getActionDescription as getDescription,
} from "./types";

// ============================================================================
// 执行上下文
// ============================================================================

/**
 * AI Action 执行上下文
 */
export interface AIActionContext {
  /** 用户 ID */
  userId: string;
  /** 追踪 ID */
  traceId?: string;
  /** 是否已确认（用于写入操作） */
  confirmed?: boolean;
}

// ============================================================================
// AI Action 执行器
// ============================================================================

/**
 * AI Action 执行器类
 */
export class AIActionExecutor {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private context: AIActionContext;

  private constructor(
    supabase: Awaited<ReturnType<typeof createClient>>,
    context: AIActionContext,
  ) {
    this.supabase = supabase;
    this.context = context;
  }

  /**
   * 创建执行器实例
   */
  static async create(context: AIActionContext): Promise<AIActionExecutor> {
    const supabase = await createClient();
    return new AIActionExecutor(supabase, context);
  }

  /**
   * 执行 AI 操作
   */
  async execute<T extends AIActionType>(
    request: AIActionRequest<T>,
  ): Promise<AIActionResult> {
    const startTime = performance.now();
    const {
      type,
      params,
      requiresConfirmation,
      description: _description,
    } = request;

    logger.info(
      {
        userId: this.context.userId,
        action: type,
        traceId: this.context.traceId,
      },
      `AI Action executing: ${getDescription(type)}`,
    );

    try {
      // 1. 检查是否需要确认
      const needsConfirm = requiresConfirmation ?? getConfirmation(type);

      if (checkWriteAction(type) && needsConfirm && !this.context.confirmed) {
        return this.buildConfirmation(type, params as Record<string, unknown>);
      }

      // 2. 执行具体操作
      const result = await this.executeAction(
        type,
        params as Record<string, unknown>,
      );

      const latencyMs = Math.round(performance.now() - startTime);
      logger.info(
        {
          userId: this.context.userId,
          action: type,
          latencyMs,
          success: result.success,
        },
        `AI Action completed: ${getDescription(type)}`,
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(
        {
          userId: this.context.userId,
          action: type,
          error: errorMessage,
        },
        `AI Action failed: ${getDescription(type)}`,
      );

      return {
        success: false,
        error: errorMessage,
        errorCode: "EXECUTION_ERROR",
      };
    }
  }

  /**
   * 构建确认请求
   */
  private buildConfirmation(
    type: AIActionType,
    params: Record<string, unknown>,
  ): AIActionResult {
    const actionDesc = getDescription(type);
    let affectedCount = 1;
    const actions: string[] = [actionDesc];

    // 计算影响数量
    if ("bookmarkIds" in params && Array.isArray(params.bookmarkIds)) {
      affectedCount = params.bookmarkIds.length;
    }
    if ("tags" in params && Array.isArray(params.tags)) {
      actions.push(`涉及 ${params.tags.length} 个标签`);
    }

    return {
      success: false,
      needsConfirmation: true,
      confirmation: {
        message: `确认执行「${actionDesc}」操作？`,
        actions,
        affectedCount,
        reversible: !type.includes("delete"),
      },
    };
  }

  /**
   * 执行具体操作（路由到对应处理器）
   */
  private async executeAction(
    type: AIActionType,
    params: Record<string, unknown>,
  ): Promise<AIActionResult> {
    switch (type) {
      // ========== 书签读取操作 ==========
      case "bookmark:search":
        return this.bookmarkSearch(params);
      case "bookmark:get":
        return this.bookmarkGet(params);
      case "bookmark:list":
        return this.bookmarkList(params);
      case "bookmark:related":
        return this.bookmarkRelated(params);

      // ========== 书签写入操作 ==========
      case "bookmark:create":
        return this.bookmarkCreate(params);
      case "bookmark:update":
        return this.bookmarkUpdate(params);
      case "bookmark:move":
        return this.bookmarkMove(params);
      case "bookmark:delete":
        return this.bookmarkDelete(params);
      case "bookmark:rate":
        return this.bookmarkRate(params);

      // ========== 文件夹操作 ==========
      case "folder:list":
        return this.folderList(params);
      case "folder:get":
        return this.folderGet(params);
      case "folder:bookmarks":
        return this.folderBookmarks(params);
      case "folder:create":
        return this.folderCreate(params);
      case "folder:update":
        return this.folderUpdate(params);
      case "folder:delete":
        return this.folderDelete(params);

      // ========== 标签操作 ==========
      case "tag:list":
        return this.tagList(params);
      case "tag:bookmarks":
        return this.tagBookmarks(params);
      case "tag:add":
        return this.tagAdd(params);
      case "tag:remove":
        return this.tagRemove(params);
      case "tag:batch_add":
        return this.tagBatchAdd(params);
      case "tag:batch_remove":
        return this.tagBatchRemove(params);

      // ========== 用户操作 ==========
      case "user:preferences":
        return this.userPreferences();
      case "user:stats":
        return this.userStats(params);

      default:
        return {
          success: false,
          error: `Unknown action type: ${type}`,
          errorCode: "UNKNOWN_ACTION",
        };
    }
  }

  // ============================================================================
  // 书签操作实现
  // ============================================================================

  private async bookmarkSearch(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<BookmarkBrief[]>> {
    const {
      query,
      limit = 20,
      folderId,
      tags,
      platform,
    } = params as {
      query: string;
      limit?: number;
      folderId?: number;
      tags?: string[];
      platform?: string;
    };

    let queryBuilder = this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, description, user_tags, platform, rating, created_at, folders(name)",
      )
      .eq("user_id", this.context.userId)
      .is("deleted_at", null)
      .or(
        `title.ilike.%${query}%,description.ilike.%${query}%,url.ilike.%${query}%`,
      )
      .limit(limit);

    if (folderId) {
      queryBuilder = queryBuilder.eq("folder_id", folderId);
    }
    if (platform) {
      queryBuilder = queryBuilder.eq("platform", platform);
    }
    if (tags && tags.length > 0) {
      queryBuilder = queryBuilder.overlaps("user_tags", tags);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    const bookmarks: BookmarkBrief[] = (data || []).map((b: any) => ({
      id: b.id,
      title: b.title || "",
      url: b.url,
      description: b.description ?? undefined,
      tags: b.user_tags || [],
      folderName: b.folders?.name ?? undefined,
      platform: b.platform || "OTHER",
      rating: b.rating ?? undefined,
      createdAt: b.created_at ?? new Date().toISOString(),
    }));

    return {
      success: true,
      data: bookmarks,
      summary: `搜索到 ${bookmarks.length} 条与「${query}」相关的书签`,
    };
  }

  private async bookmarkGet(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<BookmarkBrief>> {
    const { id } = params as { id: number };

    const { data, error } = await this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, description, user_tags, platform, rating, created_at, folders(name)",
      )
      .eq("id", id)
      .eq("user_id", this.context.userId)
      .single();

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    const bookmark: BookmarkBrief = {
      id: data.id,
      title: data.title || "",
      url: data.url,
      description: data.description ?? undefined,
      tags: data.user_tags || [],
      folderName: (data.folders as any)?.name ?? undefined,
      platform: data.platform || "OTHER",
      rating: data.rating ?? undefined,
      createdAt: data.created_at ?? new Date().toISOString(),
    };

    return {
      success: true,
      data: bookmark,
      summary: `获取书签「${bookmark.title}」详情`,
    };
  }

  private async bookmarkList(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<BookmarkBrief[]>> {
    const {
      folderId,
      tags,
      platform,
      limit = 20,
      offset = 0,
      sortBy = "created_at",
      sortOrder = "desc",
    } = params as {
      folderId?: number;
      tags?: string[];
      platform?: string;
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    };

    let queryBuilder = this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, description, user_tags, platform, rating, created_at, folders(name)",
      )
      .eq("user_id", this.context.userId)
      .is("deleted_at", null)
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + limit - 1);

    if (folderId) {
      queryBuilder = queryBuilder.eq("folder_id", folderId);
    }
    if (platform) {
      queryBuilder = queryBuilder.eq("platform", platform);
    }
    if (tags && tags.length > 0) {
      queryBuilder = queryBuilder.overlaps("user_tags", tags);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    const bookmarks: BookmarkBrief[] = (data || []).map((b: any) => ({
      id: b.id,
      title: b.title || "",
      url: b.url,
      description: b.description ?? undefined,
      tags: b.user_tags || [],
      folderName: b.folders?.name ?? undefined,
      platform: b.platform || "OTHER",
      rating: b.rating ?? undefined,
      createdAt: b.created_at ?? new Date().toISOString(),
    }));

    return {
      success: true,
      data: bookmarks,
      summary: `获取到 ${bookmarks.length} 条书签`,
    };
  }

  private async bookmarkRelated(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<BookmarkBrief[]>> {
    const { bookmarkId, limit = 5 } = params as {
      bookmarkId: number;
      limit?: number;
    };

    // 先获取当前书签的标签
    const { data: currentBookmark, error: fetchError } = await this.supabase
      .from("bookmarks")
      .select("user_tags, folder_id")
      .eq("id", bookmarkId)
      .eq("user_id", this.context.userId)
      .single();

    if (fetchError) {
      return {
        success: false,
        error: fetchError.message,
        errorCode: "DB_ERROR",
      };
    }

    // 根据标签查找相关书签
    const tags = currentBookmark?.user_tags || [];
    let queryBuilder = this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, description, user_tags, platform, rating, created_at, folders(name)",
      )
      .eq("user_id", this.context.userId)
      .is("deleted_at", null)
      .neq("id", bookmarkId)
      .limit(limit);

    if (tags.length > 0) {
      queryBuilder = queryBuilder.overlaps("user_tags", tags);
    } else if (currentBookmark?.folder_id) {
      queryBuilder = queryBuilder.eq("folder_id", currentBookmark.folder_id);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    const bookmarks: BookmarkBrief[] = (data || []).map((b: any) => ({
      id: b.id,
      title: b.title || "",
      url: b.url,
      description: b.description ?? undefined,
      tags: b.user_tags || [],
      folderName: b.folders?.name ?? undefined,
      platform: b.platform || "OTHER",
      rating: b.rating ?? undefined,
      createdAt: b.created_at ?? new Date().toISOString(),
    }));

    return {
      success: true,
      data: bookmarks,
      summary: `找到 ${bookmarks.length} 条相关书签`,
    };
  }

  private async bookmarkCreate(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<BookmarkBrief>> {
    const { url, title, description, folderId, tags } = params as {
      url: string;
      title?: string;
      description?: string;
      folderId?: number;
      tags?: string[];
    };

    const { data, error } = await this.supabase
      .from("bookmarks")
      .insert({
        user_id: this.context.userId,
        url,
        title: title || url,
        description,
        folder_id: folderId,
        user_tags: tags || [],
        platform: "OTHER",
      })
      .select(
        "id, title, url, description, user_tags, platform, rating, created_at",
      )
      .single();

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    const bookmark: BookmarkBrief = {
      id: data.id,
      title: data.title || "",
      url: data.url,
      description: data.description ?? undefined,
      tags: data.user_tags || [],
      platform: data.platform || "OTHER",
      rating: data.rating ?? undefined,
      createdAt: data.created_at ?? new Date().toISOString(),
    };

    return {
      success: true,
      data: bookmark,
      affectedIds: [data.id],
      summary: `创建书签「${bookmark.title}」成功`,
    };
  }

  private async bookmarkUpdate(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<BookmarkBrief>> {
    const { id, title, description, tags, folderId, rating, isStarred } =
      params as {
        id: number;
        title?: string;
        description?: string;
        tags?: string[];
        folderId?: number;
        rating?: number;
        isStarred?: boolean;
      };

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.user_tags = tags;
    if (folderId !== undefined) updateData.folder_id = folderId;
    if (rating !== undefined) updateData.rating = rating;
    if (isStarred !== undefined) updateData.is_starred = isStarred;

    const { data, error } = await this.supabase
      .from("bookmarks")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", this.context.userId)
      .select(
        "id, title, url, description, user_tags, platform, rating, created_at",
      )
      .single();

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    const bookmark: BookmarkBrief = {
      id: data.id,
      title: data.title || "",
      url: data.url,
      description: data.description ?? undefined,
      tags: data.user_tags || [],
      platform: data.platform || "OTHER",
      rating: data.rating ?? undefined,
      createdAt: data.created_at ?? new Date().toISOString(),
    };

    return {
      success: true,
      data: bookmark,
      affectedIds: [id],
      summary: `更新书签「${bookmark.title}」成功`,
    };
  }

  private async bookmarkMove(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<{ movedCount: number }>> {
    const { bookmarkIds, targetFolderId } = params as {
      bookmarkIds: number[];
      targetFolderId: number;
    };

    const { error } = await this.supabase
      .from("bookmarks")
      .update({ folder_id: targetFolderId })
      .in("id", bookmarkIds)
      .eq("user_id", this.context.userId);

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    return {
      success: true,
      data: { movedCount: bookmarkIds.length },
      affectedIds: bookmarkIds,
      summary: `移动 ${bookmarkIds.length} 条书签成功`,
    };
  }

  private async bookmarkDelete(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<{ deletedCount: number }>> {
    const { bookmarkIds } = params as { bookmarkIds: number[] };

    // 软删除
    const { error } = await this.supabase
      .from("bookmarks")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", bookmarkIds)
      .eq("user_id", this.context.userId);

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    return {
      success: true,
      data: { deletedCount: bookmarkIds.length },
      affectedIds: bookmarkIds,
      summary: `删除 ${bookmarkIds.length} 条书签成功`,
    };
  }

  private async bookmarkRate(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<{ bookmarkId: number; rating: number }>> {
    const { bookmarkId, rating } = params as {
      bookmarkId: number;
      rating: number;
    };

    const { error } = await this.supabase
      .from("bookmarks")
      .update({ rating })
      .eq("id", bookmarkId)
      .eq("user_id", this.context.userId);

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    return {
      success: true,
      data: { bookmarkId, rating },
      affectedIds: [bookmarkId],
      summary: `书签评分设置为 ${rating} 星`,
    };
  }

  // ============================================================================
  // 文件夹操作实现
  // ============================================================================

  private async folderList(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<FolderBrief[]>> {
    const { parentId } = params as { parentId?: number };

    let queryBuilder = this.supabase
      .from("folders")
      .select("id, name, parent_id")
      .eq("user_id", this.context.userId)
      .order("order", { ascending: true });

    if (parentId !== undefined) {
      queryBuilder = queryBuilder.eq("parent_id", parentId);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    const folders: FolderBrief[] = (data || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      parentId: f.parent_id ?? undefined,
      bookmarkCount: 0,
      path: f.name, // 简化路径
    }));

    return {
      success: true,
      data: folders,
      summary: `获取到 ${folders.length} 个文件夹`,
    };
  }

  private async folderGet(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<FolderBrief>> {
    const { id } = params as { id: number };

    const { data, error } = await this.supabase
      .from("folders")
      .select("id, name, parent_id")
      .eq("id", id)
      .eq("user_id", this.context.userId)
      .single();

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    const folder: FolderBrief = {
      id: data.id,
      name: data.name,
      parentId: data.parent_id ?? undefined,
      bookmarkCount: 0,
      path: data.name,
    };

    return {
      success: true,
      data: folder,
      summary: `获取文件夹「${folder.name}」详情`,
    };
  }

  private async folderBookmarks(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<BookmarkBrief[]>> {
    const { folderId, limit = 20 } = params as {
      folderId: number;
      limit?: number;
    };

    const { data, error } = await this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, description, user_tags, platform, rating, created_at",
      )
      .eq("folder_id", folderId)
      .eq("user_id", this.context.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    const bookmarks: BookmarkBrief[] = (data || []).map((b: any) => ({
      id: b.id,
      title: b.title || "",
      url: b.url,
      description: b.description ?? undefined,
      tags: b.user_tags || [],
      platform: b.platform || "OTHER",
      rating: b.rating ?? undefined,
      createdAt: b.created_at ?? new Date().toISOString(),
    }));

    return {
      success: true,
      data: bookmarks,
      summary: `文件夹内有 ${bookmarks.length} 条书签`,
    };
  }

  private async folderCreate(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<FolderBrief>> {
    const {
      name,
      parentId,
      description: _description,
    } = params as {
      name: string;
      parentId?: number;
      description?: string;
    };

    const { data, error } = await this.supabase
      .from("folders")
      .insert({
        user_id: this.context.userId,
        name,
        parent_id: parentId,
      })
      .select("id, name, parent_id")
      .single();

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    const folder: FolderBrief = {
      id: data.id,
      name: data.name,
      parentId: data.parent_id ?? undefined,
      bookmarkCount: 0,
      path: data.name,
    };

    return {
      success: true,
      data: folder,
      affectedIds: [data.id],
      summary: `创建文件夹「${folder.name}」成功`,
    };
  }

  private async folderUpdate(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<FolderBrief>> {
    const { id, name, parentId } = params as {
      id: number;
      name?: string;
      parentId?: number;
    };

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (parentId !== undefined) updateData.parent_id = parentId;

    const { data, error } = await this.supabase
      .from("folders")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", this.context.userId)
      .select("id, name, parent_id")
      .single();

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    const folder: FolderBrief = {
      id: data.id,
      name: data.name,
      parentId: data.parent_id ?? undefined,
      bookmarkCount: 0,
      path: data.name,
    };

    return {
      success: true,
      data: folder,
      affectedIds: [id],
      summary: `更新文件夹「${folder.name}」成功`,
    };
  }

  private async folderDelete(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<{ deletedId: number }>> {
    const { id } = params as { id: number };

    const { error } = await this.supabase
      .from("folders")
      .delete()
      .eq("id", id)
      .eq("user_id", this.context.userId);

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    return {
      success: true,
      data: { deletedId: id },
      affectedIds: [id],
      summary: `删除文件夹成功`,
    };
  }

  // ============================================================================
  // 标签操作实现
  // ============================================================================

  private async tagList(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<TagBrief[]>> {
    const { limit = 50 } = params as { limit?: number };

    // 使用聚合查询获取标签和计数
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("user_tags")
      .eq("user_id", this.context.userId)
      .is("deleted_at", null);

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    // 统计标签
    const tagCounts = new Map<string, number>();
    for (const bookmark of data || []) {
      for (const tag of bookmark.user_tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const tags: TagBrief[] = Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return {
      success: true,
      data: tags,
      summary: `共有 ${tags.length} 个标签`,
    };
  }

  private async tagBookmarks(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<BookmarkBrief[]>> {
    const { tag, limit = 20 } = params as { tag: string; limit?: number };

    const { data, error } = await this.supabase
      .from("bookmarks")
      .select(
        "id, title, url, description, user_tags, platform, rating, created_at, folders(name)",
      )
      .eq("user_id", this.context.userId)
      .is("deleted_at", null)
      .contains("user_tags", [tag])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    const bookmarks: BookmarkBrief[] = (data || []).map((b: any) => ({
      id: b.id,
      title: b.title || "",
      url: b.url,
      description: b.description ?? undefined,
      tags: b.user_tags || [],
      folderName: b.folders?.name ?? undefined,
      platform: b.platform || "OTHER",
      rating: b.rating ?? undefined,
      createdAt: b.created_at ?? new Date().toISOString(),
    }));

    return {
      success: true,
      data: bookmarks,
      summary: `标签「${tag}」下有 ${bookmarks.length} 条书签`,
    };
  }

  private async tagAdd(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<{ bookmarkId: number; tags: string[] }>> {
    const { bookmarkId, tags } = params as {
      bookmarkId: number;
      tags: string[];
    };

    // 先获取现有标签
    const { data: existing, error: fetchError } = await this.supabase
      .from("bookmarks")
      .select("user_tags")
      .eq("id", bookmarkId)
      .eq("user_id", this.context.userId)
      .single();

    if (fetchError) {
      return {
        success: false,
        error: fetchError.message,
        errorCode: "DB_ERROR",
      };
    }

    // 合并标签（去重）
    const existingTags = existing?.user_tags || [];
    const newTags = [...new Set([...existingTags, ...tags])];

    const { error } = await this.supabase
      .from("bookmarks")
      .update({ user_tags: newTags })
      .eq("id", bookmarkId)
      .eq("user_id", this.context.userId);

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    return {
      success: true,
      data: { bookmarkId, tags: newTags },
      affectedIds: [bookmarkId],
      summary: `为书签添加 ${tags.length} 个标签`,
    };
  }

  private async tagRemove(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<{ bookmarkId: number; tags: string[] }>> {
    const { bookmarkId, tags } = params as {
      bookmarkId: number;
      tags: string[];
    };

    // 先获取现有标签
    const { data: existing, error: fetchError } = await this.supabase
      .from("bookmarks")
      .select("user_tags")
      .eq("id", bookmarkId)
      .eq("user_id", this.context.userId)
      .single();

    if (fetchError) {
      return {
        success: false,
        error: fetchError.message,
        errorCode: "DB_ERROR",
      };
    }

    // 移除标签
    const existingTags = existing?.user_tags || [];
    const newTags = existingTags.filter((t: string) => !tags.includes(t));

    const { error } = await this.supabase
      .from("bookmarks")
      .update({ user_tags: newTags })
      .eq("id", bookmarkId)
      .eq("user_id", this.context.userId);

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    return {
      success: true,
      data: { bookmarkId, tags: newTags },
      affectedIds: [bookmarkId],
      summary: `从书签移除 ${tags.length} 个标签`,
    };
  }

  private async tagBatchAdd(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<{ affectedCount: number }>> {
    const { bookmarkIds, tags } = params as {
      bookmarkIds: number[];
      tags: string[];
    };

    // 使用 RPC 函数批量添加
    const { error } = await this.supabase.rpc("batch_add_tags", {
      p_bookmark_ids: bookmarkIds,
      p_tags: tags,
    });

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    return {
      success: true,
      data: { affectedCount: bookmarkIds.length },
      affectedIds: bookmarkIds,
      summary: `为 ${bookmarkIds.length} 条书签添加 ${tags.length} 个标签`,
    };
  }

  private async tagBatchRemove(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<{ affectedCount: number }>> {
    const { bookmarkIds, tags } = params as {
      bookmarkIds: number[];
      tags: string[];
    };

    // 使用 RPC 函数批量移除
    const { error } = await this.supabase.rpc("batch_remove_tags", {
      p_bookmark_ids: bookmarkIds,
      p_tags: tags,
    });

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    return {
      success: true,
      data: { affectedCount: bookmarkIds.length },
      affectedIds: bookmarkIds,
      summary: `从 ${bookmarkIds.length} 条书签移除 ${tags.length} 个标签`,
    };
  }

  // ============================================================================
  // 用户操作实现
  // ============================================================================

  private async userPreferences(): Promise<
    AIActionResult<Record<string, unknown>>
  > {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("id", this.context.userId)
      .single();

    if (error) {
      return { success: false, error: error.message, errorCode: "DB_ERROR" };
    }

    return {
      success: true,
      data: data || {},
      summary: `获取用户偏好设置`,
    };
  }

  private async userStats(
    params: Record<string, unknown>,
  ): Promise<AIActionResult<UserStatsBrief>> {
    const { days = 30 } = params as { days?: number };

    // 并行获取统计数据
    const [bookmarkCount, folderCount, tagResult, recentBookmarks] =
      await Promise.all([
        this.supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", this.context.userId)
          .is("deleted_at", null),
        this.supabase
          .from("folders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", this.context.userId),
        this.supabase
          .from("bookmarks")
          .select("user_tags")
          .eq("user_id", this.context.userId)
          .is("deleted_at", null),
        this.supabase
          .from("bookmarks")
          .select("created_at")
          .eq("user_id", this.context.userId)
          .is("deleted_at", null)
          .gte(
            "created_at",
            new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          ),
      ]);

    // 统计唯一标签数
    const uniqueTags = new Set<string>();
    for (const bookmark of tagResult.data || []) {
      for (const tag of bookmark.user_tags || []) {
        uniqueTags.add(tag);
      }
    }

    // 统计最近活动
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const addedLast7Days = (recentBookmarks.data || []).filter(
      (b: { created_at: string | null }) =>
        b.created_at && new Date(b.created_at).getTime() > sevenDaysAgo,
    ).length;

    const stats: UserStatsBrief = {
      totalBookmarks: bookmarkCount.count || 0,
      totalFolders: folderCount.count || 0,
      totalTags: uniqueTags.size,
      recentActivity: {
        addedLast7Days,
        addedLast30Days: recentBookmarks.data?.length || 0,
      },
    };

    return {
      success: true,
      data: stats,
      summary: `共有 ${stats.totalBookmarks} 条书签、${stats.totalFolders} 个文件夹、${stats.totalTags} 个标签`,
    };
  }
}

/**
 * 快捷执行 AI Action
 */
export async function executeAIAction<T extends AIActionType>(
  context: AIActionContext,
  request: AIActionRequest<T>,
): Promise<AIActionResult> {
  const executor = await AIActionExecutor.create(context);
  return executor.execute(request);
}
