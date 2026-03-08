/**
 * 收藏 API 路由
 * POST /api/bookmarks - 创建收藏
 * GET /api/bookmarks - 获取收藏列表
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { detectPlatformFromUrl } from "@/lib/constants/platforms";
import {
  createBookmarkSchema,
  getBookmarksQuerySchema,
} from "@/lib/validation";
import {
  successResponse,
  handleValidationError,
  quotaExceededError,
  databaseError,
  internalError,
} from "@/lib/utils/api-response";
import { crawlContent } from "@/lib/utils/crawler";
import { logger } from "@/lib/logger";
import type { BookmarkInsert } from "@/types/supabase";
import {
  fetchAndUpdateTitle,
  generateBookmarkAIContent,
} from "@/lib/bookmarks/bookmark-async-tasks";
import { BOOKMARK, STORAGE } from "@/lib/constants/messages";
import { BOOKMARK_LIST_FIELDS } from "@/lib/constants/query-fields";
import { PerformanceMonitor } from "@/lib/utils/performance-monitor";
import { bookmarkAITasks } from "@/lib/utils/async-task-retry";
// Phase 4 升级：微信文章自动抓取
import { autoFetchWechatArticle } from "@/lib/wechat-article";
// Phase 5 升级：B站视频字幕自动提取
import { autoFetchBilibiliTranscript } from "@/lib/bilibili-transcript";

/**
 * V4.2.3: HTTP 缓存配置（优化）
 * 书签数据更新频繁，使用更短的缓存时间以确保数据一致性
 * - private: 仅客户端缓存
 * - max-age=5: 5 秒内使用缓存（从 30 秒缩短，解决删除后仍显示的问题）
 * - stale-while-revalidate=10: 缓存过期后 10 秒内可后台刷新
 */
const CACHE_CONTROL_HEADER = "private, max-age=5, stale-while-revalidate=10";

/**
 * V4.2.7: 数据版本缓存配置
 * 用于让客户端判断是否需要重新获取数据
 */
const DATA_VERSION_HEADER = "X-Data-Version";

/**
 * V4.2.7: 生成数据版本号
 * 基于返回数据的最新 updated_at 时间戳
 */
function generateDataVersion(
  bookmarks: Array<{ updated_at?: string | null }> | null,
): string {
  if (!bookmarks || bookmarks.length === 0) {
    return Date.now().toString();
  }

  // 找到最新的 updated_at 时间戳
  let latestTimestamp = 0;
  for (const bookmark of bookmarks) {
    if (bookmark.updated_at) {
      const ts = new Date(bookmark.updated_at).getTime();
      if (ts > latestTimestamp) {
        latestTimestamp = ts;
      }
    }
  }

  return latestTimestamp > 0
    ? latestTimestamp.toString()
    : Date.now().toString();
}

/**
 * POST /api/bookmarks
 * 创建新收藏
 */
export const POST = withAuthMiddleware(async (request, { userId }) => {
  // 创建 Supabase 客户端用于数据库操作
  const supabase = await createClient();

  // 2. 解析并验证请求体
  const body = await request.json();
  const validation = createBookmarkSchema.safeParse(body);

  if (!validation.success) {
    logger.warn(
      {
        action: "create_bookmark_validation_failed",
        issues: validation.error.issues,
        path: validation.error.issues.map((i) => i.path.join(".")),
      },
      "POST /api/bookmarks: validation failed",
    );
    return handleValidationError(validation.error);
  }

  const {
    url,
    title,
    description,
    folderId,
    userTags,
    notes,
    coverUrl: userCoverUrl,
    sourceName: userSourceName, // 前端传来的来源名称
    author: userAuthor, // 前端传来的作者
    wordCount: userWordCount,
    imageCount: userImageCount,
    publishTime: userPublishTime, // 前端传来的发布时间
    // 注意：aiSummary/aiTags 已弃用（AI 改为完全异步生成）
  } = validation.data;

  // 3. 检查存储配额
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("storage_quota, storage_used")
    .eq("id", userId)
    .single();

  if (profileError) {
    return databaseError(BOOKMARK.LOAD_ERROR, profileError);
  }

  if (!profile) {
    return databaseError(BOOKMARK.LOAD_ERROR, { message: "用户信息不存在" });
  }

  if ((profile.storage_used ?? 0) >= (profile.storage_quota ?? 0)) {
    return quotaExceededError(STORAGE.QUOTA_EXCEEDED);
  }

  // 4. 识别平台类型
  const platform = detectPlatformFromUrl(url);

  // 5. 处理标题和描述
  // 优先使用前端传来的数据（来自 metadata API）
  let sourceName: string | undefined = userSourceName || undefined;
  let author: string | undefined = userAuthor || undefined;
  let coverUrl: string | undefined;
  let wordCount: number | undefined = userWordCount;
  let imageCount: number | undefined = userImageCount;
  let publishTime: string | undefined = userPublishTime || undefined;

  // 判断是否需要异步补充标题
  const needsAsyncTitleFetch = !title || title.trim() === "";
  // 使用临时占位符或用户提供的标题
  const finalTitle = needsAsyncTitleFetch
    ? "正在获取标题..."
    : (title as string);
  let finalDescription: string | null | undefined = description;

  // 仅当有描述需求且用户没有提供时，才同步爬取（快速返回）
  // 如果标题为空，完全异步处理（不阻塞创建响应）
  if (title && !description) {
    try {
      logger.info(
        {
          url,
          action: "crawl_start",
        },
        "Crawler: Auto-crawling for description only",
      );
      const crawlResult = await crawlContent(url);

      // 使用爬取的数据填充缺失字段（优先使用前端提供的值）
      finalDescription = description || crawlResult.description || null;
      sourceName = sourceName || crawlResult.sourceName;
      author = author || crawlResult.author;
      coverUrl = crawlResult.coverUrl;
      wordCount = wordCount ?? crawlResult.wordCount;
      imageCount = imageCount ?? crawlResult.imageCount;
      publishTime = publishTime || crawlResult.publishTime;

      logger.info(
        {
          title: finalTitle,
          platform: crawlResult.platform,
          hasSourceName: !!sourceName,
          hasAuthor: !!author,
          hasCover: !!coverUrl,
          wordCount,
          imageCount,
          action: "crawl_success",
        },
        "Crawler: Success (description only)",
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          url,
          action: "crawl_failed",
        },
        "Crawler: Failed (description only)",
      );
      finalDescription = description || null;
    }
  }

  // 6. 获取用户文件夹（用于 AI 标签参考和后续文件夹推荐）
  const { data: userFolders } = await supabase
    .from("folders")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_system", false)
    .is("deleted_at", null);

  const folderNames = userFolders?.map((f) => f.name) || [];

  // 7. AI 内容生成改为完全异步（不阻塞创建响应）
  // 用户可以手动添加标签，AI 标签和摘要将在后台生成
  logger.info(
    {
      title: finalTitle,
      folderCount: folderNames.length,
      action: "ai_deferred",
    },
    "AI: Content generation will be processed asynchronously",
  );

  // 8. 获取文件夹（用户指定或默认待整理）
  // 注意：AI 文件夹推荐改为异步执行，不阻塞创建响应
  let finalFolderId = folderId;

  if (!finalFolderId) {
    // 用户未指定文件夹，使用待整理文件夹
    try {
      const { data: inboxFolderId, error: inboxError } = await supabase.rpc(
        "get_or_create_inbox_folder",
        { p_user_id: userId },
      );

      if (!inboxError && inboxFolderId) {
        finalFolderId = inboxFolderId;
        logger.info(
          {
            folderId: inboxFolderId,
            action: "inbox_assigned",
          },
          "Bookmark assigned to inbox folder (AI recommendation will run async)",
        );
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          userId,
          operation: "get_inbox_folder",
        },
        "Exception while getting inbox folder",
      );
    }
  }

  // 9. 构建收藏记录
  // 封面优先级：用户上传 > 爬取获取
  const finalCoverUrl = userCoverUrl || coverUrl || null;

  const bookmarkData: BookmarkInsert = {
    user_id: userId,
    url,
    title: finalTitle,
    description: finalDescription,
    source_name: sourceName || null, // 来源名称（公众号名称等）
    author: author || null, // 文章作者
    publish_time: publishTime || null, // 原文发布时间
    cover_url: finalCoverUrl,
    platform,
    folder_id: finalFolderId || null,
    user_tags: userTags || null,
    notes: notes || null,
    ai_summary: null, // AI 内容将异步生成
    ai_tags: null, // AI 标签将异步生成
    word_count: wordCount || null,
    image_count: imageCount || null,
    status: "PROCESSING", // 标记为处理中（AI 内容异步生成中）
    is_in_trash: false,
  };

  // 10. 插入收藏记录
  // 自定义返回类型以支持 folders 关联
  type BookmarkWithFolder = {
    id: number;
    folders: { name: string } | null;
    [key: string]: unknown;
  };

  const { data: bookmark, error: insertError } = await supabase
    .from("bookmarks")
    .insert(bookmarkData)
    .select("*, folders!bookmarks_folder_id_fkey(name)")
    .single<BookmarkWithFolder>();

  if (insertError) {
    return databaseError(BOOKMARK.CREATE_ERROR, insertError);
  }

  if (!bookmark) {
    return databaseError(BOOKMARK.CREATE_ERROR, { message: "创建书签失败" });
  }

  // 11. 增加用户存储计数
  const { error: incrementError } = await supabase.rpc(
    "increment_storage_used",
    {
      target_user_id: userId,
    },
  );

  if (incrementError) {
    // 存储计数更新失败，但收藏已创建，记录错误但不影响返回
    logger.error(
      {
        error: incrementError,
        userId,
        operation: "increment_storage",
      },
      "Failed to increment storage count",
    );
  }

  // 12. 异步后台任务（不阻塞响应）
  // V4.2.7: 使用重试机制，失败时入队到 job_queue
  // 如果需要异步获取标题，先获取标题再生成 AI 内容
  if (needsAsyncTitleFetch) {
    // 异步获取标题，然后生成 AI 内容
    fetchAndUpdateTitle(bookmark.id, url, userId)
      .then(({ title: fetchedTitle, description: fetchedDesc }) => {
        // 标题获取成功后，继续生成 AI 内容（使用重试机制）
        bookmarkAITasks.generateContent(
          () =>
            generateBookmarkAIContent(
              bookmark.id,
              url,
              fetchedTitle,
              fetchedDesc,
              folderNames,
              userId,
              !!folderId,
            ),
          userId,
          bookmark.id,
          url,
        );
      })
      .catch((err) => {
        logger.error(
          { error: err, bookmarkId: bookmark.id },
          "Background title fetch failed",
        );
        // 标题获取失败，仍然尝试生成 AI 内容（使用 URL 作为标题）
        bookmarkAITasks.generateContent(
          () =>
            generateBookmarkAIContent(
              bookmark.id,
              url,
              url, // 使用 URL 作为标题
              null,
              folderNames,
              userId,
              !!folderId,
            ),
          userId,
          bookmark.id,
          url,
        );
      });
  } else {
    // 已有标题，直接生成 AI 内容（使用重试机制）
    bookmarkAITasks.generateContent(
      () =>
        generateBookmarkAIContent(
          bookmark.id,
          url,
          finalTitle,
          finalDescription ?? null,
          folderNames,
          userId,
          !!folderId,
        ),
      userId,
      bookmark.id,
      url,
    );
  }

  // 13. Phase 4 升级：微信文章自动抓取（异步，不阻塞响应）
  if (platform === "WECHAT_OFFICIAL_ACCOUNT") {
    autoFetchWechatArticle(bookmark.id, userId, url).catch((err) => {
      logger.warn(
        { error: err, bookmarkId: bookmark.id },
        "WeChat auto-crawl failed (non-blocking)",
      );
    });
  }

  // 14. Phase 5 升级：B站视频字幕自动提取（异步，不阻塞响应）
  if (platform === "BILIBILI") {
    autoFetchBilibiliTranscript(bookmark.id, userId, url).catch((err) => {
      logger.warn(
        { error: err, bookmarkId: bookmark.id },
        "Bilibili transcript auto-fetch failed (non-blocking)",
      );
    });
  }

  // 15. 返回创建的收藏对象
  // 注意：分类信息现在是异步处理，前端可通过轮询或 WebSocket 获取更新
  return successResponse(bookmark, 201);
});

/**
 * GET /api/bookmarks
 * 获取收藏列表（支持分页和筛选）
 */
export const GET = withAuthMiddleware(async (request, { userId }) => {
  const monitor = new PerformanceMonitor("BookmarksQuery");

  // 创建 Supabase 客户端用于数据库操作
  const supabase = await monitor.measure("CreateClient", () => createClient());

  monitor.mark("AuthComplete", { userId });

  // 2. 解析查询参数
  const searchParams = request.nextUrl.searchParams;
  const queryParams = {
    platform: searchParams.get("platform"),
    excludeBrowser: searchParams.get("excludeBrowser"),
    folderId: searchParams.get("folderId"),
    folderIds: searchParams.get("folderIds"), // V2.0: 批量文件夹查询
    folder: searchParams.get("folder"), // 虚拟文件夹
    keyword: searchParams.get("keyword"),
    cursor: searchParams.get("cursor"),
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"), // V2.1: 分页偏移量
    sort: searchParams.get("sort"),
    usageTags: searchParams.get("usageTags"), // V9.0新增：用途标签筛选
    dateFrom: searchParams.get("dateFrom"), // V10.0新增：时间范围起始
    dateTo: searchParams.get("dateTo"), // V10.0新增：时间范围结束
    isRead: searchParams.get("isRead"), // V10.0新增：阅读状态筛选
    isStarred: searchParams.get("isStarred"), // V10.0新增：星标筛选
    isHighValue: searchParams.get("isHighValue"), // V10.0新增：高价值筛选
    ratingMin: searchParams.get("ratingMin"), // V10.0新增：评级下限
    ratingMax: searchParams.get("ratingMax"), // V10.0新增：评级上限
  };

  const validation = getBookmarksQuerySchema.safeParse(queryParams);

  if (!validation.success) {
    return handleValidationError(validation.error);
  }

  const {
    platform,
    excludeBrowser,
    folderId,
    folderIds,
    folder,
    keyword,
    cursor,
    limit,
    offset,
    sort,
    usageTags,
    dateFrom,
    dateTo,
    isRead,
    isStarred,
    isHighValue,
    ratingMin,
    ratingMax,
  } = validation.data;

  monitor.mark("ParamsParsed", {
    platform,
    excludeBrowser,
    folderId,
    folderIds: folderIds?.length,
    folder,
    keyword: !!keyword,
    cursor: !!cursor,
    limit,
    dateFrom: !!dateFrom,
    dateTo: !!dateTo,
  });

  // 3. 构建查询
  // V4.2.1: 使用统一字段常量，确保 API 一致性
  // V4.2.8: 排除 embedding 大字段，保留所有 UI 所需字段
  let query = supabase
    .from("bookmarks")
    .select(BOOKMARK_LIST_FIELDS, { count: "exact" })
    .eq("user_id", userId)
    .is("deleted_at", null);

  // 虚拟文件夹筛选（优先级最高）
  // 注意：is_in_trash 可能为 NULL（历史数据），使用 .or() 处理
  if (folder === "trash") {
    // 垃圾箱：只显示垃圾箱中的收藏
    query = query.eq("is_in_trash", true);
  } else if (folder === "invalid") {
    // 已失效：只显示失效且不在垃圾箱的收藏
    query = query
      .eq("is_invalid", true)
      .or("is_in_trash.eq.false,is_in_trash.is.null");
  } else if (folder === "high-value") {
    // 高价值：只显示5星评级且不在垃圾箱的收藏
    query = query
      .eq("rating", 5)
      .or("is_in_trash.eq.false,is_in_trash.is.null");
  } else {
    // 正常收藏：排除垃圾箱（包含 NULL 值）
    query = query.or("is_in_trash.eq.false,is_in_trash.is.null");
  }

  // 平台筛选
  if (platform === "browser") {
    // 「浏览器书签」统一入口：查询所有浏览器平台
    query = query.in("platform", [
      "BROWSER_CHROME",
      "BROWSER_EDGE",
      "BROWSER_FIREFOX",
      "BROWSER_SAFARI",
    ]);
  } else if (platform) {
    query = query.eq("platform", platform);
  } else if (excludeBrowser) {
    // 「全部」时排除浏览器平台
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
    query = query.order("title", { ascending });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  // 文件夹筛选（仅对非虚拟文件夹生效）
  // V2.0: 优先使用 folderIds 批量查询，否则使用 folderId 单查询
  if (!folder) {
    if (folderIds && folderIds.length > 0) {
      // 批量文件夹查询（用于分组选择）
      query = query.in("folder_id", folderIds);
    } else if (folderId) {
      // 单文件夹查询
      query = query.eq("folder_id", folderId);
    }
  }

  // 关键词搜索（标题 + 描述）
  if (keyword) {
    query = query.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`);
  }

  // V9.0新增：用途标签筛选（user_tags 数组包含任意指定标签）
  if (usageTags && usageTags.length > 0) {
    query = query.overlaps("user_tags", usageTags);
  }

  // V10.0新增：时间范围筛选（用于智能列表）
  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }
  if (dateTo) {
    query = query.lte("created_at", dateTo);
  }

  // V10.0新增：阅读状态筛选（用于智能列表的"待阅读"场景）
  if (isRead !== undefined) {
    query = query.eq("is_read", isRead);
  }

  // V10.0新增：星标筛选（用于智能列表的"星标收藏"场景）
  if (isStarred !== undefined) {
    query = query.eq("is_starred", isStarred);
  }

  // V10.0新增：高价值筛选（rating=5）
  if (isHighValue === true) {
    query = query.eq("rating", 5);
  }

  // V10.0新增：评级范围筛选
  if (ratingMin !== undefined) {
    query = query.gte("rating", ratingMin);
  }
  if (ratingMax !== undefined) {
    query = query.lte("rating", ratingMax);
  }

  // 游标分页（"加载更多"模式）
  if (cursor) {
    query = query.lt("id", cursor);
  }

  // V2.1: 使用 range 支持 offset 分页
  // 注意：range(from, to) 两端都是包含的（inclusive）
  if (offset > 0) {
    query = query.range(offset, offset + limit - 1);
  } else {
    query = query.limit(limit);
  }

  monitor.mark("QueryBuilt");

  // 4. 执行查询
  const queryStart = performance.now();
  const { data: bookmarks, error: queryError, count } = await query;
  monitor.mark("DatabaseQuery", {
    durationMs: Math.round(performance.now() - queryStart),
  });

  // V4.2.24: 安全的错误处理（避免序列化失败）
  if (queryError) {
    try {
      logger.error(
        {
          errorMessage: queryError.message,
          errorCode: queryError.code,
          errorDetails: queryError.details,
          errorHint: queryError.hint,
        },
        "Database query error detected",
      );
      return databaseError(BOOKMARK.LOAD_ERROR, queryError);
    } catch (serializationError) {
      logger.error(
        {
          error:
            serializationError instanceof Error
              ? serializationError.message
              : String(serializationError),
        },
        "Failed to handle database error",
      );
      return internalError(BOOKMARK.LOAD_ERROR);
    }
  }

  // 5. 返回结果（包含分页元数据）
  // V4.2.24: 安全的数据验证（避免类型断言失败）
  let bookmarkList: Array<{ id: number; [key: string]: unknown }> | null = null;
  let hasMore = false;
  let nextCursor: number | null = null;

  try {
    // 验证数据结构
    if (Array.isArray(bookmarks)) {
      bookmarkList = bookmarks as unknown as Array<{
        id: number;
        [key: string]: unknown;
      }>;
      hasMore = bookmarkList.length === limit;

      // 安全获取最后一条记录的 id
      if (hasMore && bookmarkList.length > 0) {
        const lastItem = bookmarkList[bookmarkList.length - 1];
        if (lastItem && typeof lastItem.id === "number") {
          nextCursor = lastItem.id;
        } else {
          logger.warn(
            { lastItem },
            "Last bookmark item missing valid id field",
          );
        }
      }
    } else if (bookmarks !== null) {
      logger.warn(
        { bookmarksType: typeof bookmarks },
        "Unexpected bookmarks data type",
      );
    }
  } catch (validationError) {
    logger.error(
      {
        error:
          validationError instanceof Error
            ? validationError.message
            : String(validationError),
      },
      "Failed to process pagination metadata",
    );
    // 继续执行，但分页信息为空
  }

  // 输出性能报告（添加安全保护）
  let perfReport;
  try {
    perfReport = monitor.getReport();
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to get performance report",
    );
    perfReport = { totalDuration: 0, entries: [], slowEntries: [] };
  }

  // V4.2.1: 安全计算响应大小，处理 BigInt 等不可序列化的类型
  let responseSize = 0;
  try {
    responseSize = JSON.stringify(bookmarks || [], (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ).length;
  } catch {
    responseSize = -1; // 表示无法计算
  }

  logger.info(
    {
      userId,
      bookmarkCount: bookmarks?.length || 0,
      totalCount: count || 0,
      responseSize,
      performance: {
        totalMs: Math.round(perfReport.totalDuration),
        stages: perfReport.entries.map((e) => ({
          name: e.name,
          ms: Math.round(e.duration),
        })),
        slowOperations: perfReport.slowEntries.map((e) => e.name),
      },
    },
    "Bookmarks query completed",
  );

  // V4.2.7: 生成数据版本号用于客户端缓存验证
  const dataVersion = generateDataVersion(
    bookmarks as Array<{ updated_at?: string | null }> | null,
  );

  // V4.2.1: 返回带缓存头的响应
  const responseData = {
    success: true,
    data: {
      bookmarks: bookmarks || [],
      pagination: {
        total: count || 0,
        limit,
        nextCursor,
        hasMore,
      },
      // V4.2.7: 数据版本号，客户端可用于判断缓存是否过期
      dataVersion,
      // 开发环境返回性能数据
      ...(process.env.NODE_ENV === "development" && {
        _performance: monitor.toJSON(),
        _responseSize: responseSize,
      }),
    },
  };

  // V4.2.1: 使用自定义序列化处理 BigInt 等特殊类型
  const jsonString = JSON.stringify(responseData, (_, value) =>
    typeof value === "bigint" ? Number(value) : value,
  );

  return new NextResponse(jsonString, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": CACHE_CONTROL_HEADER,
      // V4.2.7: 添加数据版本头，让客户端可以用 If-None-Match 验证
      [DATA_VERSION_HEADER]: dataVersion,
      ETag: `"${dataVersion}"`,
    },
  });
});
