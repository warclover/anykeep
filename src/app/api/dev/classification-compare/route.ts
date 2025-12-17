/**
 * 分类系统 A/B 对比 API
 *
 * 用于对比 V4.2 和 Lite V2 的分类结果
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyBookmarkV2 } from "@/lib/classification/integration";

// 候选文件夹类型定义
interface FolderCandidate {
  folder_id: number;
  folder_name: string;
  similarity: number;
  bookmark_count: number;
  top_tags?: string[];
}

interface ScoredCandidate extends FolderCandidate {
  score: number;
  hasContent: boolean;
}

// Lite V2 分类服务（简化版，后续替换为完整实现）
async function classifyWithLiteV2(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  embedding: number[],
  tags: string[],
): Promise<{
  action: string;
  folderId?: number;
  folderName?: string;
  confidence: number;
  reason: string;
}> {
  // ========================================
  // Lite V2 核心逻辑（简化版）
  // 完整实现后替换此处
  // ========================================

  // 1. 获取候选文件夹
  // embedding 需要转换为字符串格式以匹配 Supabase RPC 的 vector 类型
  const { data: candidates, error } = await supabase.rpc(
    "search_folders_unified",
    {
      p_user_id: userId,
      p_embedding: JSON.stringify(embedding),
      p_limit: 5,
    },
  );

  if (error || !candidates || candidates.length === 0) {
    return {
      action: "to_inbox",
      confidence: 0,
      reason: "未找到候选文件夹",
    };
  }

  // 2. 计算分数（简化版公式）
  const scoredCandidates = candidates.map(
    (c: FolderCandidate): ScoredCandidate => {
      const hasContent = c.bookmark_count > 0;

      // 标签匹配加成
      const tagOverlap = c.top_tags
        ? tags.filter((t) => c.top_tags?.includes(t)).length /
          Math.max(tags.length, 1)
        : 0;

      let score: number;
      if (hasContent) {
        // 有内容：内容相似度为主
        score = c.similarity * 0.65 + tagOverlap * 0.2 + 0.15 * c.similarity;
      } else {
        // 空文件夹：名称相似度
        score = c.similarity * 0.75 + tagOverlap * 0.25;
      }

      return {
        ...c,
        score: Math.min(1, Math.max(0, score)),
        hasContent,
      };
    },
  );

  // 3. 排序
  scoredCandidates.sort(
    (a: ScoredCandidate, b: ScoredCandidate) => b.score - a.score,
  );

  const top = scoredCandidates[0];

  // 4. 决策（保守阈值）
  const autoThreshold = top.hasContent ? 0.75 : 0.85;
  const suggestThreshold = top.hasContent ? 0.55 : 0.65;
  const confidence = Math.round(top.score * 100);

  if (top.score >= autoThreshold) {
    return {
      action: "auto_classify",
      folderId: top.folder_id,
      folderName: top.folder_name,
      confidence,
      reason: top.hasContent ? "内容高度匹配" : "与文件夹主题高度相关",
    };
  }

  if (top.score >= suggestThreshold) {
    return {
      action: "suggest",
      folderId: top.folder_id,
      folderName: top.folder_name,
      confidence,
      reason: top.hasContent ? "内容相似，建议确认" : "可能属于此文件夹",
    };
  }

  return {
    action: "to_inbox",
    confidence,
    reason: "未找到足够匹配的文件夹",
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 验证用户
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();
    const { version, bookmarkId, embedding, tags, title } = body;

    if (!version || !bookmarkId || !embedding) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    // 根据版本选择分类方法
    if (version === "v4.2") {
      // 使用现有 V4.2 分类
      const result = await classifyBookmarkV2(
        bookmarkId,
        title || "",
        null, // summary
        tags || [],
        user.id,
      );

      return NextResponse.json({
        action: result.action,
        folderId: result.folderId,
        folderName: result.folderName,
        confidence: result.confidence,
        reason: result.action === "classify" ? "自动分类" : "建议分类",
      });
    } else if (version === "lite-v2") {
      // 使用 Lite V2 分类
      const result = await classifyWithLiteV2(
        supabase,
        user.id,
        embedding,
        tags || [],
      );

      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: "未知版本" }, { status: 400 });
    }
  } catch (error) {
    console.error("分类对比 API 错误:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
