/**
 * 定时任务: AI 智能分拣
 * 定期处理缓存池中的待聚类书签，自动创建文件夹或生成建议
 *
 * Vercel Cron: 0 4 * * * (每日凌晨 4:00)
 * 或每小时运行: 0 * * * *
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  initSupabaseAdmin,
  getSupabaseAdmin,
} from "@/lib/supabase/admin-client";
import {
  verifyInternalRequest,
  internalUnauthorizedResponse,
} from "@/lib/auth/internal-auth";
import type { Json } from "@/types/supabase";

// 配置常量
const MIN_PENDING_AGE_HOURS = 1; // 最少等待 1 小时
const MAX_USERS_PER_RUN = 50; // 每次最多处理 50 个用户
const MAX_BOOKMARKS_PER_USER = 100; // 每用户最多处理 100 个待聚类书签
const MIN_CLUSTER_SIZE = 3; // 最小聚类大小
const MIN_SIMILARITY = 0.65; // 最小相似度阈值

/**
 * GET /api/cron/smart-sorting
 * 智能分拣定时任务
 */
export async function GET(request: Request) {
  try {
    // Verify internal request using unified auth
    const auth = verifyInternalRequest(request);
    if (!auth.authorized) {
      return internalUnauthorizedResponse(auth.error);
    }

    // 初始化 Supabase Admin 客户端
    try {
      initSupabaseAdmin();
    } catch (error) {
      logger.error({ error }, "Failed to initialize Supabase admin client");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    logger.info({ action: "cron_start" }, "Smart sorting cron job started");

    const startTime = Date.now();
    const stats = {
      usersProcessed: 0,
      clustersFound: 0,
      foldersCreated: 0,
      suggestionsCreated: 0,
      errors: 0,
    };

    // 1. 获取有待聚类书签的用户列表
    // Note: pending_cluster, pending_since 是 V4.2 新增字段
    const { data: usersWithPending, error: fetchError } =
      await getSupabaseAdmin()
        .from("bookmarks")
        .select("user_id")
        .eq("pending_cluster", true)
        .is("deleted_at", null)
        .lt(
          "pending_since",
          new Date(
            Date.now() - MIN_PENDING_AGE_HOURS * 60 * 60 * 1000,
          ).toISOString(),
        )
        .limit(1000);

    if (fetchError) {
      logger.error(
        { error: fetchError },
        "Failed to fetch users with pending bookmarks",
      );
      return NextResponse.json(
        { error: "Failed to fetch users", details: fetchError.message },
        { status: 500 },
      );
    }

    // 去重用户 ID
    const typedUsersWithPending = (usersWithPending || []) as Array<{
      user_id: string;
    }>;
    const uniqueUserIds = [
      ...new Set(typedUsersWithPending.map((row) => row.user_id)),
    ].slice(0, MAX_USERS_PER_RUN);

    if (uniqueUserIds.length === 0) {
      logger.info("No users with pending bookmarks to process");
      return NextResponse.json({
        success: true,
        message: "No users with pending bookmarks",
        stats: { ...stats, duration: Date.now() - startTime },
      });
    }

    logger.info(
      { userCount: uniqueUserIds.length },
      "Found users with pending bookmarks",
    );

    // 2. 依次处理每个用户
    for (const userId of uniqueUserIds) {
      try {
        const userResult = await processUserInbox(userId);
        stats.usersProcessed++;
        stats.clustersFound += userResult.clustersFound;
        stats.foldersCreated += userResult.foldersCreated;
        stats.suggestionsCreated += userResult.suggestionsCreated;
      } catch (error) {
        stats.errors++;
        logger.error(
          { error, userId },
          "Failed to process user inbox in cron job",
        );
      }
    }

    const duration = Date.now() - startTime;

    logger.info({ ...stats, duration }, "Smart sorting cron job completed");

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        duration,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Smart sorting cron job failed",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * 处理单个用户的待整理书签
 */
async function processUserInbox(userId: string): Promise<{
  clustersFound: number;
  foldersCreated: number;
  suggestionsCreated: number;
}> {
  const result = {
    clustersFound: 0,
    foldersCreated: 0,
    suggestionsCreated: 0,
  };

  // 1. 获取用户的自治等级设置
  // Note: ai_evolution_level 是 V4.2 新增字段
  const { data: profile } = await getSupabaseAdmin()
    .from("profiles")
    .select("ai_evolution_level")
    .eq("id", userId)
    .single();

  // 默认 Level 2 (半自治)
  const profileTyped = profile as { ai_evolution_level?: number } | null;
  const autonomyLevel = profileTyped?.ai_evolution_level ?? 2;

  // Level 3 用户不自动处理，只提供建议
  // 这里我们仍然运行聚类，但只创建建议不自动执行

  // 2. 获取待聚类书签
  // Note: pending_cluster, pending_since 是 V4.2 新增字段
  const { data: pendingBookmarks, error: fetchError } = await getSupabaseAdmin()
    .from("bookmarks")
    .select("id, title, url, ai_summary, ai_tags, embedding, pending_since")
    .eq("user_id", userId)
    .eq("pending_cluster", true)
    .is("deleted_at", null)
    .lt(
      "pending_since",
      new Date(
        Date.now() - MIN_PENDING_AGE_HOURS * 60 * 60 * 1000,
      ).toISOString(),
    )
    .order("pending_since", { ascending: true })
    .limit(MAX_BOOKMARKS_PER_USER);

  const typedBookmarks = pendingBookmarks as Array<{
    id: number;
    title: string | null;
    url: string | null;
    ai_summary: string | null;
    ai_tags: string[] | null;
    embedding: number[] | null;
    pending_since: string | null;
  }> | null;

  if (
    fetchError ||
    !typedBookmarks ||
    typedBookmarks.length < MIN_CLUSTER_SIZE
  ) {
    return result;
  }

  logger.info(
    { userId, pendingCount: typedBookmarks.length },
    "Processing pending bookmarks for user",
  );

  // 3. 执行 DBSCAN 聚类
  const clusters = performClustering(typedBookmarks);

  result.clustersFound = clusters.length;

  // 4. 处理每个聚类
  for (const cluster of clusters) {
    if (cluster.bookmarks.length < MIN_CLUSTER_SIZE) continue;

    try {
      // 根据自治等级决定操作
      if (autonomyLevel === 1) {
        // Level 1: 全自动创建文件夹
        const folderCreated = await autoCreateFolder(userId, cluster);
        if (folderCreated) {
          result.foldersCreated++;
        }
      } else {
        // Level 2 & 3: 创建建议
        const suggestionCreated = await createSuggestion(userId, cluster);
        if (suggestionCreated) {
          result.suggestionsCreated++;
        }
      }
    } catch (error) {
      logger.error(
        { error, userId, clusterSize: cluster.bookmarks.length },
        "Failed to process cluster",
      );
    }
  }

  return result;
}

/**
 * DBSCAN 聚类算法
 */
function performClustering(
  bookmarks: Array<{
    id: number;
    title: string | null;
    url: string | null;
    ai_summary: string | null;
    ai_tags: string[] | null;
    embedding: number[] | null;
    pending_since: string | null;
  }>,
): Array<{
  bookmarks: typeof bookmarks;
  centroid: number[] | null;
}> {
  // 过滤出有 embedding 的书签
  const bookmarksWithEmbedding = bookmarks.filter(
    (b) => b.embedding && Array.isArray(b.embedding) && b.embedding.length > 0,
  );

  if (bookmarksWithEmbedding.length < MIN_CLUSTER_SIZE) {
    return [];
  }

  // 计算相似度矩阵
  const n = bookmarksWithEmbedding.length;
  const similarityMatrix: number[][] = Array.from({ length: n }, () =>
    Array(n).fill(0),
  );

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(
        bookmarksWithEmbedding[i].embedding as number[],
        bookmarksWithEmbedding[j].embedding as number[],
      );
      similarityMatrix[i][j] = sim;
      similarityMatrix[j][i] = sim;
    }
    similarityMatrix[i][i] = 1;
  }

  // DBSCAN 聚类
  const visited = new Set<number>();
  const clustered = new Set<number>();
  const clusters: Array<{
    bookmarks: typeof bookmarksWithEmbedding;
    centroid: number[] | null;
  }> = [];

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue;
    visited.add(i);

    // 找邻居
    const neighbors = findNeighbors(i, similarityMatrix, MIN_SIMILARITY);

    if (neighbors.length >= MIN_CLUSTER_SIZE - 1) {
      // 扩展聚类
      const cluster = new Set<number>([i]);
      const queue = [...neighbors];

      while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) break;
        if (!visited.has(current)) {
          visited.add(current);
          const currentNeighbors = findNeighbors(
            current,
            similarityMatrix,
            MIN_SIMILARITY,
          );
          if (currentNeighbors.length >= MIN_CLUSTER_SIZE - 1) {
            queue.push(...currentNeighbors.filter((n) => !visited.has(n)));
          }
        }
        if (!clustered.has(current)) {
          cluster.add(current);
          clustered.add(current);
        }
      }

      if (cluster.size >= MIN_CLUSTER_SIZE) {
        const clusterBookmarks = Array.from(cluster).map(
          (idx) => bookmarksWithEmbedding[idx],
        );
        const centroid = computeCentroid(
          clusterBookmarks.map((b) => b.embedding as number[]),
        );
        clusters.push({ bookmarks: clusterBookmarks, centroid });
      }
    }
  }

  return clusters;
}

/**
 * 找邻居点
 */
function findNeighbors(
  point: number,
  similarityMatrix: number[][],
  minSimilarity: number,
): number[] {
  const neighbors: number[] = [];
  for (let i = 0; i < similarityMatrix[point].length; i++) {
    if (i !== point && similarityMatrix[point][i] >= minSimilarity) {
      neighbors.push(i);
    }
  }
  return neighbors;
}

/**
 * 计算聚类中心
 */
function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];

  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);

  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += emb[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length;
  }

  // 归一化
  const norm = Math.sqrt(centroid.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      centroid[i] /= norm;
    }
  }

  return centroid;
}

/**
 * 余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * 自动创建文件夹 (Level 1)
 */
async function autoCreateFolder(
  userId: string,
  cluster: {
    bookmarks: Array<{
      id: number;
      title: string | null;
      ai_tags: string[] | null;
      ai_summary: string | null;
    }>;
    centroid: number[] | null;
  },
): Promise<boolean> {
  try {
    // 1. 生成文件夹名称
    const folderName = await generateFolderName(cluster);

    // 2. 检查今日创建数量限制 (6个/天)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Note: operation_snapshots 是 V4.2 新增表
    const { count: todayCount } = await getSupabaseAdmin()
      .from("operation_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("action", "create")
      .gte("created_at", today.toISOString());

    if ((todayCount ?? 0) >= 6) {
      logger.info(
        { userId },
        "Daily folder creation limit reached, creating suggestion instead",
      );
      return await createSuggestion(userId, cluster);
    }

    // 3. 预留：快照 ID 用于撤销功能
    // const _snapshotId = crypto.randomUUID();

    // 4. 创建文件夹
    // is_ai_suggested, ai_reason 是 V4.2 新增字段，未在 Supabase 生成类型中
    type CreatedFolderType = { id: number; name: string };

    const { data: newFolder, error: createError } = (await getSupabaseAdmin()
      .from("folders")
      .insert({
        user_id: userId,
        name: folderName.name,
        is_system: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- V4.2 新增字段，待重新生成类型后移除
        ...({ is_ai_suggested: true, ai_reason: folderName.reason } as any),
      })
      .select("id, name")
      .single()) as {
      data: CreatedFolderType | null;
      error: { message: string } | null;
    };

    if (createError || !newFolder) {
      throw new Error(`Failed to create folder: ${createError?.message}`);
    }

    // 5. 移动书签到新文件夹
    // Note: pending_cluster, pending_since, cluster_id 是 V4.2 新增字段
    const bookmarkIds = cluster.bookmarks.map((b) => b.id);

    const { error: moveError } = await getSupabaseAdmin()
      .from("bookmarks")
      .update({
        folder_id: newFolder.id,
        pending_cluster: false,
        pending_since: null,
        cluster_id: null,
      })
      .in("id", bookmarkIds);

    if (moveError) {
      throw new Error(`Failed to move bookmarks: ${moveError.message}`);
    }

    // 6. 记录操作快照
    await getSupabaseAdmin()
      .from("operation_snapshots")
      .insert({
        user_id: userId,
        action: "create",
        folder_id: newFolder.id,
        bookmark_ids: bookmarkIds,
        before_state: null,
        after_state: {
          folder: { id: newFolder.id, name: newFolder.name },
          bookmarkIds,
        } as unknown as Json,
        reason: folderName.reason,
        expires_at: new Date(
          Date.now() + 2 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 2天后过期
      });

    // 7. 创建消息通知
    await getSupabaseAdmin()
      .from("user_notifications")
      .insert({
        user_id: userId,
        type_code: "folder.auto_created",
        priority: "normal",
        title: `AI 自动创建了「${newFolder.name}」`,
        body: `已将 ${bookmarkIds.length} 个相似书签整理到新文件夹中`,
        channels: ["in_app"],
        status: "unread",
        metadata: {
          folderId: newFolder.id,
          folderName: newFolder.name,
          bookmarkCount: bookmarkIds.length,
          reason: folderName.reason,
        },
        entity_id: String(newFolder.id),
        entity_type: "folder",
      });

    logger.info(
      {
        userId,
        folderId: newFolder.id,
        folderName: newFolder.name,
        bookmarkCount: bookmarkIds.length,
      },
      "Auto-created folder from cluster",
    );

    return true;
  } catch (error) {
    logger.error({ error, userId }, "Failed to auto-create folder");
    return false;
  }
}

/**
 * 创建建议 (Level 2 & 3)
 */
async function createSuggestion(
  userId: string,
  cluster: {
    bookmarks: Array<{
      id: number;
      title: string | null;
      ai_tags: string[] | null;
      ai_summary: string | null;
    }>;
    centroid: number[] | null;
  },
): Promise<boolean> {
  try {
    // 1. 生成文件夹名称
    const folderName = await generateFolderName(cluster);

    // 2. 为聚类分配 ID
    const clusterId = crypto.randomUUID();
    const bookmarkIds = cluster.bookmarks.map((b) => b.id);

    // 3. 更新书签的聚类 ID（cluster_id, cluster_confidence 在生成类型中）
    await getSupabaseAdmin()
      .from("bookmarks")
      .update({
        cluster_id: clusterId,
        cluster_confidence: 0.8, // 初始置信度
      })
      .in("id", bookmarkIds);

    // 4. 创建建议记录
    await getSupabaseAdmin()
      .from("classification_suggestions")
      .insert({
        user_id: userId,
        batch_id: clusterId, // 使用聚类 ID 作为批次标识
        bookmark_id: bookmarkIds[0], // 使用第一个书签 ID
        suggested_folder_name: folderName.name,
        suggest_new_folder: true,
        confidence: 0.8,
        reason: `聚类建议: ${folderName.reason} (包含 ${bookmarkIds.length} 个书签, IDs: ${bookmarkIds.slice(0, 5).join(",")})`,
        status: "pending",
      });

    logger.info(
      {
        userId,
        clusterId,
        suggestedName: folderName.name,
        bookmarkCount: bookmarkIds.length,
      },
      "Created folder suggestion from cluster",
    );

    return true;
  } catch (error) {
    logger.error({ error, userId }, "Failed to create suggestion");
    return false;
  }
}

/**
 * 生成文件夹名称（简化版，不调用 AI）
 */
async function generateFolderName(cluster: {
  bookmarks: Array<{
    title: string | null;
    ai_tags: string[] | null;
    ai_summary: string | null;
  }>;
}): Promise<{ name: string; reason: string }> {
  // 从标签中提取最常见的主题
  const tagFrequency: Record<string, number> = {};
  for (const bookmark of cluster.bookmarks) {
    const tags = bookmark.ai_tags || [];
    for (const tag of tags) {
      tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
    }
  }

  // 取最高频标签
  const sortedTags = Object.entries(tagFrequency).sort((a, b) => b[1] - a[1]);

  if (
    sortedTags.length > 0 &&
    sortedTags[0][1] >= cluster.bookmarks.length * 0.5
  ) {
    // 如果最高频标签出现在至少 50% 的书签中，使用它作为文件夹名
    return {
      name: sortedTags[0][0],
      reason: `${sortedTags[0][1]}/${cluster.bookmarks.length} 个书签包含此标签`,
    };
  }

  // 否则尝试从标题中提取关键词
  const titleKeywords = extractKeywordsFromTitles(
    cluster.bookmarks.map((b) => b.title || ""),
  );

  if (titleKeywords) {
    return {
      name: titleKeywords,
      reason: "基于书签标题关键词自动生成",
    };
  }

  // 降级：使用日期作为名称
  const date = new Date();
  return {
    name: `待整理-${date.getMonth() + 1}月${date.getDate()}日`,
    reason: "无法提取明确主题，使用日期命名",
  };
}

/**
 * 从标题中提取关键词
 */
function extractKeywordsFromTitles(titles: string[]): string | null {
  const commonKeywords = [
    "前端",
    "后端",
    "React",
    "Vue",
    "Node",
    "Python",
    "AI",
    "机器学习",
    "深度学习",
    "产品",
    "设计",
    "运营",
    "营销",
    "投资",
    "创业",
    "效率",
    "工具",
    "教程",
    "指南",
  ];

  const titleText = titles.join(" ");

  for (const keyword of commonKeywords) {
    const regex = new RegExp(keyword, "gi");
    const matches = titleText.match(regex);
    if (matches && matches.length >= 2) {
      return keyword;
    }
  }

  return null;
}

// 配置: 允许较长的执行时间
export const maxDuration = 300; // 5 分钟
