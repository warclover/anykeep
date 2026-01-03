/**
 * Classification Consumer
 *
 * 自动分类消费者 - 为书签生成智能分类建议
 *
 * @module jobs/consumers
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { BaseConsumer } from "./base-consumer";
import type { JobContext, JobResult, AutoClassifyPayload } from "../types";

// 本地类型定义
interface BookmarkClassifyRow {
  id: number;
  title: string | null;
  description: string | null;
  ai_summary: string | null;
  url: string;
  platform: string | null;
  user_tags: string[] | null;
  ai_tags: string[] | null;
}

interface FolderRow {
  id: number;
  name: string;
}

interface RecentClassificationRow {
  folder_id: number | null;
  user_tags: string[] | null;
  platform: string | null;
}

/**
 * 自动分类消费者
 *
 * 职责：
 * - 调用 AI 分类服务分析书签内容
 * - 生成文件夹推荐、标签建议
 * - 可选自动应用分类结果
 */
export class ClassificationConsumer extends BaseConsumer {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, {
      name: "ClassificationConsumer",
      jobTypes: ["AUTO_CLASSIFY"],
      pollIntervalMs: 5000,
      batchSize: 3,
      concurrency: 2,
    });
  }

  protected async execute(context: JobContext): Promise<JobResult> {
    const payload = context.payload as unknown as AutoClassifyPayload;
    const { bookmarkId, autoApply = false } = payload;

    if (!bookmarkId) {
      return {
        success: false,
        error: "Missing bookmarkId in payload",
      };
    }

    try {
      // 获取书签和用户文件夹
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [bookmarkResult, foldersResult] = await Promise.all([
        (context.supabase.from("bookmarks") as any)
          .select(
            "id, title, description, ai_summary, url, platform, user_tags, ai_tags",
          )
          .eq("id", bookmarkId)
          .single() as Promise<{
          data: BookmarkClassifyRow | null;
          error: Error | null;
        }>,
        (context.supabase.from("folders") as any)
          .select("id, name")
          .eq("user_id", context.userId)
          .is("deleted_at", null)
          .order("name") as Promise<{
          data: FolderRow[] | null;
          error: Error | null;
        }>,
      ]);

      if (bookmarkResult.error || !bookmarkResult.data) {
        return {
          success: false,
          error: `Bookmark ${bookmarkId} not found`,
        };
      }

      const bookmark = bookmarkResult.data;
      const folders = foldersResult.data || [];

      // 调用分类服务
      const classification = await this.classifyBookmark(
        bookmark,
        folders,
        context.userId,
        context.supabase,
      );

      // 生成批次 ID
      const batchId = `auto-classify-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // 保存分类建议（使用 insert 而非 upsert）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: suggestionError } = await (
        context.supabase.from("classification_suggestions") as any
      ).insert({
        batch_id: batchId,
        bookmark_id: bookmarkId,
        user_id: context.userId,
        suggested_folder_id: classification.suggestedFolderId,
        suggested_folder_name: classification.suggestedFolderName || "未分类",
        confidence: classification.confidence,
        reason: classification.reasoning,
        status: autoApply ? "applied" : "pending",
        created_at: new Date().toISOString(),
      });

      if (suggestionError) {
        this.logger.warn(
          { suggestionError },
          "Failed to save classification suggestion",
        );
      }

      // 自动应用分类
      if (autoApply && classification.confidence >= 0.7) {
        await this.applyClassification(
          bookmarkId,
          classification,
          context.supabase,
        );
      }

      // 更新书签状态
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (
        context.supabase.from("bookmarks") as any
      )
        .update({
          status: "COMPLETED",
          ai_tags: classification.suggestedTags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookmarkId);

      if (updateError) {
        this.logger.warn({ updateError }, "Failed to update bookmark status");
      }

      this.logger.info(
        {
          bookmarkId,
          suggestedFolder: classification.suggestedFolderName,
          tagCount: classification.suggestedTags.length,
          confidence: classification.confidence,
          autoApplied: autoApply && classification.confidence >= 0.7,
        },
        "Classification completed",
      );

      return {
        success: true,
        data: {
          suggestedFolder: classification.suggestedFolderName,
          suggestedTags: classification.suggestedTags,
          confidence: classification.confidence,
          autoApplied: autoApply && classification.confidence >= 0.7,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * 分类书签
   */
  private async classifyBookmark(
    bookmark: {
      id: number;
      title: string | null;
      description: string | null;
      ai_summary: string | null;
      url: string;
      platform: string | null;
      user_tags: string[] | null;
      ai_tags: string[] | null;
    },
    folders: Array<{ id: number; name: string }>,
    userId: string,
    supabase: SupabaseClient<Database>,
  ): Promise<ClassificationResult> {
    // 构建分类上下文
    const content = [bookmark.title, bookmark.description, bookmark.ai_summary]
      .filter(Boolean)
      .join("\n");

    // 获取用户历史分类偏好
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentClassifications } = (await (supabase.from("bookmarks") as any)
      .select("folder_id, user_tags, platform")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("folder_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50)) as { data: RecentClassificationRow[] | null };

    // 简单的基于规则的分类（可替换为 AI 调用）
    const result = this.ruleBasedClassification(
      bookmark,
      content,
      folders,
      recentClassifications || [],
    );

    return result;
  }

  /**
   * 基于规则的分类（简化版，可替换为 AI）
   */
  private ruleBasedClassification(
    bookmark: {
      url: string;
      platform: string | null;
      user_tags: string[] | null;
    },
    content: string,
    folders: Array<{ id: number; name: string }>,
    recentClassifications: Array<{
      folder_id: number | null;
      user_tags: string[] | null;
      platform: string | null;
    }>,
  ): ClassificationResult {
    const lowerContent = content.toLowerCase();
    const suggestedTags: string[] = [];
    let suggestedFolderId: number | undefined;
    let suggestedFolderName: string | undefined;
    let confidence = 0.5;
    let reasoning = "基于内容关键词匹配";

    // 标签推荐规则
    const tagRules: Array<{ keywords: string[]; tag: string }> = [
      {
        keywords: ["javascript", "typescript", "react", "vue", "node"],
        tag: "前端开发",
      },
      {
        keywords: ["python", "django", "flask", "机器学习", "ai"],
        tag: "Python",
      },
      { keywords: ["java", "spring", "kotlin"], tag: "Java" },
      { keywords: ["设计", "ui", "ux", "figma", "sketch"], tag: "设计" },
      { keywords: ["产品", "需求", "用户", "运营"], tag: "产品" },
      { keywords: ["数据", "分析", "sql", "tableau"], tag: "数据分析" },
      { keywords: ["区块链", "web3", "crypto", "nft"], tag: "Web3" },
      { keywords: ["投资", "理财", "股票", "基金"], tag: "投资理财" },
      { keywords: ["健身", "运动", "跑步", "瑜伽"], tag: "健康" },
      { keywords: ["阅读", "书籍", "读书笔记"], tag: "阅读" },
    ];

    for (const rule of tagRules) {
      if (rule.keywords.some((kw) => lowerContent.includes(kw))) {
        suggestedTags.push(rule.tag);
      }
    }

    // 基于平台推荐
    if (bookmark.platform) {
      const platformTags: Record<string, string> = {
        github: "开源项目",
        juejin: "技术博客",
        zhihu: "知识问答",
        bilibili: "视频内容",
        xiaohongshu: "生活分享",
        wechat: "公众号",
      };
      if (platformTags[bookmark.platform]) {
        suggestedTags.push(platformTags[bookmark.platform]);
      }
    }

    // 文件夹匹配
    for (const folder of folders) {
      const folderKeywords = folder.name.toLowerCase().split(/[\s\/\-_]+/);
      const matchCount = folderKeywords.filter(
        (kw) =>
          lowerContent.includes(kw) ||
          suggestedTags.some((t) => t.toLowerCase().includes(kw)),
      ).length;

      if (matchCount > 0) {
        suggestedFolderId = folder.id;
        suggestedFolderName = folder.name;
        confidence = Math.min(0.9, 0.5 + matchCount * 0.15);
        reasoning = `内容与文件夹"${folder.name}"的关键词匹配度高`;
        break;
      }
    }

    // 基于历史偏好调整
    if (!suggestedFolderId && recentClassifications.length > 0) {
      const platformFolder = recentClassifications.find(
        (c) => c.platform === bookmark.platform && c.folder_id,
      );
      if (platformFolder && platformFolder.folder_id) {
        const folder = folders.find((f) => f.id === platformFolder.folder_id);
        if (folder) {
          suggestedFolderId = folder.id;
          suggestedFolderName = folder.name;
          confidence = 0.6;
          reasoning = `基于相同平台(${bookmark.platform})的历史分类偏好`;
        }
      }
    }

    // 去重标签
    const uniqueTags = [...new Set(suggestedTags)].slice(0, 5);

    return {
      suggestedFolderId,
      suggestedFolderName,
      suggestedTags: uniqueTags,
      confidence,
      reasoning,
    };
  }

  /**
   * 应用分类结果
   */
  private async applyClassification(
    bookmarkId: number,
    classification: ClassificationResult,
    supabase: SupabaseClient<Database>,
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (classification.suggestedFolderId) {
      updates.folder_id = classification.suggestedFolderId;
    }

    if (classification.suggestedTags.length > 0) {
      updates.ai_tags = classification.suggestedTags;
    }

    if (Object.keys(updates).length > 1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("bookmarks") as any).update(updates).eq("id", bookmarkId);
    }
  }
}

/**
 * 分类结果
 */
interface ClassificationResult {
  suggestedFolderId?: number;
  suggestedFolderName?: string;
  suggestedTags: string[];
  confidence: number;
  reasoning: string;
}
