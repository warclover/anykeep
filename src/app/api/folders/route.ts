/**
 * 文件夹管理 API 路由
 * GET /api/folders - 获取文件夹列表
 * POST /api/folders - 创建新文件夹
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createFolderSchema } from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  databaseError,
  conflictError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { Folder } from "@/types/supabase";
import { FOLDER } from "@/lib/constants/messages";
import { FOLDER_LIST_FIELDS } from "@/lib/constants/query-fields";
import { initializeFolderNameProfile } from "@/lib/folder-profile/manager";
import { PerformanceMonitor } from "@/lib/utils/performance-monitor";

/**
 * V4.2.1: HTTP 缓存配置
 * 文件夹结构变化不频繁，可使用较长的缓存时间
 * - private: 仅客户端缓存
 * - max-age=300: 5 分钟内使用缓存
 * - stale-while-revalidate=60: 缓存过期后 1 分钟内仍可使用旧数据
 */
const CACHE_CONTROL_HEADER = "private, max-age=300, stale-while-revalidate=60";

/**
 * GET /api/folders
 * 获取当前用户的所有文件夹（树形结构）
 */
export const GET = withAuthMiddleware(
  async (_request: NextRequest, { userId }) => {
    const monitor = new PerformanceMonitor("FoldersQuery");

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await monitor.measure("CreateClient", () =>
      createClient(),
    );

    monitor.mark("AuthComplete", { userId });

    // 2. 查询用户的所有文件夹
    // V4.2更新：按 sort_order 升序排列（系统文件夹 sort_order=-1 会排在最前面）
    // V4.2.1: 使用统一字段常量，确保 API 一致性
    // V4.2.2: 包含 is_archived, folder_group, system_type 字段

    const queryStart = performance.now();
    const { data: folders, error: queryError } = await supabase
      .from("folders")
      .select(FOLDER_LIST_FIELDS)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    monitor.mark("DatabaseQuery", {
      durationMs: Math.round(performance.now() - queryStart),
    });

    if (queryError) {
      return databaseError(FOLDER.LOAD_ERROR, queryError);
    }

    // 3. 构建树形结构
    // V4.2.1: 双重类型断言处理动态字段选择的类型推断问题
    const treeStart = performance.now();
    const folderTree = buildFolderTree((folders as unknown as Folder[]) || []);
    monitor.mark("BuildTree", {
      folderCount: folders?.length || 0,
      durationMs: Math.round(performance.now() - treeStart),
    });

    // 输出性能报告
    const perfReport = monitor.getReport();
    logger.info(
      {
        userId,
        folderCount: folders?.length || 0,
        performance: {
          totalMs: Math.round(perfReport.totalDuration),
          stages: perfReport.entries.map((e) => ({
            name: e.name,
            ms: Math.round(e.duration),
          })),
        },
      },
      "Folders query completed",
    );

    // V4.2.1: 返回带缓存头的响应
    const responseData = {
      success: true,
      data: folderTree,
      // 开发环境返回性能数据
      ...(process.env.NODE_ENV === "development" && {
        _performance: monitor.toJSON(),
      }),
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        "Cache-Control": CACHE_CONTROL_HEADER,
      },
    });
  },
);

/**
 * POST /api/folders
 * 创建新文件夹
 */
export const POST = withAuthMiddleware(
  async (request: NextRequest, { userId }) => {
    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = createFolderSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { name, parentId, categoryId, color, icon } = validation.data;

    // 3. 检查同名文件夹（同一用户 + 同一父目录下不允许重名）
    let duplicateQuery = supabase
      .from("folders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("name", name)
      .is("deleted_at", null);

    if (parentId) {
      duplicateQuery = duplicateQuery.eq("parent_id", parentId);
    } else {
      duplicateQuery = duplicateQuery.is("parent_id", null);
    }

    const { count: duplicateCount } = await duplicateQuery;

    if (duplicateCount && duplicateCount > 0) {
      return conflictError(FOLDER.NAME_DUPLICATE(name));
    }

    // 4. 创建文件夹
    type CreatedFolderType = {
      id: number;
      user_id: string;
      name: string;
      parent_id: number | null;
      category_id: number | null;
      color: string | null;
      icon: string | null;
    };

    const { data: folder, error: createError } = (await supabase
      .from("folders")
      .insert({
        user_id: userId,
        name,
        parent_id: parentId || null,
        category_id: categoryId || null,
        color: color || null,
        icon: icon || null,
      })
      .select()
      .single()) as {
      data: CreatedFolderType | null;
      error: { message: string } | null;
    };

    if (createError) {
      return databaseError(FOLDER.CREATE_ERROR, createError);
    }

    if (!folder) {
      return databaseError(FOLDER.CREATE_ERROR);
    }

    // 4. 异步初始化文件夹名称 Profile（不阻塞响应）
    initializeFolderNameProfile(folder.id, name, userId).catch((err) => {
      logger.warn(
        { error: err, folderId: folder.id },
        "Failed to initialize folder name profile",
      );
    });

    return successResponse(folder);
  },
);

/**
 * 文件夹树节点类型（包含子文件夹）
 */
interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
}

/**
 * 构建文件夹树形结构
 */
function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const folderMap = new Map<number, FolderTreeNode>();
  const rootFolders: FolderTreeNode[] = [];

  // 第一遍遍历：创建映射并初始化 children
  folders.forEach((folder) => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });

  // 第二遍遍历：构建树形关系
  folders.forEach((folder) => {
    const folderNode = folderMap.get(folder.id);
    if (!folderNode) return;

    if (folder.parent_id === null) {
      // 根文件夹
      rootFolders.push(folderNode);
    } else {
      // 子文件夹，添加到父文件夹的 children
      const parent = folderMap.get(folder.parent_id);
      if (parent) {
        parent.children.push(folderNode);
      } else {
        // 如果父文件夹不存在（可能被删除），视为根文件夹
        rootFolders.push(folderNode);
      }
    }
  });

  return rootFolders;
}
