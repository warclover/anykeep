/**
 * 用户数据导出 API
 * POST /api/user/export - 导出用户数据
 *
 * @description
 * 导出用户的所有数据，包括：
 * - 书签（含 AI 标签、摘要）
 * - 文件夹结构
 * - 用户设置
 * - 浏览器书签导入记录
 *
 * @version 1.0.0
 * @since 2025-12-16
 */

import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import { unauthorizedError, internalError } from "@/lib/utils/api-response";
import { checkRateLimit } from "@/lib/utils/rate-limiter";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

/** 导出数据格式 */
interface ExportData {
  exportedAt: string;
  version: string;
  user: {
    id: string;
    email: string;
  };
  statistics: {
    bookmarkCount: number;
    folderCount: number;
    browserBookmarkCount: number;
  };
  folders: ExportFolder[];
  bookmarks: ExportBookmark[];
  browserBookmarks: ExportBrowserBookmark[];
  settings: Record<string, unknown>;
}

interface ExportFolder {
  id: number;
  name: string;
  parentId: number | null;
  isSystem: boolean;
  createdAt: string | null;
}

interface ExportBookmark {
  id: number;
  title: string;
  url: string;
  description: string | null;
  platform: string | null;
  folderId: number | null;
  folderName: string | null;
  aiTags: string[] | null;
  aiSummary: string | null;
  userTags: string[] | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ExportBrowserBookmark {
  id: number;
  title: string;
  url: string;
  folderId: number | null;
  folderPath: string | null;
  source: string;
  createdAt: string | null;
}

/**
 * POST /api/user/export
 * 导出用户所有数据
 */
export async function POST() {
  try {
    // 1. 验证用户身份
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 1.5 速率限制检查（高风险操作：每小时 2 次）
    const rateLimitResult = checkRateLimit(user.id, "/api/user/export");
    if (!rateLimitResult.allowed) {
      logger.warn(
        { userId: user.id, resetMs: rateLimitResult.resetMs },
        "Data export rate limited",
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "操作过于频繁，请稍后再试",
          retryAfter: Math.ceil(rateLimitResult.resetMs / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
          },
        },
      );
    }

    const supabase = await createClient();

    // 2. 获取用户文件夹
    const { data: folders, error: foldersError } = await supabase
      .from("folders")
      .select("id, name, parent_id, is_system, created_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (foldersError) {
      logger.error(
        { error: foldersError.message, userId: user.id },
        "Export: Failed to get folders",
      );
      return internalError("获取文件夹失败");
    }

    // 3. 获取用户书签（含文件夹名称）
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from("bookmarks")
      .select(
        `
        id, title, url, description, platform, folder_id,
        ai_tags, ai_summary, user_tags, created_at, updated_at,
        folders (name)
      `,
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (bookmarksError) {
      logger.error(
        { error: bookmarksError.message, userId: user.id },
        "Export: Failed to get bookmarks",
      );
      return internalError("获取书签失败");
    }

    // 4. 获取浏览器书签
    interface BrowserBookmarkRow {
      id: number;
      title: string;
      url: string;
      folder_id: number | null;
      source: string;
      created_at: string;
      browser_bookmark_folders: { name: string } | null;
    }

    let browserBookmarks: BrowserBookmarkRow[] = [];
    try {
      // browser_bookmarks 表可能不在当前类型定义中
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: browserBookmarksError } = await (supabase as any)
        .from("browser_bookmarks")
        .select(
          `
          id, title, url, folder_id, source, created_at,
          browser_bookmark_folders (name)
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (browserBookmarksError) {
        logger.warn(
          { error: browserBookmarksError.message, userId: user.id },
          "Export: Failed to get browser bookmarks",
        );
      } else if (data) {
        browserBookmarks = data as unknown as BrowserBookmarkRow[];
      }
    } catch (browserError) {
      logger.warn(
        {
          error:
            browserError instanceof Error
              ? browserError.message
              : String(browserError),
        },
        "Export: Exception getting browser bookmarks",
      );
      // 浏览器书签失败不阻塞导出
    }

    // 5. 获取用户设置
    const { data: profile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single();

    // 6. 构建文件夹路径映射
    const folderMap = new Map<number, string>();
    const buildFolderPath = (folderId: number | null): string | null => {
      if (!folderId) return null;
      const cached = folderMap.get(folderId);
      if (cached) return cached;

      const folder = folders?.find((f) => f.id === folderId);
      if (!folder) return null;

      const parentPath = folder.parent_id
        ? buildFolderPath(folder.parent_id)
        : null;
      const path = parentPath ? `${parentPath}/${folder.name}` : folder.name;
      folderMap.set(folderId, path);
      return path;
    };

    // 7. 格式化导出数据
    const exportData: ExportData = {
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
      user: {
        id: user.id,
        email: user.email || "",
      },
      statistics: {
        bookmarkCount: bookmarks?.length || 0,
        folderCount: folders?.length || 0,
        browserBookmarkCount: browserBookmarks.length,
      },
      folders: (folders || []).map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parent_id,
        isSystem: f.is_system ?? false,
        createdAt: f.created_at,
      })),
      bookmarks: (bookmarks || []).map((b) => ({
        id: b.id,
        title: b.title,
        url: b.url,
        description: b.description,
        platform: b.platform,
        folderId: b.folder_id,
        folderName:
          Array.isArray(b.folders) && b.folders[0]
            ? (b.folders[0] as { name: string }).name
            : null,
        aiTags: b.ai_tags as string[] | null,
        aiSummary: b.ai_summary,
        userTags: b.user_tags as string[] | null,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
      })),
      browserBookmarks: browserBookmarks.map((b) => ({
        id: b.id,
        title: b.title,
        url: b.url,
        folderId: b.folder_id,
        folderPath: buildFolderPath(b.folder_id),
        source: b.source,
        createdAt: b.created_at,
      })),
      settings: (profile?.settings as Record<string, unknown>) || {},
    };

    // 8. 生成文件名
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `anykeep-export-${timestamp}.json`;

    logger.info(
      {
        userId: user.id,
        bookmarkCount: exportData.statistics.bookmarkCount,
        folderCount: exportData.statistics.folderCount,
      },
      "User data exported",
    );

    // 9. 返回 JSON 文件
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, "POST /api/user/export error");
    return internalError("导出数据失败");
  }
}
