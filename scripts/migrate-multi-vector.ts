/**
 * Multi-Vector Migration Script
 * V4.2 存量数据多向量迁移脚本
 *
 * @description
 * 将现有书签迁移到多向量版本：
 * 1. 为每个书签生成 title_embedding
 * 2. 为每个书签生成 tag_embedding
 * 3. 更新 embedding_version 为 2
 *
 * @usage
 * npx tsx scripts/migrate-multi-vector.ts [--user-id <userId>] [--batch-size <n>] [--dry-run]
 *
 * @version 1.0.0
 * @since 2025-12-11
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/supabase";

// ============================================================================
// 配置
// ============================================================================

interface MigrationConfig {
  /** 指定用户 ID（不指定则迁移所有用户） */
  userId?: string;
  /** 批处理大小 */
  batchSize: number;
  /** 每批之间的延迟（毫秒） */
  batchDelayMs: number;
  /** 是否只打印不执行 */
  dryRun: boolean;
  /** 是否显示详细日志 */
  verbose: boolean;
}

const DEFAULT_CONFIG: MigrationConfig = {
  batchSize: 10,
  batchDelayMs: 1000,
  dryRun: false,
  verbose: false,
};

// ============================================================================
// 辅助函数
// ============================================================================

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--user-id" && args[i + 1]) {
      config.userId = args[++i];
    } else if (arg === "--batch-size" && args[i + 1]) {
      config.batchSize = parseInt(args[++i], 10);
    } else if (arg === "--batch-delay" && args[i + 1]) {
      config.batchDelayMs = parseInt(args[++i], 10);
    } else if (arg === "--dry-run") {
      config.dryRun = true;
    } else if (arg === "--verbose" || arg === "-v") {
      config.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
Multi-Vector Migration Script
=============================

Usage:
  npx tsx scripts/migrate-multi-vector.ts [options]

Options:
  --user-id <id>      Migrate only the specified user
  --batch-size <n>    Number of bookmarks per batch (default: 10)
  --batch-delay <ms>  Delay between batches in ms (default: 1000)
  --dry-run           Print actions without executing
  --verbose, -v       Show detailed logs
  --help, -h          Show this help message

Examples:
  # Migrate all users
  npx tsx scripts/migrate-multi-vector.ts

  # Migrate specific user with dry run
  npx tsx scripts/migrate-multi-vector.ts --user-id abc123 --dry-run

  # Migrate with smaller batches and more delay
  npx tsx scripts/migrate-multi-vector.ts --batch-size 5 --batch-delay 2000
`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatProgress(current: number, total: number): string {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const bar = "=".repeat(Math.floor(percent / 2)) + " ".repeat(50 - Math.floor(percent / 2));
  return `[${bar}] ${percent}% (${current}/${total})`;
}

// ============================================================================
// Embedding 生成（简化版，避免依赖 Next.js 运行时）
// ============================================================================

async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.error("Error: DASHSCOPE_API_KEY environment variable not set");
    return null;
  }

  const baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
  const model = "text-embedding-v3";
  const dimensions = 1024;

  try {
    const truncatedText = text.substring(0, 8000); // 限制长度

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: truncatedText,
        dimensions,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Embedding API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    console.error("Embedding generation failed:", error);
    return null;
  }
}

// ============================================================================
// 迁移逻辑
// ============================================================================

interface MigrationResult {
  totalUsers: number;
  totalBookmarks: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  durationMs: number;
}

async function runMigration(config: MigrationConfig): Promise<MigrationResult> {
  const startTime = Date.now();

  // 创建 Supabase 客户端
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  const result: MigrationResult = {
    totalUsers: 0,
    totalBookmarks: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    durationMs: 0,
  };

  console.log("\n🚀 Starting Multi-Vector Migration");
  console.log("================================");
  console.log(`Batch size: ${config.batchSize}`);
  console.log(`Batch delay: ${config.batchDelayMs}ms`);
  console.log(`Dry run: ${config.dryRun}`);
  console.log(`User ID: ${config.userId || "all users"}`);
  console.log("");

  // 获取待迁移的用户列表
  let userQuery = supabase
    .from("bookmarks")
    .select("user_id")
    .is("deleted_at", null)
    .or("title_embedding.is.null,tag_embedding.is.null");

  if (config.userId) {
    userQuery = userQuery.eq("user_id", config.userId);
  }

  const { data: userRows, error: userError } = await userQuery;

  if (userError) {
    throw new Error(`Failed to get users: ${userError.message}`);
  }

  // 去重用户 ID
  const userIds = [...new Set(userRows?.map((r) => r.user_id) || [])];
  result.totalUsers = userIds.length;

  console.log(`📊 Found ${userIds.length} users with bookmarks to migrate\n`);

  // 逐用户迁移
  for (let userIdx = 0; userIdx < userIds.length; userIdx++) {
    const userId = userIds[userIdx];
    console.log(`\n👤 User ${userIdx + 1}/${userIds.length}: ${userId}`);

    // 获取该用户待迁移的书签
    // 使用 as any 绕过类型检查，因为新字段在迁移后才会存在于类型定义中
    const { data: bookmarks, error: bookmarkError } = await supabase
      .from("bookmarks")
      .select("id, title, ai_summary, ai_tags, user_tags, title_embedding, tag_embedding")
      .eq("user_id", userId)
      .is("deleted_at", null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .or("title_embedding.is.null,tag_embedding.is.null") as any;

    if (bookmarkError) {
      console.error(`  ❌ Failed to get bookmarks: ${bookmarkError.message}`);
      continue;
    }

    if (!bookmarks || bookmarks.length === 0) {
      console.log("  ✅ No bookmarks to migrate");
      continue;
    }

    const userTotal = bookmarks.length;
    result.totalBookmarks += userTotal;
    console.log(`  📚 Found ${userTotal} bookmarks to migrate`);

    // 分批处理
    for (let batchStart = 0; batchStart < bookmarks.length; batchStart += config.batchSize) {
      const batch = bookmarks.slice(batchStart, batchStart + config.batchSize);

      process.stdout.write(
        `\r  ${formatProgress(Math.min(batchStart + batch.length, userTotal), userTotal)}`
      );

      for (const bookmark of batch) {
        const needsTitle = !bookmark.title_embedding;
        const needsTag = !bookmark.tag_embedding;

        if (config.verbose) {
          console.log(`\n    Processing bookmark ${bookmark.id}: title=${needsTitle}, tag=${needsTag}`);
        }

        if (config.dryRun) {
          result.successCount++;
          continue;
        }

        try {
          const updateData: Record<string, unknown> = {};

          // 生成标题向量
          if (needsTitle && bookmark.title) {
            const titleEmbedding = await generateEmbedding(bookmark.title);
            if (titleEmbedding) {
              updateData.title_embedding = titleEmbedding;
              updateData.title_embedding_at = new Date().toISOString();
            }
          }

          // 生成标签向量
          if (needsTag) {
            const allTags = [
              ...(bookmark.ai_tags || []),
              ...(bookmark.user_tags || []),
            ];

            if (allTags.length > 0) {
              const uniqueTags = [...new Set(allTags)];
              const tagText = uniqueTags.join(" | ");
              const tagEmbedding = await generateEmbedding(tagText);
              if (tagEmbedding) {
                updateData.tag_embedding = tagEmbedding;
                updateData.tag_embedding_at = new Date().toISOString();
              }
            }
          }

          // 更新版本号
          if (Object.keys(updateData).length > 0) {
            updateData.embedding_version = 2;

            const { error: updateError } = await supabase
              .from("bookmarks")
              .update(updateData as never)
              .eq("id", bookmark.id);

            if (updateError) {
              console.error(`\n    ❌ Failed to update bookmark ${bookmark.id}: ${updateError.message}`);
              result.failedCount++;
            } else {
              result.successCount++;
            }
          } else {
            result.skippedCount++;
          }
        } catch (error) {
          console.error(`\n    ❌ Error processing bookmark ${bookmark.id}:`, error);
          result.failedCount++;
        }
      }

      // 批次间延迟
      if (batchStart + config.batchSize < bookmarks.length) {
        await sleep(config.batchDelayMs);
      }
    }

    console.log(""); // 换行
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

// ============================================================================
// 主函数
// ============================================================================

async function main(): Promise<void> {
  const config = parseArgs();

  try {
    const result = await runMigration(config);

    console.log("\n\n📈 Migration Summary");
    console.log("====================");
    console.log(`Total users:     ${result.totalUsers}`);
    console.log(`Total bookmarks: ${result.totalBookmarks}`);
    console.log(`Successful:      ${result.successCount}`);
    console.log(`Failed:          ${result.failedCount}`);
    console.log(`Skipped:         ${result.skippedCount}`);
    console.log(`Duration:        ${(result.durationMs / 1000).toFixed(1)}s`);

    if (config.dryRun) {
      console.log("\n⚠️  This was a dry run - no changes were made");
    }

    console.log("\n✅ Migration completed");
    process.exit(result.failedCount > 0 ? 1 : 0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  }
}

// 运行
main();
