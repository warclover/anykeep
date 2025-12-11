/**
 * Classification Decision Reason API
 * V4.2 分类决策理由 API
 *
 * @description 获取单个书签的分类决策详细解释
 * - 为什么被分类到当前文件夹
 * - 置信度分析
 * - 匹配来源（向量相似、规则匹配、来源匹配等）
 * - 备选方案
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================================================
// 类型定义
// ============================================================================

interface ClassificationResult {
  folderId?: number | null;
  folderName?: string;
  confidence?: number;
  matchSource?: string;
  reason?: string;
  alternatives?: Array<{
    folderId: number;
    folderName: string;
    confidence: number;
    reason?: string;
  }>;
}

interface ClassificationReason {
  /** 书签 ID */
  bookmarkId: number;
  /** 书签标题 */
  title: string;
  /** 当前文件夹信息 */
  currentFolder: {
    id: number | null;
    name: string;
    isSystem: boolean;
  } | null;
  /** 分类状态 */
  classificationStatus: "classified" | "inbox" | "uncategorized" | "pending";
  /** 分类置信度 */
  confidence: number | null;
  /** 分类理由 */
  reason: string;
  /** 匹配来源 */
  matchSource: {
    type: "embedding" | "source" | "tag" | "rule" | "manual" | "unknown";
    label: string;
    description: string;
  };
  /** 决策详情 */
  decisionDetails: {
    /** 是否为 AI 自动分类 */
    isAutoClassified: boolean;
    /** 是否用户手动调整过 */
    wasManuallyAdjusted: boolean;
    /** 分类时间 */
    classifiedAt: string | null;
    /** 最后调整时间 */
    lastAdjustedAt: string | null;
  };
  /** 备选文件夹建议 */
  alternatives: Array<{
    folderId: number;
    folderName: string;
    confidence: number;
    reason: string;
  }>;
  /** 相关因素 */
  factors: Array<{
    name: string;
    value: string;
    impact: "positive" | "negative" | "neutral";
    description: string;
  }>;
}

// ============================================================================
// 匹配来源配置
// ============================================================================

const MATCH_SOURCE_INFO: Record<
  string,
  { label: string; description: string }
> = {
  embedding: {
    label: "语义相似",
    description: "基于内容语义向量与文件夹画像的相似度匹配",
  },
  source: {
    label: "来源匹配",
    description: "基于内容来源（域名、平台）与文件夹的历史关联",
  },
  tag: {
    label: "标签匹配",
    description: "基于内容标签与文件夹标签的重叠度",
  },
  rule: {
    label: "规则匹配",
    description: "基于用户自定义的分类规则",
  },
  manual: {
    label: "手动分类",
    description: "用户手动选择的文件夹",
  },
  cluster: {
    label: "聚类分析",
    description: "基于相似内容聚类后的批量分类",
  },
  unknown: {
    label: "未知",
    description: "无法确定分类来源",
  },
};

// ============================================================================
// GET - 获取分类决策理由
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookmarkId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "未登录" } },
        { status: 401 }
      );
    }

    const { bookmarkId } = await params;
    const id = parseInt(bookmarkId, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { message: "无效的书签 ID" } },
        { status: 400 }
      );
    }

    // 获取书签信息（使用存在的字段）
    const { data: bookmark, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        folder_id,
        classification_result,
        classification_status,
        cluster_confidence,
        pending_cluster,
        created_at,
        updated_at,
        folders:folder_id (
          id,
          name,
          is_system
        )
      `
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (bookmarkError || !bookmark) {
      return NextResponse.json(
        { success: false, error: { message: "书签不存在" } },
        { status: 404 }
      );
    }

    // 获取分类历史（最近的建议记录）
    const { data: recentSuggestion } = await supabase
      .from("classification_suggestions")
      .select("confidence, suggested_folder_name, reason, status, created_at")
      .eq("bookmark_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // 解析分类结果 JSON
    const classificationResult = (bookmark.classification_result as ClassificationResult) || {};

    // 确定分类状态
    type StatusType = "classified" | "inbox" | "uncategorized" | "pending";
    let classificationStatus: StatusType;
    const dbStatus = bookmark.classification_status;

    if (dbStatus === "classified" || dbStatus === "inbox" || dbStatus === "pending") {
      classificationStatus = dbStatus as StatusType;
    } else if (bookmark.folder_id) {
      const folder = bookmark.folders as { is_system?: boolean } | null;
      classificationStatus = folder?.is_system ? "inbox" : "classified";
    } else if (bookmark.pending_cluster) {
      classificationStatus = "pending";
    } else {
      classificationStatus = "uncategorized";
    }

    // 确定匹配来源
    const matchSourceType =
      classificationResult.matchSource ||
      (bookmark.cluster_confidence ? "cluster" : "unknown");
    const matchSourceInfo = MATCH_SOURCE_INFO[matchSourceType] || MATCH_SOURCE_INFO.unknown;

    // 确定置信度
    const confidence =
      classificationResult.confidence ||
      bookmark.cluster_confidence ||
      recentSuggestion?.confidence ||
      null;

    // 生成分类理由
    let reason: string;
    if (classificationStatus === "classified") {
      const folderData = bookmark.folders as { name?: string } | null;
      const confDisplay = confidence ? `（置信度 ${confidence}%）` : "";
      reason =
        classificationResult.reason ||
        `基于${matchSourceInfo.label}，将此内容分类到「${folderData?.name || "未知"}」文件夹${confDisplay}`;
    } else if (classificationStatus === "inbox") {
      reason = "此内容暂时放在待整理区，等待 AI 收集更多信息后进行分类";
    } else if (classificationStatus === "pending") {
      reason = "此内容正在等待聚类分析完成后进行批量分类";
    } else {
      reason = "此内容尚未分类，可能是新添加的或 AI 无法确定合适的分类";
    }

    // 构建决策详情
    const decisionDetails = {
      isAutoClassified: classificationStatus === "classified" && matchSourceType !== "manual",
      wasManuallyAdjusted: matchSourceType === "manual",
      classifiedAt: recentSuggestion?.created_at || null,
      lastAdjustedAt: bookmark.updated_at,
    };

    // 构建相关因素
    const factors: ClassificationReason["factors"] = [];

    // 置信度因素
    if (confidence !== null && confidence !== undefined) {
      factors.push({
        name: "置信度",
        value: `${confidence}%`,
        impact: confidence >= 80 ? "positive" : confidence >= 50 ? "neutral" : "negative",
        description:
          confidence >= 80
            ? "AI 对此分类非常有信心"
            : confidence >= 50
            ? "AI 对此分类有一定信心"
            : "AI 对此分类信心较低，可能需要人工确认",
      });
    }

    // 匹配来源因素
    factors.push({
      name: "匹配方式",
      value: matchSourceInfo.label,
      impact: "neutral",
      description: matchSourceInfo.description,
    });

    // 分类状态因素
    factors.push({
      name: "当前状态",
      value:
        classificationStatus === "classified"
          ? "已分类"
          : classificationStatus === "inbox"
          ? "待整理"
          : classificationStatus === "pending"
          ? "等待处理"
          : "未分类",
      impact: classificationStatus === "classified" ? "positive" : "neutral",
      description:
        classificationStatus === "classified"
          ? "内容已被分类到合适的文件夹"
          : classificationStatus === "inbox"
          ? "内容在待整理区等待进一步处理"
          : classificationStatus === "pending"
          ? "内容正在等待 AI 处理"
          : "内容尚未进行分类",
    });

    // 获取备选建议
    const alternatives: ClassificationReason["alternatives"] = [];
    if (classificationResult.alternatives) {
      for (const alt of classificationResult.alternatives.slice(0, 3)) {
        alternatives.push({
          folderId: alt.folderId,
          folderName: alt.folderName,
          confidence: alt.confidence,
          reason: alt.reason || "基于内容相似度推荐",
        });
      }
    }

    // 构建响应
    const folderData = bookmark.folders as { id?: number; name?: string; is_system?: boolean } | null;
    const response: ClassificationReason = {
      bookmarkId: bookmark.id,
      title: bookmark.title,
      currentFolder: folderData
        ? {
            id: folderData.id || null,
            name: folderData.name || "未知",
            isSystem: folderData.is_system || false,
          }
        : null,
      classificationStatus,
      confidence,
      reason,
      matchSource: {
        type: matchSourceType as ClassificationReason["matchSource"]["type"],
        label: matchSourceInfo.label,
        description: matchSourceInfo.description,
      },
      decisionDetails,
      alternatives,
      factors,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Failed to get classification reason:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : "获取分类理由失败",
        },
      },
      { status: 500 }
    );
  }
}
