/**
 * Knowledge Link Debug API
 *
 * 临时调试接口，用于诊断知识关联问题
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 查询知识关联数量
    const { data: linkCount, error: linkError } = await supabase
      .from("knowledge_links")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    // 查询有 embedding 的书签数量
    const { count: bookmarkWithEmbedding, error: bookmarkError } =
      await supabase
        .from("bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("embedding", "is", null);

    // 查询总书签数量
    const { count: totalBookmarks, error: totalError } = await supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    // 直接调用 RPC 函数测试
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcTest, error: rpcError } = await (supabase as any).rpc(
      "get_related_bookmarks_with_details",
      {
        p_bookmark_id: 1,
        p_user_id: user.id,
        p_limit: 5,
        p_min_strength: 0.3,
        p_link_types: null,
      },
    );

    return NextResponse.json({
      userId: user.id,
      knowledgeLinks: {
        count: linkCount?.length || 0,
        error: linkError?.message,
      },
      bookmarks: {
        total: totalBookmarks || 0,
        withEmbedding: bookmarkWithEmbedding || 0,
        error: bookmarkError?.message || totalError?.message,
      },
      rpcTest: {
        result: rpcTest,
        error: rpcError?.message,
      },
    });
  } catch (error) {
    logger.error({ error }, "[Debug API] Error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
