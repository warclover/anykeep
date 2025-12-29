/**
 * Browser Bookmark Export API v1
 *
 * GET /api/v1/browser-bookmark/export - 导出书签为 HTML 格式
 *
 * @module api/v1/browser-bookmark/export
 */

export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { withAuthMiddleware } from "@/lib/api/middleware";
import {
  generateBookmarkHtml,
  generateExportFilename,
  type ExportBookmark,
} from "@/lib/browser-bookmark/exporter";
import type { Platform } from "@/types/supabase";

/**
 * GET /api/v1/browser-bookmark/export
 * 导出书签为 Netscape Bookmark HTML 格式
 */
export const GET = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const platformsParam = searchParams.get("platform");
    const folderIdParam = searchParams.get("folderId");
    const includeFolders = searchParams.get("includeFolders") !== "false";
    const groupByPlatform = searchParams.get("groupByPlatform") === "true";

    const platforms = platformsParam
      ? (platformsParam.split(",").filter(Boolean) as Platform[])
      : null;

    // 构建查询
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
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (platforms && platforms.length > 0) {
      query = query.in("platform", platforms);
    }

    if (folderIdParam) {
      const folderId = parseInt(folderIdParam, 10);
      if (!isNaN(folderId)) {
        query = query.eq("folder_id", folderId);
      }
    }

    const { data: bookmarks, error: queryError } = await query;

    if (queryError) {
      logger.error(
        { error: queryError.message, userId },
        "[v1] Export query failed",
      );
      return NextResponse.json(
        {
          success: false,
          error: { code: "INTERNAL_ERROR", message: "查询书签失败" },
        },
        { status: 500 },
      );
    }

    if (!bookmarks || bookmarks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NO_DATA", message: "没有可导出的书签" },
        },
        { status: 400 },
      );
    }

    // 获取所有文件夹
    const { data: allFolders } = await supabase
      .from("folders")
      .select("id, name, parent_id")
      .eq("user_id", userId)
      .is("deleted_at", null);

    // 构建文件夹路径映射
    const folderPathMap = new Map<number, string[]>();
    if (allFolders) {
      const folderMap = new Map(allFolders.map((f) => [f.id, f]));

      function getFolderPath(folderId: number): string[] {
        if (folderPathMap.has(folderId)) {
          return folderPathMap.get(folderId)!;
        }

        const folder = folderMap.get(folderId);
        if (!folder) return [];

        const path = folder.parent_id
          ? [...getFolderPath(folder.parent_id), folder.name]
          : [folder.name];

        folderPathMap.set(folderId, path);
        return path;
      }

      for (const folder of allFolders) {
        getFolderPath(folder.id);
      }
    }

    // 转换为导出格式
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

    // 生成 HTML
    const html = generateBookmarkHtml(exportBookmarks, {
      includeFolders,
      groupByPlatform,
      rootFolderName: "AnyKeep 导出",
    });

    const filename = generateExportFilename(
      platforms && platforms.length === 1 ? platforms[0] : undefined,
    );

    logger.info(
      {
        userId,
        count: bookmarks.length,
        platforms: platforms?.join(",") || "all",
        includeFolders,
        groupByPlatform,
      },
      "[v1] Bookmarks exported",
    );

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
);
