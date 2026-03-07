/**
 * Knowledge Link Rebuild API
 *
 * POST /api/knowledge-link/rebuild
 * 重建用户的知识关联图谱
 *
 * @version 1.1.0 - 使用数据库函数直接处理
 */

import { NextResponse } from "next/server";
import { withAuthMiddleware } from "@/lib/api/middleware";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/supabase";

export const POST = withAuthMiddleware(async (request, { userId }) => {
  const supabase = await createClient();

  const body = await request.json().catch(() => ({}));
  const batchSize = body.batchSize || 20;
  const dryRun = body.dryRun === true;

  logger.info(
    { userId, batchSize, dryRun },
    "[Rebuild API] Starting knowledge graph rebuild",
  );

  // 1. 获取有 embedding 的书签
  const { data: bookmarks, error: bookmarkError } = await supabase
    .from("bookmarks")
    .select("id, title")
    .eq("user_id", userId)
    .not("embedding", "is", null)
    .order("created_at", { ascending: false });

  if (bookmarkError) {
    return NextResponse.json(
      { error: `获取书签失败: ${bookmarkError.message}` },
      { status: 500 },
    );
  }

  const bookmarkIds = (bookmarks || []).map((b) => b.id);
  const total = bookmarkIds.length;

  if (total === 0) {
    return NextResponse.json({
      success: true,
      message: "没有可处理的书签（需要有 embedding）",
      result: { totalProcessed: 0, totalLinks: 0 },
    });
  }

  logger.info(
    { userId, totalBookmarks: total },
    "[Rebuild API] Found bookmarks with embedding",
  );

  // 2. 清空现有关联（如果不是 dry run）
  if (!dryRun) {
    const { error: deleteError } = await supabase
      .from("knowledge_links")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      logger.error(
        { error: deleteError },
        "[Rebuild API] Failed to delete existing links",
      );
      return NextResponse.json(
        { error: `清空现有关联失败: ${deleteError.message}` },
        { status: 500 },
      );
    }
  }

  // 3. 批量处理书签，发现关联
  let processed = 0;
  let totalLinks = 0;
  const allLinks: Array<{
    bookmarkId1: number;
    bookmarkId2: number;
    linkType: string;
    strength: number;
    evidence: Record<string, unknown>;
  }> = [];

  for (let i = 0; i < bookmarkIds.length; i += batchSize) {
    const batch = bookmarkIds.slice(i, i + batchSize);

    // 并行处理批次
    const results = await Promise.allSettled(
      batch.map(async (bookmarkId) => {
        // 调用数据库函数发现关联
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc(
          "discover_bookmark_links",
          {
            p_user_id: userId,
            p_bookmark_id: bookmarkId,
            p_options: {
              semantic: { enabled: true, minSimilarity: 0.7, limit: 10 },
              entity: { enabled: true, minShared: 1, limit: 10 },
              tag: { enabled: true, minShared: 2, limit: 10 },
            },
          },
        );

        if (error) {
          logger.warn(
            { bookmarkId, error: error.message },
            "[Rebuild API] Discover failed for bookmark",
          );
          return [];
        }

        return (data || []).map(
          (
            link: // eslint-disable-next-line @typescript-eslint/no-explicit-any
            any,
          ) => ({
            bookmarkId1: Math.min(bookmarkId, link.related_bookmark_id),
            bookmarkId2: Math.max(bookmarkId, link.related_bookmark_id),
            linkType: link.link_type,
            strength: link.strength,
            evidence: link.evidence,
          }),
        );
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        processed++;
        allLinks.push(...result.value);
      }
    }

    logger.info(
      { userId, processed, total, linksFound: allLinks.length },
      "[Rebuild API] Progress",
    );

    // 批次间短暂延迟
    if (i + batchSize < bookmarkIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // 4. 保存关联（如果不是 dry run）
  if (!dryRun && allLinks.length > 0) {
    // 去重
    const uniqueLinks = new Map<string, (typeof allLinks)[0]>();
    for (const link of allLinks) {
      const key = `${link.bookmarkId1}-${link.bookmarkId2}-${link.linkType}`;
      if (
        !uniqueLinks.has(key) ||
        (uniqueLinks.get(key)?.strength ?? 0) < link.strength
      ) {
        uniqueLinks.set(key, link);
      }
    }

    const linksToSave = Array.from(uniqueLinks.values());

    // 批量插入
    const { error: insertError } = await supabase
      .from("knowledge_links")
      .insert(
        linksToSave.map((link) => ({
          user_id: userId,
          source_bookmark_id: link.bookmarkId1,
          target_bookmark_id: link.bookmarkId2,
          link_type: link.linkType,
          strength: link.strength,
          evidence: link.evidence as unknown as Json,
          algorithm: "rebuild-api",
        })),
      );

    if (insertError) {
      logger.error(
        { error: insertError },
        "[Rebuild API] Failed to insert links",
      );
      return NextResponse.json(
        { error: `保存关联失败: ${insertError.message}` },
        { status: 500 },
      );
    }

    totalLinks = linksToSave.length;
  }

  logger.info(
    { userId, processed, totalLinks },
    "[Rebuild API] Rebuild complete",
  );

  return NextResponse.json({
    success: true,
    message: dryRun
      ? `Dry run 完成，发现 ${allLinks.length} 条潜在关联`
      : `知识图谱重建完成，生成 ${totalLinks} 条关联`,
    result: {
      totalProcessed: processed,
      totalLinks: dryRun ? allLinks.length : totalLinks,
      dryRun,
    },
  });
});
