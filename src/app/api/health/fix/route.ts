/**
 * 一键修复 API
 *
 * POST /api/health/fix - 执行一键修复
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type {
  QuickFixRequest,
  QuickFixResult,
} from "@/lib/ai-skills/skills/health-check/types";

// ============================================
// POST - 执行一键修复
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "未授权" },
        { status: 401 },
      );
    }

    const body: QuickFixRequest = await request.json();
    const { strategy, dryRun = false } = body;

    if (!strategy) {
      return NextResponse.json(
        { success: false, error: "缺少修复策略" },
        { status: 400 },
      );
    }

    const result: QuickFixResult = {
      success: true,
      deleted: 0,
      archived: 0,
      merged: 0,
      ignored: 0,
      errors: [],
    };

    // 获取所有问题
    const { data: issues } = await supabase
      .from("health_check_cache")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "issue");

    if (!issues?.length) {
      return NextResponse.json({
        success: true,
        data: { ...result, message: "没有需要修复的问题" },
      });
    }

    // 分类问题
    const brokenLinkIssues = issues.filter(
      (i) => i.check_type === "broken_link",
    );
    const duplicateIssues = issues.filter((i) => i.check_type === "duplicate");
    const staleIssues = issues.filter((i) => i.check_type === "stale");

    // 预览模式
    if (dryRun) {
      const preview = {
        toDelete: 0,
        toArchive: 0,
        toMerge: 0,
        toIgnore: 0,
      };

      if (strategy.brokenLinks === "delete") {
        preview.toDelete += brokenLinkIssues.length;
      } else if (strategy.brokenLinks === "ignore") {
        preview.toIgnore += brokenLinkIssues.length;
      }

      if (strategy.duplicates !== "skip") {
        // 统计要删除的重复书签
        const groupIds = new Set(
          duplicateIssues.map(
            (i) => (i.details as Record<string, unknown>)?.groupId,
          ),
        );
        preview.toMerge = groupIds.size;
        preview.toDelete += duplicateIssues.length;
      }

      if (strategy.staleContent === "delete") {
        preview.toDelete += staleIssues.length;
      } else if (strategy.staleContent === "archive") {
        preview.toArchive += staleIssues.length;
      } else if (strategy.staleContent === "ignore") {
        preview.toIgnore += staleIssues.length;
      }

      return NextResponse.json({
        success: true,
        data: {
          preview,
          message: "预览模式，未执行实际操作",
        },
      });
    }

    // 执行修复

    // 1. 处理失效链接
    if (strategy.brokenLinks !== "skip" && brokenLinkIssues.length > 0) {
      const bookmarkIds = brokenLinkIssues.map((i) => i.bookmark_id);

      if (strategy.brokenLinks === "delete") {
        const { error } = await supabase
          .from("bookmarks")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", bookmarkIds)
          .eq("user_id", user.id);

        if (error) {
          result.errors.push({ id: "broken_links", error: error.message });
        } else {
          result.deleted += bookmarkIds.length;
        }
      } else if (strategy.brokenLinks === "ignore") {
        result.ignored += bookmarkIds.length;
      }

      // 更新问题状态
      await supabase
        .from("health_check_cache")
        .update({
          status: strategy.brokenLinks === "ignore" ? "ignored" : "resolved",
          resolved_at: new Date().toISOString(),
          resolution_action: strategy.brokenLinks,
        })
        .in(
          "id",
          brokenLinkIssues.map((i) => i.id),
        );
    }

    // 2. 处理重复内容
    if (strategy.duplicates !== "skip" && duplicateIssues.length > 0) {
      // 按组处理
      const groupMap = new Map<string, typeof duplicateIssues>();

      for (const issue of duplicateIssues) {
        const groupId =
          ((issue.details as Record<string, unknown>)?.groupId as string) ||
          issue.id;
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, []);
        }
        groupMap.get(groupId)!.push(issue);
      }

      for (const [, groupIssues] of groupMap) {
        // 确定保留哪个
        let keepId: string;

        if (strategy.duplicates === "keep_oldest") {
          // 保留最早创建的
          keepId = groupIssues.sort(
            (a, b) =>
              new Date(a.detected_at).getTime() -
              new Date(b.detected_at).getTime(),
          )[0].bookmark_id;
        } else if (strategy.duplicates === "keep_newest") {
          // 保留最新创建的
          keepId = groupIssues.sort(
            (a, b) =>
              new Date(b.detected_at).getTime() -
              new Date(a.detected_at).getTime(),
          )[0].bookmark_id;
        } else {
          // keep_most_complete - 使用推荐的
          keepId =
            ((groupIssues[0].details as Record<string, unknown>)
              ?.recommendedKeepId as string) || groupIssues[0].bookmark_id;
        }

        // 删除其他书签
        const toDeleteIds = groupIssues
          .filter((i) => i.bookmark_id !== keepId)
          .map((i) => i.bookmark_id);

        if (toDeleteIds.length > 0) {
          const { error } = await supabase
            .from("bookmarks")
            .update({ deleted_at: new Date().toISOString() })
            .in("id", toDeleteIds)
            .eq("user_id", user.id);

          if (error) {
            result.errors.push({ id: `duplicate_group`, error: error.message });
          } else {
            result.deleted += toDeleteIds.length;
            result.merged += 1;
          }
        }
      }

      // 更新问题状态
      await supabase
        .from("health_check_cache")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolution_action: "merged",
        })
        .in(
          "id",
          duplicateIssues.map((i) => i.id),
        );
    }

    // 3. 处理过期内容
    if (strategy.staleContent !== "skip" && staleIssues.length > 0) {
      const bookmarkIds = staleIssues.map((i) => i.bookmark_id);

      if (strategy.staleContent === "delete") {
        const { error } = await supabase
          .from("bookmarks")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", bookmarkIds)
          .eq("user_id", user.id);

        if (error) {
          result.errors.push({ id: "stale", error: error.message });
        } else {
          result.deleted += bookmarkIds.length;
        }
      } else if (strategy.staleContent === "archive") {
        const { error } = await supabase
          .from("bookmarks")
          .update({ is_archived: true })
          .in("id", bookmarkIds)
          .eq("user_id", user.id);

        if (error) {
          result.errors.push({ id: "stale", error: error.message });
        } else {
          result.archived += bookmarkIds.length;
        }
      } else if (strategy.staleContent === "ignore") {
        result.ignored += bookmarkIds.length;
      }

      // 更新问题状态
      await supabase
        .from("health_check_cache")
        .update({
          status: strategy.staleContent === "ignore" ? "ignored" : "resolved",
          resolved_at: new Date().toISOString(),
          resolution_action: strategy.staleContent,
        })
        .in(
          "id",
          staleIssues.map((i) => i.id),
        );
    }

    result.success = result.errors.length === 0;

    logger.info(
      {
        userId: user.id,
        ...result,
      },
      "QuickFix API: Execution completed",
    );

    return NextResponse.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "QuickFix API: Unexpected error",
    );
    return NextResponse.json(
      { success: false, error: "服务器错误" },
      { status: 500 },
    );
  }
}
