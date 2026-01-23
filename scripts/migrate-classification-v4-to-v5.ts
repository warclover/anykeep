/**
 * 智能分类 v4 → v5 迁移脚本
 *
 * 功能：
 * 1. 迁移文件夹画像到新表结构
 * 2. 重新计算 α 系数（内容/行为权重）
 * 3. 更新向量嵌入为双源格式
 * 4. 数据验证和错误恢复
 */

import { createClient } from "@supabase/supabase-js";
import { EmbeddingService } from "@/lib/classification/v5/shared/embedding";
import { LoggerService } from "@/lib/classification/v5/shared/logger";

// 配置
const BATCH_SIZE = 50; // 每批处理的文件夹数量
const RETRY_ATTEMPTS = 3; // 重试次数
const RETRY_DELAY_MS = 1000; // 重试延迟（毫秒）

interface MigrationStats {
  totalFolders: number;
  migratedFolders: number;
  failedFolders: number;
  skippedFolders: number;
  errors: Array<{
    folderId: number;
    userId: string;
    error: string;
  }>;
}

interface V4FolderProfile {
  user_id: string;
  folder_id: string;
  embedding: number[];
  bookmark_count: number;
  last_updated: string;
}

interface V5FolderProfile {
  user_id: string;
  folder_id: string;
  content_embedding: number[];
  behavior_embedding: number[];
  alpha_coefficient: number;
  bookmark_count: number;
  avg_classification_confidence: number;
  needs_update: boolean;
  last_updated: string;
}

export class ClassificationMigrator {
  private supabase: ReturnType<typeof createClient>;
  private embeddingService: EmbeddingService;
  private logger: LoggerService;
  private stats: MigrationStats;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    embeddingService: EmbeddingService,
    logger: LoggerService,
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.embeddingService = embeddingService;
    this.logger = logger.child({ service: "ClassificationMigrator" });
    this.stats = {
      totalFolders: 0,
      migratedFolders: 0,
      failedFolders: 0,
      skippedFolders: 0,
      errors: [],
    };
  }

  /**
   * 执行完整迁移流程
   */
  async migrate(): Promise<MigrationStats> {
    this.logger.info("开始迁移 v4 → v5");

    try {
      // 1. 获取所有 v4 文件夹画像
      const v4Profiles = await this.fetchV4Profiles();
      this.stats.totalFolders = v4Profiles.length;
      this.logger.info(`找到 ${v4Profiles.length} 个 v4 文件夹画像`);

      // 2. 批量迁移
      await this.migrateBatches(v4Profiles);

      // 3. 验证迁移结果
      await this.validateMigration();

      this.logger.info("迁移完成", this.stats);
      return this.stats;
    } catch (error) {
      this.logger.error("迁移失败", { error });
      throw error;
    }
  }

  /**
   * 获取所有 v4 文件夹画像
   */
  private async fetchV4Profiles(): Promise<V4FolderProfile[]> {
    const { data, error } = await this.supabase
      .from("classification_folder_profiles")
      .select("user_id, folder_id, embedding, bookmark_count, last_updated")
      .order("user_id", { ascending: true });

    if (error) {
      throw new Error(`获取 v4 画像失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 批量迁移文件夹画像
   */
  private async migrateBatches(profiles: V4FolderProfile[]): Promise<void> {
    const batches = this.chunkArray(profiles, BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.logger.info(`处理批次 ${i + 1}/${batches.length}`, {
        batchSize: batch.length,
      });

      await Promise.all(batch.map((profile) => this.migrateProfile(profile)));

      // 批次间延迟，避免过载
      if (i < batches.length - 1) {
        await this.sleep(500);
      }
    }
  }

  /**
   * 迁移单个文件夹画像
   */
  private async migrateProfile(v4Profile: V4FolderProfile): Promise<void> {
    const { user_id, folder_id } = v4Profile;

    try {
      // 1. 检查是否已迁移
      const existing = await this.checkV5ProfileExists(user_id, folder_id);
      if (existing) {
        this.logger.debug("文件夹已迁移，跳过", { user_id, folder_id });
        this.stats.skippedFolders++;
        return;
      }

      // 2. 获取文件夹书签数据
      const bookmarks = await this.fetchFolderBookmarks(user_id, folder_id);
      if (bookmarks.length === 0) {
        this.logger.warn("文件夹无书签，跳过", { user_id, folder_id });
        this.stats.skippedFolders++;
        return;
      }

      // 3. 生成双源向量
      const { contentEmbedding, behaviorEmbedding } =
        await this.generateDualEmbeddings(bookmarks);

      // 4. 计算 α 系数
      const alphaCoefficient = this.calculateAlphaCoefficient(bookmarks);

      // 5. 创建 v5 画像
      const v5Profile: V5FolderProfile = {
        user_id,
        folder_id,
        content_embedding: contentEmbedding,
        behavior_embedding: behaviorEmbedding,
        alpha_coefficient: alphaCoefficient,
        bookmark_count: bookmarks.length,
        avg_classification_confidence: 0.8, // 默认值
        needs_update: false,
        last_updated: new Date().toISOString(),
      };

      // 6. 插入 v5 表
      await this.insertV5Profile(v5Profile);

      this.stats.migratedFolders++;
      this.logger.debug("文件夹迁移成功", { user_id, folder_id });
    } catch (error) {
      this.stats.failedFolders++;
      this.stats.errors.push({
        folderId: folder_id,
        userId: user_id,
        error: error instanceof Error ? error.message : String(error),
      });
      this.logger.error("文件夹迁移失败", {
        user_id,
        folder_id,
        error,
      });
    }
  }

  /**
   * 检查 v5 画像是否已存在
   */
  private async checkV5ProfileExists(
    userId: string,
    folderId: number,
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("classification_folder_profiles_v5")
      .select("folder_id")
      .eq("user_id", userId)
      .eq("folder_id", folderId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      throw error;
    }

    return !!data;
  }

  /**
   * 获取文件夹内的书签
   */
  private async fetchFolderBookmarks(
    userId: string,
    folderId: number,
  ): Promise<
    Array<{
      id: string;
      title: string;
      description: string | null;
      summary: string | null;
      tags: string[];
      created_at: string;
    }>
  > {
    const { data, error } = await this.supabase
      .from("bookmarks")
      .select("id, title, description, summary, tags, created_at")
      .eq("user_id", userId)
      .eq("folder_id", folderId)
      .limit(100); // 最多取 100 条用于生成画像

    if (error) {
      throw new Error(`获取书签失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 生成双源向量（内容 + 行为）
   */
  private async generateDualEmbeddings(
    bookmarks: Array<{
      title: string;
      description: string | null;
      summary: string | null;
      tags: string[];
      created_at: string;
    }>,
  ): Promise<{
    contentEmbedding: number[];
    behaviorEmbedding: number[];
  }> {
    // 内容向量：基于标题、描述、摘要、标签
    const contentTexts = bookmarks.map((b) => {
      const parts = [
        b.title,
        b.description || "",
        b.summary || "",
        b.tags.join(" "),
      ];
      return parts.filter(Boolean).join(" ");
    });
    const contentText = contentTexts.join(" ");
    const contentEmbedding =
      await this.embeddingService.generateEmbedding(contentText);

    // 行为向量：基于时间分布、标签频率
    const behaviorText = this.generateBehaviorText(bookmarks);
    const behaviorEmbedding =
      await this.embeddingService.generateEmbedding(behaviorText);

    return { contentEmbedding, behaviorEmbedding };
  }

  /**
   * 生成行为特征文本
   */
  private generateBehaviorText(
    bookmarks: Array<{
      tags: string[];
      created_at: string;
    }>,
  ): string {
    // 标签频率
    const tagFreq = new Map<string, number>();
    bookmarks.forEach((b) => {
      b.tags.forEach((tag) => {
        tagFreq.set(tag, (tagFreq.get(tag) || 0) + 1);
      });
    });

    const topTags = Array.from(tagFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    // 时间分布（按小时统计）
    const hourFreq = new Map<number, number>();
    bookmarks.forEach((b) => {
      const hour = new Date(b.created_at).getHours();
      hourFreq.set(hour, (hourFreq.get(hour) || 0) + 1);
    });

    const peakHours = Array.from(hourFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => `${hour}时`);

    return `常用标签: ${topTags.join(", ")}. 活跃时段: ${peakHours.join(", ")}.`;
  }

  /**
   * 计算 α 系数（内容权重）
   */
  private calculateAlphaCoefficient(
    bookmarks: Array<{
      tags: string[];
    }>,
  ): number {
    // 基于标签多样性计算 α
    const uniqueTags = new Set<string>();
    bookmarks.forEach((b) => {
      b.tags.forEach((tag) => uniqueTags.add(tag));
    });

    const tagDiversity = uniqueTags.size / Math.max(bookmarks.length, 1);

    // α ∈ [0.2, 0.8]
    // 标签多样性高 → α 高（更依赖内容）
    // 标签多样性低 → α 低（更依赖行为）
    const alpha = 0.2 + tagDiversity * 0.6;
    return Math.min(0.8, Math.max(0.2, alpha));
  }

  /**
   * 插入 v5 画像（带重试）
   */
  private async insertV5Profile(profile: V5FolderProfile): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const { error } = await this.supabase
          .from("classification_folder_profiles_v5")
          .insert(profile);

        if (error) {
          throw new Error(`插入失败: ${error.message}`);
        }

        return; // 成功
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`插入失败，重试 ${attempt}/${RETRY_ATTEMPTS}`, {
          error: lastError.message,
        });

        if (attempt < RETRY_ATTEMPTS) {
          await this.sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * 验证迁移结果
   */
  private async validateMigration(): Promise<void> {
    this.logger.info("验证迁移结果...");

    // 检查 v5 表记录数
    const { count: v5Count, error: v5Error } = await this.supabase
      .from("classification_folder_profiles_v5")
      .select("*", { count: "exact", head: true });

    if (v5Error) {
      throw new Error(`验证失败: ${v5Error.message}`);
    }

    this.logger.info("验证完成", {
      v5ProfileCount: v5Count,
      expectedCount: this.stats.migratedFolders,
    });

    if (v5Count !== this.stats.migratedFolders) {
      this.logger.warn("记录数不匹配", {
        v5Count,
        migratedCount: this.stats.migratedFolders,
      });
    }
  }

  /**
   * 工具方法：数组分块
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 工具方法：延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * CLI 入口
 */
async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("缺少 Supabase 环境变量");
  }

  // 初始化服务
  const embeddingService = new EmbeddingService(
    /* logger */ console as any,
    /* config */ {},
  );
  const logger = console as any;

  // 执行迁移
  const migrator = new ClassificationMigrator(
    supabaseUrl,
    supabaseKey,
    embeddingService,
    logger,
  );

  const stats = await migrator.migrate();

  // 输出结果
  console.log("\n=== 迁移完成 ===");
  console.log(`总文件夹数: ${stats.totalFolders}`);
  console.log(`成功迁移: ${stats.migratedFolders}`);
  console.log(`跳过: ${stats.skippedFolders}`);
  console.log(`失败: ${stats.failedFolders}`);

  if (stats.errors.length > 0) {
    console.log("\n失败详情:");
    stats.errors.forEach((err) => {
      console.log(`- ${err.userId}/${err.folderId}: ${err.error}`);
    });
  }

  process.exit(stats.failedFolders > 0 ? 1 : 0);
}

// 运行
if (require.main === module) {
  main().catch((error) => {
    console.error("迁移脚本执行失败:", error);
    process.exit(1);
  });
}
