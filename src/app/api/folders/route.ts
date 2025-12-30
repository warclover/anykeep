/**
 * 文件夹管理 API 路由
 * GET /api/folders - 获取文件夹列表
 * POST /api/folders - 创建新文件夹
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-auth";
import { createFolderSchema } from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { Folder } from "@/types/supabase";
import { FOLDER } from "@/lib/constants/messages";
import { FOLDER_LIST_FIELDS } from "@/lib/constants/query-fields";
import { initializeFolderNameProfile } from "@/lib/classification/server";
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
export async function GET(_request: NextRequest) {
  const monitor = new PerformanceMonitor("FoldersQuery");

  try {
    // 1. 验证用户身份（使用缓存认证，性能优化）
    const { user, error: authError } = await monitor.measure("CachedAuth", () =>
      getCachedUser(),
    );

    if (authError || !user) {
      return unauthorizedError();
    }

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await monitor.measure("CreateClient", () =>
      createClient(),
    );

    monitor.mark("AuthComplete", { userId: user.id });

    // 2. 查询用户的所有文件夹
    // V4.2更新：按 sort_order 升序排列（系统文件夹 sort_order=-1 会排在最前面）
    // V4.2.1: 使用统一字段常量，确保 API 一致性
    // V4.2.2: 包含 is_archived, folder_group, system_type 字段

    const queryStart = performance.now();
    const { data: folders, error: queryError } = await supabase
      .from("folders")
      .select(FOLDER_LIST_FIELDS)
      .eq("user_id", user.id)
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
        userId: user.id,
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
  } catch (error) {
    const perfReport = monitor.getReport();
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "get_folders",
        performance: {
          totalMs: Math.round(perfReport.totalDuration),
          failedAt: perfReport.entries[perfReport.entries.length - 1]?.name,
        },
      },
      "GET /api/folders error",
    );
    return internalError(FOLDER.LOAD_ERROR);
  }
}

/**
 * POST /api/folders
 * 创建新文件夹
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份（使用缓存认证，避免重复验证）
    const { user, error: authError } = await getCachedUser();

    if (authError || !user) {
      return unauthorizedError();
    }

    // 创建 Supabase 客户端用于数据库操作
    const supabase = await createClient();

    // 2. 解析并验证请求体
    const body = await request.json();
    const validation = createFolderSchema.safeParse(body);

    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { name, parentId } = validation.data;

    // 3. 创建文件夹
    // 注意：数据库 folders 表目前只有基础字段（name, parent_id 等）
    // color 和 icon 字段需要通过数据库迁移添加后才能使用
    const { data: folder, error: createError } = await supabase
      .from("folders")
      .insert({
        user_id: user.id,
        name,
        parent_id: parentId || null,
      })
      .select()
      .single();

    if (createError) {
      return databaseError(FOLDER.CREATE_ERROR, createError);
    }

    // 4. 异步初始化文件夹名称 Profile（不阻塞响应）
    initializeFolderNameProfile(folder.id, name, user.id).catch((err) => {
      logger.warn(
        { error: err, folderId: folder.id },
        "Failed to initialize folder name profile",
      );
    });

    return successResponse(folder);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: "create_folder",
      },
      "POST /api/folders error",
    );
    return internalError(FOLDER.CREATE_ERROR);
  }
}

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
