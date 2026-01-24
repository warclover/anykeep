#!/usr/bin/env npx ts-node
/**
 * Embedding 批量重新生成脚本
 *
 * 用于解决 embedding 模型不一致问题：
 * - 旧书签使用旧模型生成的 embedding
 * - 新书签使用 text-embedding-v4 生成
 * - 不同模型的向量空间不兼容，导致相似度计算无意义
 *
 * 使用方法:
 *   npx ts-node scripts/regenerate-embeddings.ts [options]
 *
 * 选项:
 *   --dry-run        只统计，不实际执行
 *   --limit=N        每次处理 N 条（默认 50）
 *   --all            循环处理所有书签直到完成
 *   --version=N      只处理版本 < N 的书签（默认 3）
 *   --user=UUID      只处理指定用户的书签
 *
 * 示例:
 *   # 查看统计信息
 *   npx ts-node scripts/regenerate-embeddings.ts --dry-run
 *
 *   # 处理 50 条
 *   npx ts-node scripts/regenerate-embeddings.ts --limit=50
 *
 *   # 处理所有旧版本书签
 *   npx ts-node scripts/regenerate-embeddings.ts --all
 *
 * 环境变量要求:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - DEEPSEEK_API_KEY (用于生成 embedding)
 *
 * @version 2.0.0
 * @since 2026-01-24
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const dotenv = require("dotenv");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// 类型定义 - 使用 any 替代 SupabaseClient 以避免 ESM/CJS 问题
type SupabaseClient = ReturnType<typeof createClient>;

// ============================================================================
// 配置
// ============================================================================

const CURRENT_EMBEDDING_VERSION = 3;
const BATCH_SIZE = 3; // 并发处理数量 (DashScope QPS 限制)
const DELAY_BETWEEN_BATCHES = 500; // 批次间延迟 (ms)
const EMBEDDING_DIMENSION = 1024;

// 阿里云百炼 DashScope API 配置 (OpenAI 兼容模式)
const DASHSCOPE_API_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings";
const DASHSCOPE_MODEL = "text-embedding-v4";

// ============================================================================
// 类型定义
// ============================================================================

interface BookmarkForRegenerate {
  id: number;
  user_id: string;
  title: string | null;
  ai_summary: string | null;
  ai_tags: string[] | null;
  embedding_version: number | null;
}

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface ProcessResult {
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: number; error: string }>;
}

// ============================================================================
// 工具函数
// ============================================================================

function buildEmbeddingText(
  title: string,
  summary: string,
  tags: string[]
): string {
  const parts: string[] = [];

  if (title?.trim()) {
    parts.push(`标题: ${title.trim()}`);
  }

  if (summary?.trim()) {
    parts.push(`摘要: ${summary.trim()}`);
  }

  if (tags?.length > 0) {
    parts.push(`标签: ${tags.join(", ")}`);
  }

  return parts.join("\n");
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY 未设置");
  }

  try {
    const response = await fetch(DASHSCOPE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DASHSCOPE_MODEL,
        input: text,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DashScope API 错误: ${response.status} - ${errorText}`);
    }

    const data: EmbeddingResponse = await response.json();

    if (!data.data?.[0]?.embedding) {
      throw new Error("API 返回数据格式错误");
    }

    const embedding = data.data[0].embedding;

    if (embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `向量维度不匹配: 期望 ${EMBEDDING_DIMENSION}, 实际 ${embedding.length}`
      );
    }

    return embedding;
  } catch (error) {
    console.error("生成 embedding 失败:", error);
    return null;
  }
}

function formatVectorForPostgres(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

// ============================================================================
// 主要逻辑
// ============================================================================

async function getStats(
  supabase: SupabaseClient,
  targetVersion: number,
  userId?: string
): Promise<{
  total: number;
  needsRegenerate: number;
  versionDistribution: Record<string, number>;
}> {
  let query = supabase
    .from("bookmarks")
    .select("id, embedding_version")
    .is("deleted_at", null)
    .not("embedding", "is", null);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data: bookmarks, error } = await query;

  if (error) {
    throw new Error(`查询失败: ${error.message}`);
  }

  const versionDistribution: Record<string, number> = {};
  let needsRegenerate = 0;

  for (const bookmark of bookmarks || []) {
    const version = bookmark.embedding_version?.toString() || "null";
    versionDistribution[version] = (versionDistribution[version] || 0) + 1;

    if (
      bookmark.embedding_version === null ||
      bookmark.embedding_version < targetVersion
    ) {
      needsRegenerate++;
    }
  }

  return {
    total: bookmarks?.length || 0,
    needsRegenerate,
    versionDistribution,
  };
}

async function processBatch(
  supabase: SupabaseClient,
  bookmarks: BookmarkForRegenerate[]
): Promise<ProcessResult> {
  const result: ProcessResult = {
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const promises = bookmarks.map(async (bookmark) => {
    try {
      // 构建向量文本
      const text = buildEmbeddingText(
        bookmark.title ?? "",
        bookmark.ai_summary ?? "",
        bookmark.ai_tags ?? []
      );

      if (!text || text.trim().length < 5) {
        result.skipped++;
        result.processed++;
        return;
      }

      // 生成向量
      const embedding = await generateEmbedding(text);

      if (!embedding) {
        throw new Error("生成向量失败");
      }

      // 更新数据库 - 使用 RPC 调用来避免类型问题
      const { error: updateError } = await supabase.rpc(
        "update_bookmark_embedding",
        {
          p_bookmark_id: bookmark.id,
          p_embedding: formatVectorForPostgres(embedding),
          p_version: CURRENT_EMBEDDING_VERSION,
        }
      );

      if (updateError) {
        // 如果 RPC 不存在，尝试直接更新
        const { error: directError } = await supabase
          .from("bookmarks")
          .update({
            embedding: formatVectorForPostgres(embedding) as unknown as string,
            embedding_version: CURRENT_EMBEDDING_VERSION,
          })
          .eq("id", bookmark.id);

        if (directError) {
          throw new Error(directError.message);
        }
      }

      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        id: bookmark.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    result.processed++;
  });

  await Promise.all(promises);

  return result;
}

async function regenerateEmbeddings(
  supabase: SupabaseClient,
  options: {
    limit: number;
    targetVersion: number;
    userId?: string;
    processAll: boolean;
  }
): Promise<ProcessResult> {
  const totalResult: ProcessResult = {
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  let hasMore = true;
  let round = 1;

  while (hasMore) {
    // 查询需要处理的书签
    let query = supabase
      .from("bookmarks")
      .select("id, user_id, title, ai_summary, ai_tags, embedding_version")
      .is("deleted_at", null)
      .not("embedding", "is", null)
      .or(
        `embedding_version.is.null,embedding_version.lt.${options.targetVersion}`
      )
      .order("created_at", { ascending: true })
      .limit(options.limit);

    if (options.userId) {
      query = query.eq("user_id", options.userId);
    }

    const { data: bookmarks, error } = await query;

    if (error) {
      throw new Error(`查询书签失败: ${error.message}`);
    }

    if (!bookmarks || bookmarks.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`\n📦 第 ${round} 轮: 处理 ${bookmarks.length} 条书签...`);

    // 分批处理
    for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
      const batch = bookmarks.slice(i, i + BATCH_SIZE);
      const batchResult = await processBatch(
        supabase,
        batch as BookmarkForRegenerate[]
      );

      totalResult.processed += batchResult.processed;
      totalResult.success += batchResult.success;
      totalResult.failed += batchResult.failed;
      totalResult.skipped += batchResult.skipped;
      totalResult.errors.push(...batchResult.errors);

      // 进度显示
      process.stdout.write(
        `\r   进度: ${totalResult.processed} 已处理, ${totalResult.success} 成功, ${totalResult.failed} 失败`
      );

      // 批次间延迟
      if (i + BATCH_SIZE < bookmarks.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES)
        );
      }
    }

    console.log(); // 换行

    // 如果不是处理所有，则只处理一轮
    if (!options.processAll) {
      hasMore = false;
    } else {
      round++;
      // 轮次间延迟
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return totalResult;
}

// ============================================================================
// CLI 入口
// ============================================================================

function parseArgs(): {
  dryRun: boolean;
  limit: number;
  all: boolean;
  version: number;
  userId?: string;
} {
  const args = process.argv.slice(2);
  const result = {
    dryRun: false,
    limit: 50,
    all: false,
    version: CURRENT_EMBEDDING_VERSION,
    userId: undefined as string | undefined,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--all") {
      result.all = true;
    } else if (arg.startsWith("--limit=")) {
      result.limit = parseInt(arg.split("=")[1], 10) || 50;
    } else if (arg.startsWith("--version=")) {
      result.version = parseInt(arg.split("=")[1], 10) || CURRENT_EMBEDDING_VERSION;
    } else if (arg.startsWith("--user=")) {
      result.userId = arg.split("=")[1];
    }
  }

  return result;
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         Embedding 批量重新生成工具 v2.0.0                  ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  // 检查环境变量
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dashscopeKey = process.env.DASHSCOPE_API_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ 缺少必要的环境变量:");
    console.error("   - NEXT_PUBLIC_SUPABASE_URL");
    console.error("   - SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (!dashscopeKey) {
    console.error("❌ 缺少 DASHSCOPE_API_KEY 环境变量");
    process.exit(1);
  }

  // 创建 Supabase 客户端
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const options = parseArgs();

  console.log("📋 配置:");
  console.log(`   - Dry Run: ${options.dryRun}`);
  console.log(`   - Limit: ${options.limit}`);
  console.log(`   - Process All: ${options.all}`);
  console.log(`   - Target Version: ${options.version}`);
  if (options.userId) {
    console.log(`   - User ID: ${options.userId}`);
  }
  console.log();

  try {
    // 获取统计信息
    console.log("📊 获取当前统计信息...");
    const stats = await getStats(supabase, options.version, options.userId);

    console.log();
    console.log("📈 统计结果:");
    console.log(`   - 总书签数 (有向量): ${stats.total}`);
    console.log(`   - 需要重新生成: ${stats.needsRegenerate}`);
    console.log(`   - 已是最新版本: ${stats.total - stats.needsRegenerate}`);
    console.log(`   - 版本分布:`);
    for (const [version, count] of Object.entries(stats.versionDistribution)) {
      const marker = version === options.version.toString() ? " ✓ (当前)" : "";
      console.log(`     v${version}: ${count} 条${marker}`);
    }
    console.log();

    if (options.dryRun) {
      console.log("ℹ️  Dry Run 模式，不执行实际操作");
      return;
    }

    if (stats.needsRegenerate === 0) {
      console.log("✅ 所有书签向量已是最新版本，无需处理");
      return;
    }

    // 确认执行
    console.log("🚀 开始重新生成向量...");
    console.log();

    const startTime = Date.now();

    const result = await regenerateEmbeddings(supabase, {
      limit: options.limit,
      targetVersion: options.version,
      userId: options.userId,
      processAll: options.all,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log();
    console.log("════════════════════════════════════════════════════════════");
    console.log("📊 处理完成:");
    console.log(`   - 已处理: ${result.processed}`);
    console.log(`   - 成功: ${result.success}`);
    console.log(`   - 失败: ${result.failed}`);
    console.log(`   - 跳过: ${result.skipped}`);
    console.log(`   - 耗时: ${duration} 秒`);

    if (result.errors.length > 0) {
      console.log();
      console.log("❌ 错误详情 (前 10 条):");
      for (const err of result.errors.slice(0, 10)) {
        console.log(`   - 书签 ${err.id}: ${err.error}`);
      }
    }

    if (result.failed === 0) {
      console.log();
      console.log("✅ 全部成功！");
    }
  } catch (error) {
    console.error();
    console.error("❌ 执行失败:", error);
    process.exit(1);
  }
}

main().catch(console.error);
