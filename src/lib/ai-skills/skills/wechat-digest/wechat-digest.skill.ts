/**
 * WechatDigestSkill - 微信阅读摘要 Skill
 *
 * 功能：
 * - 分析用户收藏的微信公众号文章
 * - 按公众号/话题/日期分组
 * - 生成摘要报告
 *
 * 执行流程：
 * 1. 获取微信文章数据
 * 2. 提取主题标签
 * 3. 按条件分组
 * 4. 生成各组摘要
 * 5. 编译最终报告
 *
 * @version 1.0.0
 * @since 2025-12-27
 */

import { OrchestrationSkill } from "../../orchestration/orchestration-skill";
import type { OrchestrationContext } from "../../orchestration/types";
import type { OrchestrationStreamChunk } from "../../output/types";
import type { SkillContext } from "../../core/types";
import type { OrchestrationSkillMetadata } from "../../orchestration/types";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { generateText } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type {
  WechatDigestInput,
  WechatDigestOutput,
  WechatArticleData,
  ArticleGroup,
  GroupSummary,
  DigestInsights,
  WechatDigestContext,
} from "./types";
import {
  WechatDigestInputSchema,
  WechatDigestOutputSchema,
  WECHAT_DIGEST_STEPS,
} from "./types";

// ============================================
// WechatDigestSkill 实现
// ============================================

export class WechatDigestSkill extends OrchestrationSkill<
  WechatDigestInput,
  WechatDigestOutput
> {
  readonly metadata: OrchestrationSkillMetadata = {
    id: "wechat_digest",
    name: "微信阅读摘要",
    description:
      "分析微信公众号收藏，按公众号或话题生成摘要报告，帮助您回顾和整理阅读内容。",
    category: "understanding",
    version: "1.0.0",
    author: "AnyKeep",
    capabilities: [
      "wechat-analysis",
      "content-digest",
      "topic-grouping",
      "reading-insights",
    ],
    requiresConfirmation: false,
    estimatedDurationMs: 30000,
    maxExecutionTimeMs: 120000,
    deliverableTypes: ["report"],
    outputFormats: ["markdown", "json"],
    steps: WECHAT_DIGEST_STEPS,
  };

  readonly inputSchema = WechatDigestInputSchema;
  readonly outputSchema = WechatDigestOutputSchema;

  /**
   * 解析自然语言输入
   */
  async parseInput(
    message: string,
    _context: OrchestrationContext,
  ): Promise<WechatDigestInput> {
    // 解析分组方式
    let groupBy: "account" | "topic" | "date" = "account";
    if (/按(话题|主题|标签)/.test(message)) {
      groupBy = "topic";
    } else if (/按(日期|时间|天)/.test(message)) {
      groupBy = "date";
    }

    // 解析时间范围
    let dateRange: { start?: string; end?: string } | undefined;
    const weekMatch = message.match(/最近(\d+)?周/);
    const monthMatch = message.match(/最近(\d+)?个?月/);
    const dayMatch = message.match(/最近(\d+)?天/);

    if (weekMatch) {
      const weeks = parseInt(weekMatch[1] || "1", 10);
      const start = new Date();
      start.setDate(start.getDate() - weeks * 7);
      dateRange = { start: start.toISOString() };
    } else if (monthMatch) {
      const months = parseInt(monthMatch[1] || "1", 10);
      const start = new Date();
      start.setMonth(start.getMonth() - months);
      dateRange = { start: start.toISOString() };
    } else if (dayMatch) {
      const days = parseInt(dayMatch[1] || "7", 10);
      const start = new Date();
      start.setDate(start.getDate() - days);
      dateRange = { start: start.toISOString() };
    }

    // 解析公众号筛选
    let filter: WechatDigestInput["filter"];
    const accountMatch = message.match(/「(.+?)」|"(.+?)"|【(.+?)】/);
    if (accountMatch) {
      filter = {
        accountName: accountMatch[1] || accountMatch[2] || accountMatch[3],
      };
    }

    // 解析摘要深度
    let depth: "brief" | "standard" | "detailed" = "standard";
    if (/简单|简要|快速/.test(message)) {
      depth = "brief";
    } else if (/详细|深入|完整/.test(message)) {
      depth = "detailed";
    }

    return {
      groupBy,
      dateRange,
      filter,
      depth,
      maxArticles: 50,
    };
  }

  /**
   * 流式执行
   */
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationStreamChunk> {
    const startTime = Date.now();
    const input = context.params as WechatDigestInput;

    // 初始化进度
    this.initProgress(WECHAT_DIGEST_STEPS);

    // 初始化 Skill 上下文
    const skillContext: WechatDigestContext = {
      input,
      userId: context.userId,
      articles: [],
      topics: [],
      groups: [],
      summaries: [],
    };

    try {
      // ========== 步骤 1: 分析收藏集合 ==========
      yield* this.emitText("📚 正在分析您的微信收藏...\n\n");
      yield* this.reportProgress("分析收藏集合", 0, "获取文章列表");

      // 检查取消
      if (this.isCancelled(context)) {
        yield* this.emitCancelled("用户取消了操作");
        return;
      }

      const articles = await this.fetchWechatArticles(context.userId, input);
      skillContext.articles = articles;
      skillContext.stats = {
        totalArticles: articles.length,
        totalAccounts: new Set(articles.map((a) => a.accountName)).size,
        totalWordCount: articles.reduce((sum, a) => sum + a.wordCount, 0),
      };

      yield* this.reportProgress(
        "分析收藏集合",
        100,
        `找到 ${articles.length} 篇文章`,
      );
      yield* this.emitText(
        `✅ 共找到 **${articles.length}** 篇微信文章，来自 **${skillContext.stats.totalAccounts}** 个公众号\n\n`,
      );

      if (articles.length === 0) {
        yield* this.emitText(
          "⚠️ 未找到符合条件的微信文章，请调整筛选条件后重试。\n",
        );
        yield* this.emitDone(false, "未找到微信文章");
        return;
      }

      // ========== 步骤 2: 提取主题 ==========
      yield* this.reportProgress("提取主题标签", 0, "分析文章主题");

      if (this.isCancelled(context)) {
        yield* this.emitCancelled("用户取消了操作");
        return;
      }

      const topics = this.extractTopics(articles);
      skillContext.topics = topics;

      yield* this.reportProgress(
        "提取主题标签",
        100,
        `提取了 ${topics.length} 个主题`,
      );
      yield* this.emitText(`🏷️ 主要话题: ${topics.slice(0, 5).join("、")}\n\n`);

      // ========== 步骤 3: 分组内容 ==========
      yield* this.reportProgress("分组整理内容", 0, "按条件分组");

      if (this.isCancelled(context)) {
        yield* this.emitCancelled("用户取消了操作");
        return;
      }

      const groups = this.groupArticles(articles, input.groupBy);
      skillContext.groups = groups;

      yield* this.reportProgress(
        "分组整理内容",
        100,
        `分为 ${groups.length} 组`,
      );

      // ========== 步骤 4: 生成摘要 ==========
      yield* this.emitText("📝 正在生成各组摘要...\n\n");
      yield* this.reportProgress("生成各组摘要", 0, "生成摘要中");

      if (this.isCancelled(context)) {
        yield* this.emitCancelled("用户取消了操作");
        return;
      }

      const summaries = await this.generateSummaries(
        groups,
        input.depth || "standard",
      );
      skillContext.summaries = summaries;

      // 生成洞察
      const insights = this.generateInsights(articles, groups);
      skillContext.insights = insights;

      yield* this.reportProgress("生成各组摘要", 100, "摘要生成完成");

      // ========== 步骤 5: 编译报告 ==========
      yield* this.reportProgress("编译摘要报告", 0, "编译最终报告");

      if (this.isCancelled(context)) {
        yield* this.emitCancelled("用户取消了操作");
        return;
      }

      const report = this.compileReport(skillContext);

      yield* this.reportProgress("编译摘要报告", 100, "报告编译完成");

      // 输出摘要文本
      yield* this.emitText("---\n\n");
      yield* this.emitText("## 📊 阅读摘要报告\n\n");
      yield* this.emitText(
        `在分析的 **${articles.length}** 篇文章中，共计约 **${Math.round(skillContext.stats!.totalWordCount / 1000)}k** 字。\n\n`,
      );

      // 输出各分组摘要
      for (const summary of summaries) {
        yield* this.emitText(`### 📌 ${summary.name}\n\n`);
        yield* this.emitText(
          `*${summary.articleCount} 篇文章，约 ${Math.round(summary.wordCount / 1000)}k 字*\n\n`,
        );
        yield* this.emitText(`${summary.summary}\n\n`);

        if (summary.keyPoints.length > 0) {
          yield* this.emitText("**要点：**\n");
          for (const point of summary.keyPoints.slice(0, 3)) {
            yield* this.emitText(`- ${point}\n`);
          }
          yield* this.emitText("\n");
        }
      }

      // 输出洞察
      if (insights.suggestions.length > 0) {
        yield* this.emitText("### 💡 阅读建议\n\n");
        for (const suggestion of insights.suggestions) {
          yield* this.emitText(`- ${suggestion}\n`);
        }
        yield* this.emitText("\n");
      }

      // ========== 输出交付物 ==========
      const deliverable = this.createDeliverable(
        "report",
        "微信阅读摘要报告",
        report,
        "markdown",
        {
          downloadable: true,
          shareable: true,
          metadata: {
            totalArticles: articles.length,
            totalAccounts: skillContext.stats!.totalAccounts,
            generatedAt: new Date().toISOString(),
          },
        },
      );

      yield* this.emitDeliverable(deliverable);

      // 输出建议
      if (insights.suggestions.length > 0) {
        yield* this.emitSuggestions(
          insights.suggestions.map((s) => ({
            text: s,
            action: "info",
          })),
        );
      }

      yield* this.emitDone(
        true,
        `已生成 ${articles.length} 篇微信文章的阅读摘要`,
      );

      logger.info(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          totalArticles: articles.length,
          totalGroups: groups.length,
          durationMs: Date.now() - startTime,
        },
        "WechatDigestSkill: Execution completed",
      );
    } catch (error) {
      logger.error(
        {
          skillId: this.metadata.id,
          userId: context.userId,
          error: error instanceof Error ? error.message : String(error),
        },
        "WechatDigestSkill: Execution failed",
      );

      yield* this.emitError(
        error instanceof Error ? error.message : "微信摘要生成失败",
        "EXECUTION_ERROR",
        true,
      );
      yield* this.emitDone(false, "微信摘要生成失败");
    }
  }

  /**
   * 获取微信文章数据
   */
  private async fetchWechatArticles(
    userId: string,
    input: WechatDigestInput,
  ): Promise<WechatArticleData[]> {
    const supabase = await createClient();

    let query = supabase
      .from("bookmarks")
      .select(
        `
        id,
        title,
        url,
        user_tags,
        created_at,
        bookmark_snapshots (
          id,
          readable_text_content,
          readable_word_count,
          readable_excerpt,
          readable_byline
        )
      `,
      )
      .eq("user_id", userId)
      .eq("platform", "WECHAT_OFFICIAL_ACCOUNT")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(input.maxArticles);

    // 时间筛选
    if (input.dateRange?.start) {
      query = query.gte("created_at", input.dateRange.start);
    }
    if (input.dateRange?.end) {
      query = query.lte("created_at", input.dateRange.end);
    }

    const { data, error } = await query;

    if (error) {
      logger.error(
        { error },
        "WechatDigestSkill: Failed to fetch wechat articles",
      );
      throw new Error(`获取微信文章失败: ${error.message}`);
    }

    // 转换数据
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let articles: WechatArticleData[] = (data || []).map((item: any) => {
      const snapshot = item.bookmark_snapshots?.[0];
      const accountInfo = this.extractAccountInfo(
        item.url,
        snapshot?.readable_byline,
      );

      return {
        bookmarkId: item.id,
        title: item.title,
        url: item.url,
        wordCount: snapshot?.readable_word_count || 0,
        excerpt: snapshot?.readable_excerpt || "",
        fullContent: snapshot?.readable_text_content || undefined,
        tags: item.user_tags || [],
        createdAt: item.created_at,
        accountName: accountInfo.name,
        accountId: accountInfo.id,
      };
    });

    // 公众号筛选
    if (input.filter?.accountName) {
      const filterName = input.filter.accountName.toLowerCase();
      articles = articles.filter(
        (a) =>
          a.accountName.toLowerCase().includes(filterName) ||
          a.title.toLowerCase().includes(filterName),
      );
    }

    // 标签筛选
    if (input.filter?.tags && input.filter.tags.length > 0) {
      const filterTags = input.filter.tags.map((t) => t.toLowerCase());
      articles = articles.filter((a) =>
        a.tags.some((t) => filterTags.includes(t.toLowerCase())),
      );
    }

    // 关键词搜索
    if (input.filter?.keyword) {
      const keyword = input.filter.keyword.toLowerCase();
      articles = articles.filter(
        (a) =>
          a.title.toLowerCase().includes(keyword) ||
          a.excerpt.toLowerCase().includes(keyword),
      );
    }

    return articles;
  }

  /**
   * 提取公众号信息
   */
  private extractAccountInfo(
    url: string,
    byline?: string | null,
  ): { name: string; id?: string } {
    try {
      const urlObj = new URL(url);
      const biz = urlObj.searchParams.get("__biz");
      let name = "未知公众号";

      if (byline) {
        name = byline.trim();
      }

      return { name, id: biz || undefined };
    } catch {
      return { name: "未知公众号" };
    }
  }

  /**
   * 提取主题
   */
  private extractTopics(articles: WechatArticleData[]): string[] {
    const topicCount = new Map<string, number>();

    // 收集所有标签
    for (const article of articles) {
      for (const tag of article.tags) {
        topicCount.set(tag, (topicCount.get(tag) || 0) + 1);
      }
    }

    // 按频率排序
    return Array.from(topicCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic);
  }

  /**
   * 分组文章
   */
  private groupArticles(
    articles: WechatArticleData[],
    groupBy: "account" | "topic" | "date",
  ): ArticleGroup[] {
    const groupMap = new Map<string, WechatArticleData[]>();

    for (const article of articles) {
      let key: string;

      switch (groupBy) {
        case "account":
          key = article.accountName;
          break;
        case "topic":
          key = article.tags[0] || "未分类";
          break;
        case "date":
          key = new Date(article.createdAt).toLocaleDateString("zh-CN");
          break;
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(article);
    }

    return Array.from(groupMap.entries())
      .map(([name, groupArticles]) => ({
        name,
        articles: groupArticles,
        wordCount: groupArticles.reduce((sum, a) => sum + a.wordCount, 0),
      }))
      .sort((a, b) => b.articles.length - a.articles.length);
  }

  /**
   * 生成分组摘要（使用 LLM）
   */
  private async generateSummaries(
    groups: ArticleGroup[],
    depth: "brief" | "standard" | "detailed",
  ): Promise<GroupSummary[]> {
    const summaries: GroupSummary[] = [];

    for (const group of groups) {
      // 构建文章信息用于 LLM
      const articlesInfo = group.articles
        .slice(0, 10) // 限制数量避免 token 过长
        .map(
          (a, i) => `${i + 1}. ${a.title}\n   ${a.excerpt.substring(0, 150)}`,
        )
        .join("\n\n");

      // 根据深度设置生成参数
      const depthConfig = {
        brief: { maxLength: 100, keyPointsCount: 2 },
        standard: { maxLength: 200, keyPointsCount: 3 },
        detailed: { maxLength: 400, keyPointsCount: 5 },
      }[depth];

      try {
        // 验证 API Key
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
          logger.warn(
            { group: group.name },
            "WechatDigestSkill: DEEPSEEK_API_KEY not configured, using fallback",
          );
          summaries.push(this.generateFallbackSummary(group, depth));
          continue;
        }

        // 创建 DeepSeek 模型实例
        const deepseek = createDeepSeek({ apiKey });

        // 调用 LLM 生成摘要
        const result = await generateText({
          model: deepseek("deepseek-chat"), // 使用 DeepSeek 控制成本
          system: `你是一个专业的内容摘要助手。请根据提供的文章列表生成简洁、有洞察的摘要。
要求：
1. 摘要应概括文章的共同主题和核心观点
2. 提取 ${depthConfig.keyPointsCount} 个关键要点
3. 使用中文，语言精炼专业
4. 摘要控制在 ${depthConfig.maxLength} 字以内`,
          prompt: `请为以下来自「${group.name}」的 ${group.articles.length} 篇文章（约 ${Math.round(group.wordCount / 1000)}k 字）生成摘要：

${articlesInfo}

请输出：
1. 一段概括性摘要
2. ${depthConfig.keyPointsCount} 个关键要点（每个要点一行，用 - 开头）`,
          temperature: 0.3,
          maxOutputTokens: 500,
        });

        // 解析 LLM 响应
        const { summary, keyPoints } = this.parseSummaryResponse(
          result.text,
          group,
          depth,
        );

        summaries.push({
          name: group.name,
          articleCount: group.articles.length,
          wordCount: group.wordCount,
          summary,
          keyPoints,
          articles: group.articles.slice(0, 5).map((a) => ({
            title: a.title,
            url: a.url,
            excerpt: a.excerpt.substring(0, 100),
          })),
        });
      } catch (error) {
        // LLM 调用失败时使用降级策略
        logger.warn(
          {
            group: group.name,
            error: error instanceof Error ? error.message : String(error),
          },
          "WechatDigestSkill: LLM summary generation failed, using fallback",
        );

        summaries.push(this.generateFallbackSummary(group, depth));
      }
    }

    return summaries;
  }

  /**
   * 解析 LLM 摘要响应
   */
  private parseSummaryResponse(
    response: string,
    group: ArticleGroup,
    depth: "brief" | "standard" | "detailed",
  ): { summary: string; keyPoints: string[] } {
    const lines = response.split("\n").filter((line) => line.trim());

    // 提取关键要点（以 - 或 * 开头的行）
    const keyPoints = lines
      .filter((line) => /^[-*•]\s*/.test(line.trim()))
      .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
      .slice(0, depth === "brief" ? 2 : depth === "standard" ? 3 : 5);

    // 摘要是非要点的部分
    const summaryLines = lines.filter((line) => !/^[-*•]\s*/.test(line.trim()));
    let summary = summaryLines.join(" ").trim();

    // 如果解析失败，使用整个响应作为摘要
    if (!summary) {
      summary = response.substring(0, 300);
    }

    // 如果没有提取到关键要点，使用文章标题
    const finalKeyPoints =
      keyPoints.length > 0
        ? keyPoints
        : group.articles.slice(0, 3).map((a) => a.title);

    return { summary, keyPoints: finalKeyPoints };
  }

  /**
   * 降级摘要生成（LLM 失败时使用）
   */
  private generateFallbackSummary(
    group: ArticleGroup,
    depth: "brief" | "standard" | "detailed",
  ): GroupSummary {
    const titles = group.articles.map((a) => a.title).join("；");
    const excerpts = group.articles
      .slice(0, 3)
      .map((a) => a.excerpt)
      .filter(Boolean)
      .join(" ");

    let summary: string;
    if (depth === "brief") {
      summary = `该分组包含 ${group.articles.length} 篇文章，主要涉及：${titles.substring(0, 100)}...`;
    } else if (depth === "detailed") {
      summary = `「${group.name}」分组共收录 ${group.articles.length} 篇文章，约 ${Math.round(group.wordCount / 1000)}k 字。主要内容包括：${titles.substring(0, 200)}... ${excerpts.substring(0, 200)}`;
    } else {
      summary = `该分组收录 ${group.articles.length} 篇文章，约 ${Math.round(group.wordCount / 1000)}k 字。${excerpts.substring(0, 150)}`;
    }

    return {
      name: group.name,
      articleCount: group.articles.length,
      wordCount: group.wordCount,
      summary,
      keyPoints: group.articles.slice(0, 3).map((a) => a.title),
      articles: group.articles.slice(0, 5).map((a) => ({
        title: a.title,
        url: a.url,
        excerpt: a.excerpt.substring(0, 100),
      })),
    };
  }

  /**
   * 生成洞察
   */
  private generateInsights(
    articles: WechatArticleData[],
    groups: ArticleGroup[],
  ): DigestInsights {
    const suggestions: string[] = [];

    // 阅读趋势分析
    const totalWordCount = articles.reduce((sum, a) => sum + a.wordCount, 0);
    const avgWordCount =
      articles.length > 0 ? totalWordCount / articles.length : 0;
    const readingTrends = `平均每篇文章 ${Math.round(avgWordCount / 1000)}k 字，${groups.length > 5 ? "阅读涉猎广泛" : "阅读相对集中"}`;

    // 建议
    if (groups.length > 10) {
      suggestions.push("您关注的公众号较多，可以考虑按主题整理，便于回顾");
    }

    if (articles.some((a) => a.wordCount === 0)) {
      suggestions.push("部分文章未抓取完整内容，建议重新获取以便阅读");
    }

    const topGroup = groups[0];
    if (topGroup && topGroup.articles.length > articles.length * 0.3) {
      suggestions.push(`「${topGroup.name}」占比较高，是您的主要阅读来源`);
    }

    suggestions.push("定期回顾收藏的文章，有助于知识的吸收和整理");

    // 推荐
    const topRecommendations = groups
      .slice(0, 3)
      .map((g) => `深入阅读「${g.name}」的文章`);

    return {
      readingTrends,
      topRecommendations,
      suggestions,
    };
  }

  /**
   * 编译报告
   */
  private compileReport(context: WechatDigestContext): string {
    const lines: string[] = [];
    const { stats, summaries, insights } = context;

    lines.push("# 📚 微信阅读摘要报告\n");
    lines.push(`> 生成时间：${new Date().toLocaleString("zh-CN")}\n`);
    lines.push("");

    // 概览
    lines.push("## 📊 概览\n");
    lines.push(`- 总文章数：**${stats?.totalArticles}** 篇`);
    lines.push(`- 公众号数：**${stats?.totalAccounts}** 个`);
    lines.push(
      `- 总字数：约 **${Math.round((stats?.totalWordCount || 0) / 1000)}k** 字`,
    );
    lines.push("");

    // 分组摘要
    lines.push("## 📝 分组摘要\n");
    for (const summary of summaries) {
      lines.push(`### ${summary.name}\n`);
      lines.push(
        `*${summary.articleCount} 篇文章，约 ${Math.round(summary.wordCount / 1000)}k 字*\n`,
      );
      lines.push(summary.summary);
      lines.push("");

      if (summary.keyPoints.length > 0) {
        lines.push("**要点：**");
        for (const point of summary.keyPoints) {
          lines.push(`- ${point}`);
        }
        lines.push("");
      }

      if (summary.articles.length > 0) {
        lines.push("**文章列表：**");
        for (const article of summary.articles) {
          lines.push(`- [${article.title}](${article.url})`);
        }
        lines.push("");
      }
    }

    // 洞察
    if (insights) {
      lines.push("## 💡 阅读洞察\n");
      lines.push(`**阅读趋势：** ${insights.readingTrends}\n`);

      if (insights.suggestions.length > 0) {
        lines.push("**建议：**");
        for (const suggestion of insights.suggestions) {
          lines.push(`- ${suggestion}`);
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * 非流式执行（兼容原子模式）
   */
  protected async executeInternal(
    input: WechatDigestInput,
    context: SkillContext,
  ): Promise<WechatDigestOutput> {
    const orchestrationContext: OrchestrationContext = {
      ...context,
      params: input,
    };

    let output: WechatDigestOutput | undefined;

    for await (const chunk of this.executeStream(orchestrationContext)) {
      if (chunk.type === "deliverable") {
        // 从交付物构建输出
        const content = chunk.data.content;
        if (typeof content === "string") {
          output = {
            report: content,
            data: {
              overview: {
                totalArticles: 0,
                totalAccounts: 0,
                totalWordCount: 0,
                dateRange: { start: "", end: "" },
                topTopics: [],
              },
              groups: [],
              insights: {
                readingTrends: "",
                topRecommendations: [],
                suggestions: [],
              },
            },
          };
        }
      }
    }

    if (!output) {
      throw new Error("微信摘要生成失败");
    }

    return output;
  }
}

// ============================================
// 导出
// ============================================

export const wechatDigestSkill = new WechatDigestSkill();
