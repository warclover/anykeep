/**
 * 书签导出 API
 * GET /api/browser-bookmark/export - 导出书签为 HTML 格式
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorizedError, badRequestError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import {
  generateBookmarkHtml,
  generateExportFilename,
  type ExportBookmark,
} from "@/lib/browser-bookmark/exporter";
import type { Platform } from "@/types/supabase";

/**
 * GET /api/browser-bookmark/export
 * 导出书签为 Netscape Bookmark HTML 格式
 *
 * Query params:
 * - platform: 筛选平台（可选，多个用逗号分隔）
 * - folderId: 筛选文件夹（可选）
 * - includeFolders: 是否包含文件夹结构（默认 true）
 * - groupByPlatform: 是否按平台分组（默认 false）
 */
export async function GET(request: NextRequest) {
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

    // 2. 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const platformsParam = searchParams.get("platform");
    const folderIdParam = searchParams.get("folderId");
    const includeFolders = searchParams.get("includeFolders") !== "false";
    const groupByPlatform = searchParams.get("groupByPlatform") === "true";

    // 解析平台列表
    const platforms = platformsParam
      ? (platformsParam.split(",").filter(Boolean) as Platform[])
      : null;

    // 3. 构建查询
    let query = supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        url,
        description,
        platform,
        created_at,
        folder_id,
        folders!bookmarks_folder_id_fkey (
          id,
          name,
          parent_id
        )
      `,
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // 平台筛选
    if (platforms && platforms.length > 0) {
      query = query.in("platform", platforms);
    }

    // 文件夹筛选
    if (folderIdParam) {
      const folderId = parseInt(folderIdParam, 10);
      if (!isNaN(folderId)) {
        query = query.eq("folder_id", folderId);
      }
    }

    // 4. 执行查询
    const { data: bookmarks, error: queryError } = await query;

    if (queryError) {
      logger.error(
        { error: queryError.message, userId: user.id },
        "Export query failed",
      );
      return badRequestError("查询书签失败");
    }

    if (!bookmarks || bookmarks.length === 0) {
      return badRequestError("没有可导出的书签");
    }

    // 5. 获取所有文件夹用于构建路径
    const { data: allFolders } = await supabase
      .from("folders")
      .select("id, name, parent_id")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    // 构建文件夹 ID 到路径的映射
    const folderPathMap = new Map<number, string[]>();
    if (allFolders) {
      const folderMap = new Map(allFolders.map((f) => [f.id, f]));

      function getFolderPath(folderId: number): string[] {
        if (folderPathMap.has(folderId)) {
          return folderPathMap.get(folderId)!;
        }

        const folder = folderMap.get(folderId);
        if (!folder) {
          return [];
        }

        const path = folder.parent_id
          ? [...getFolderPath(folder.parent_id), folder.name]
          : [folder.name];

        folderPathMap.set(folderId, path);
        return path;
      }

      // 预计算所有路径
      for (const folder of allFolders) {
        getFolderPath(folder.id);
      }
    }

    // 6. 转换为导出格式
    const exportBookmarks: ExportBookmark[] = bookmarks.map((bookmark) => ({
      title: bookmark.title || "无标题",
      url: bookmark.url,
      addedAt: bookmark.created_at ?? undefined,
      description: bookmark.description || undefined,
      folderPath: bookmark.folder_id
        ? folderPathMap.get(bookmark.folder_id)
        : undefined,
      platform: bookmark.platform as Platform,
    }));

    // 7. 生成 HTML
    const html = generateBookmarkHtml(exportBookmarks, {
      includeFolders,
      groupByPlatform,
      rootFolderName: "AnyKeep 导出",
    });

    // 8. 生成文件名
    const filename = generateExportFilename(
      platforms && platforms.length === 1 ? platforms[0] : undefined,
    );

    logger.info(
      {
        userId: user.id,
        count: bookmarks.length,
        platforms: platforms?.join(",") || "all",
        includeFolders,
        groupByPlatform,
      },
      "Bookmarks exported",
    );

    // 9. 返回 HTML 文件
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "GET /api/browser-bookmark/export error",
    );
    return badRequestError("导出失败，请稍后重试");
  }
}
