/**
 * 初始化数据聚合 API
 * GET /api/init - 一次请求获取所有首页初始数据
 *
 * @description 性能优化：减少首页 7+ 个并发请求到 1 个
 * @version 1.0.0
 *
 * 返回数据：
 * - bookmarks: 首页书签列表
 * - smartLists: 智能列表（含预设）
 * - unreadCount: 未读消息数量
 * - folders: 文件夹树
 *
 * 性能提升：
 * - 单次认证替代 7+ 次重复认证
 * - 服务端并行获取数据
 * - 减少网络往返延迟
 */

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuth, unauthorizedResponse } from "@/lib/api/auth-middleware";
import { successResponse, internalError } from "@/lib/utils/api-response";
import { logger } from "@/lib/logger";
import type { Folder, Platform } from "@/types/supabase";
import type { SmartList } from "@/types/smart-list";
import { toSmartListClient } from "@/types/smart-list";

// 默认分页大小
const DEFAULT_PAGE_SIZE = 20;

/**
 * 构建文件夹树
 */
function buildFolderTree(folders: Folder[]): Folder[] {
  const folderMap = new Map<number, Folder & { children?: Folder[] }>();
  const rootFolders: (Folder & { children?: Folder[] })[] = [];

  // 第一遍：创建映射
  folders.forEach((folder) => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });

  // 第二遍：建立父子关系
  folders.forEach((folder) => {
    const node = folderMap.get(folder.id)!;
    if (folder.parent_id !== null && folderMap.has(folder.parent_id)) {
      const parent = folderMap.get(folder.parent_id)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      rootFolders.push(node);
    }
  });

  return rootFolders;
}

/**
 * 获取书签列表
 */
async function getBookmarks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  options: {
    platform?: string;
    sort?: string;
    folder?: string;
    limit?: number;
  } = {},
) {
  const {
    platform = "",
    sort = "created_desc",
    folder = "",
    limit = DEFAULT_PAGE_SIZE,
  } = options;

  let query = supabase
    .from("bookmarks")
    .select("*, folders(name)")
    .eq("user_id", userId)
    .is("deleted_at", null);

  // 虚拟文件夹筛选
  if (folder === "trash") {
    query = query.eq("is_in_trash", true);
  } else if (folder === "invalid") {
    query = query.eq("is_invalid", true).eq("is_in_trash", false);
  } else if (folder === "high-value") {
    query = query.eq("rating", 5).eq("is_in_trash", false);
  } else {
    query = query.eq("is_in_trash", false);
  }

  // 平台筛选
  if (platform === "browser") {
    query = query.in("platform", [
      "BROWSER_CHROME",
      "BROWSER_EDGE",
      "BROWSER_FIREFOX",
      "BROWSER_SAFARI",
    ]);
  } else if (platform) {
    query = query.eq("platform", platform as Platform);
  } else {
    // "全部"时排除浏览器平台
    query = query.not(
      "platform",
      "in",
      '("BROWSER_CHROME","BROWSER_EDGE","BROWSER_FIREFOX","BROWSER_SAFARI")',
    );
  }

  // 排序
  const sortField = sort?.split("_")[0] || "created";
  const ascending = sort?.endsWith("_asc") || false;

  if (sortField === "created") {
    query = query.order("created_at", { ascending });
  } else if (sortField === "title") {
    query = query.order("title", { ascending, nullsFirst: false });
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * 获取智能列表
 */
async function getSmartLists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: smartLists, error } = await supabase
    .from("smart_lists")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("is_pinned", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  // 简化处理：不计算每个列表的书签数量，由前端按需获取
  // 这大幅减少初始化时间
  return (smartLists as SmartList[]).map((list) => ({
    ...toSmartListClient(list),
    bookmarkCount: 0, // 延迟计算
  }));
}

/**
 * 获取未读消息数量
 */
async function getUnreadCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data, error } = await supabase.rpc("get_unread_message_counts", {
    p_user_id: userId,
  });

  if (error) {
    // 非关键数据，返回默认值
    logger.warn({ error: error.message }, "[Init] Failed to get unread count");
    return { total: 0, silent: 0, normal: 0, important: 0 };
  }

  return Array.isArray(data) && data.length > 0
    ? data[0]
    : { total: 0, silent: 0, normal: 0, important: 0 };
}

/**
 * 获取文件夹列表
 */
async function getFolders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const listFields = `
    id,
    name,
    parent_id,
    is_system,
    is_archived,
    folder_group,
    sort_order,
    created_at,
    updated_at
  `.replace(/\s+/g, "");

  const { data: folders, error } = await supabase
    .from("folders")
    .select(listFields)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return buildFolderTree((folders as unknown as Folder[]) || []);
}

/**
 * GET /api/init
 * 聚合获取首页所有初始数据
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();

  try {
    // 1. 统一认证（只认证一次！）
    const {
      userId,
      error: authError,
      method,
      duration: authDuration,
    } = await withAuth(request);

    if (authError || !userId) {
      return unauthorizedResponse();
    }

    logger.info(
      {
        authMethod: method,
        authDuration: Math.round(authDuration),
      },
      "[Init] Auth completed",
    );

    // 2. 创建 Supabase 客户端
    const supabase = await createClient();

    // 3. 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform") || "";
    const sort = searchParams.get("sort") || "created_desc";
    const folder = searchParams.get("folder") || "";

    // 4. 并行获取所有数据
    const dataStart = performance.now();

    const [bookmarks, smartLists, unreadCount, folders] = await Promise.all([
      getBookmarks(supabase, userId, { platform, sort, folder }).catch(
        (err) => {
          console.error("[Init] Failed to get bookmarks:", err);
          return [];
        },
      ),
      getSmartLists(supabase, userId).catch((err) => {
        console.error("[Init] Failed to get smart lists:", err);
        return [];
      }),
      getUnreadCount(supabase, userId).catch((err) => {
        console.error("[Init] Failed to get unread count:", err);
        return { total: 0, silent: 0, normal: 0, important: 0 };
      }),
      getFolders(supabase, userId).catch((err) => {
        console.error("[Init] Failed to get folders:", err);
        return [];
      }),
    ]);

    const dataDuration = performance.now() - dataStart;
    const totalDuration = performance.now() - startTime;

    // 5. 记录性能日志
    logger.info(
      {
        userId,
        authMethod: method,
        authDuration: Math.round(authDuration),
        dataDuration: Math.round(dataDuration),
        totalDuration: Math.round(totalDuration),
        bookmarkCount: bookmarks.length,
        smartListCount: smartLists.length,
        folderCount: folders.length,
      },
      "[Init] Data aggregation completed",
    );

    // 6. 返回聚合数据
    return successResponse({
      bookmarks,
      smartLists,
      unreadCount,
      folders,
      _meta: {
        authMethod: method,
        authDuration: Math.round(authDuration),
        dataDuration: Math.round(dataDuration),
        totalDuration: Math.round(totalDuration),
      },
    });
  } catch (error) {
    const totalDuration = performance.now() - startTime;

    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: Math.round(totalDuration),
      },
      "[Init] Aggregation failed",
    );

    return internalError("获取初始数据失败");
  }
}
