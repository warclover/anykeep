/**
 * 存量书签切片迁移脚本
 *
 * 为现有书签生成 Parent-Child 切片并计算向量嵌入
 *
 * @usage
 * npx tsx scripts/migrate-bookmark-chunks.ts [--dry-run] [--batch-size=100] [--user-id=xxx]
 *
 * @version 1.0.0
 * @since 2025-12-28
 */

// 加载环境变量（必须在其他导入之前）
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { SemanticChunker } from "../src/lib/chunking/semantic-chunker";
import { ChunkSearchService } from "../src/lib/chunking/chunk-search.service";

// ============================================================================
// 环境变量验证
// ============================================================================

const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DASHSCOPE_API_KEY",
];

const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error("❌ 缺少必需的环境变量:");
  missingVars.forEach((v) => console.error(`   - ${v}`));
  console.error("\n请确保 .env.local 文件存在且包含以上变量");
  process.exit(1);
}

// ============================================================================
// 配置
// ============================================================================

const CONFIG = {
  // 批处理大小
  batchSize: parseInt(process.env.BATCH_SIZE || "50", 10),
  // 是否干跑（不实际写入）
  dryRun: process.argv.includes("--dry-run"),
  // 指定用户 ID（可选）
  userId: getArgValue("--user-id"),
  // 嵌入版本
  embeddingVersion: "v1",
  // 并发生成嵌入数
  embeddingConcurrency: 5,
  // 最小内容长度（字符）
  minContentLength: 50,
};

// ============================================================================
// 初始化
// ============================================================================

// Supabase 客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

console.log(`🔗 Supabase URL: ${supabaseUrl.substring(0, 30)}...`);

const supabase = createClient(supabaseUrl, supabaseKey);

// 切片器
const chunker = new SemanticChunker({
  maxTokens: 256,
  overlapTokens: 32,
  splitByHeaders: true,
  preserveCodeBlocks: true,
  minTokens: 20,
});

// 切片服务
const chunkService = new ChunkSearchService(supabase);

// ============================================================================
// 主流程
// ============================================================================

interface MigrationStats {
  totalBookmarks: number;
  processedBookmarks: number;
  skippedBookmarks: number;
  totalChunks: number;
  totalParentChunks: number;
  totalChildChunks: number;
  errors: Array<{ bookmarkId: number; error: string }>;
  startTime: number;
  endTime?: number;
}

async function main() {
  console.log("=".repeat(60));
  console.log("📚 存量书签切片迁移");
  console.log("=".repeat(60));
  console.log(`配置:`);
  console.log(`  - 批处理大小: ${CONFIG.batchSize}`);
  console.log(`  - 干跑模式: ${CONFIG.dryRun ? "是" : "否"}`);
  console.log(`  - 指定用户: ${CONFIG.userId || "全部"}`);
  console.log(`  - 最小内容长度: ${CONFIG.minContentLength} 字符`);
  console.log("");

  const stats: MigrationStats = {
    totalBookmarks: 0,
    processedBookmarks: 0,
    skippedBookmarks: 0,
    totalChunks: 0,
    totalParentChunks: 0,
    totalChildChunks: 0,
    errors: [],
    startTime: Date.now(),
  };

  try {
    // 0. 测试 Supabase 连接
    console.log("🔍 测试 Supabase 连接...");
    const { data: testData, error: testError } = await supabase
      .from("bookmark_snapshots")
      .select("id")
      .limit(1);

    if (testError) {
      console.error("连接测试失败:", JSON.stringify(testError, null, 2));
      throw new Error(
        `Supabase 连接失败: ${testError.message || JSON.stringify(testError)}`,
      );
    }
    console.log("✅ Supabase 连接成功");

    // 1. 获取待处理的快照总数（有内容的快照）
    // 内容存储在 bookmark_snapshots.readable_text_content
    let countQuery = supabase
      .from("bookmark_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    if (CONFIG.userId) {
      countQuery = countQuery.eq("user_id", CONFIG.userId);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("Supabase 错误详情:", JSON.stringify(countError, null, 2));
      throw new Error(
        `获取书签数量失败: ${countError.message || countError.code || JSON.stringify(countError)}`,
      );
    }

    stats.totalBookmarks = count || 0;
    console.log(`📊 待处理快照总数: ${stats.totalBookmarks}`);
    console.log("");

    if (stats.totalBookmarks === 0) {
      console.log(
        "✅ 没有需要处理的快照（bookmark_snapshots 表为空或无已完成快照）",
      );
      return;
    }

    // 2. 分批处理
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      console.log(
        `\n📦 处理批次 ${Math.floor(offset / CONFIG.batchSize) + 1} (${offset + 1}-${Math.min(offset + CONFIG.batchSize, stats.totalBookmarks)})`,
      );

      // 获取一批快照（在处理时过滤空内容）
      let query = supabase
        .from("bookmark_snapshots")
        .select(
          "id, bookmark_id, readable_title, readable_text_content, original_url, user_id",
        )
        .eq("status", "completed")
        .order("bookmark_id", { ascending: true })
        .range(offset, offset + CONFIG.batchSize - 1);

      if (CONFIG.userId) {
        query = query.eq("user_id", CONFIG.userId);
      }

      const { data: bookmarks, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(`获取快照失败: ${fetchError.message}`);
      }

      if (!bookmarks || bookmarks.length === 0) {
        hasMore = false;
        break;
      }

      // 处理每个快照
      for (const snapshot of bookmarks) {
        try {
          // 转换为 processBookmark 期望的格式
          const bookmarkData = {
            id: snapshot.bookmark_id,
            title: snapshot.readable_title,
            content: snapshot.readable_text_content,
            url: snapshot.original_url,
            user_id: snapshot.user_id,
          };
          const result = await processBookmark(bookmarkData, stats);
          if (result.success) {
            stats.processedBookmarks++;
            stats.totalChunks += result.chunks;
            stats.totalParentChunks += result.parentChunks;
            stats.totalChildChunks += result.childChunks;
          } else {
            stats.skippedBookmarks++;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          stats.errors.push({
            bookmarkId: snapshot.bookmark_id,
            error: errorMessage,
          });
          console.error(
            `  ❌ 书签 ${snapshot.bookmark_id} 处理失败: ${errorMessage}`,
          );
        }

        // 进度报告
        const processed = stats.processedBookmarks + stats.skippedBookmarks;
        if (processed % 10 === 0) {
          const progress = ((processed / stats.totalBookmarks) * 100).toFixed(
            1,
          );
          console.log(
            `  📈 进度: ${progress}% (${processed}/${stats.totalBookmarks})`,
          );
        }
      }

      offset += CONFIG.batchSize;
      hasMore = bookmarks.length === CONFIG.batchSize;

      // 批次间暂停，避免过载
      if (hasMore) {
        await sleep(500);
      }
    }
  } catch (error) {
    console.error("\n❌ 迁移失败:", error);
    process.exit(1);
  }

  // 3. 输出统计
  stats.endTime = Date.now();
  printStats(stats);
}

// ============================================================================
// 处理单个书签
// ============================================================================

interface ProcessResult {
  success: boolean;
  chunks: number;
  parentChunks: number;
  childChunks: number;
}

async function processBookmark(
  bookmark: {
    id: number;
    title: string | null;
    content: string | null;
    url: string | null;
    user_id: string;
  },
  stats: MigrationStats,
): Promise<ProcessResult> {
  const content = bookmark.content || "";

  // 跳过内容过短的书签
  if (content.length < CONFIG.minContentLength) {
    return { success: false, chunks: 0, parentChunks: 0, childChunks: 0 };
  }

  // 检查是否已有切片
  const existingChunks = await chunkService.getChunksByBookmark(bookmark.id);
  if (existingChunks.length > 0) {
    console.log(
      `  ⏭️  书签 ${bookmark.id} 已有 ${existingChunks.length} 个切片，跳过`,
    );
    return { success: false, chunks: 0, parentChunks: 0, childChunks: 0 };
  }

  // 生成切片
  const chunks = chunker.chunk(content);

  if (chunks.length === 0) {
    return { success: false, chunks: 0, parentChunks: 0, childChunks: 0 };
  }

  const parentChunks = chunks.filter((c) => c.type === "parent");
  const childChunks = chunks.filter((c) => c.type === "child");

  console.log(
    `  📝 书签 ${bookmark.id}: ${chunks.length} 切片 (${parentChunks.length} parent, ${childChunks.length} child)`,
  );

  if (CONFIG.dryRun) {
    return {
      success: true,
      chunks: chunks.length,
      parentChunks: parentChunks.length,
      childChunks: childChunks.length,
    };
  }

  // 生成嵌入向量（仅为 child 生成）
  const embeddings: (number[] | null)[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk.type === "child") {
      const embedding = await generateEmbedding(chunk.content);
      embeddings[i] = embedding;
    } else {
      embeddings[i] = null; // Parent 不需要嵌入，数据库存 NULL
    }
  }

  // 保存切片
  await chunkService.saveChunks(
    bookmark.id,
    chunks,
    embeddings,
    CONFIG.embeddingVersion,
  );

  return {
    success: true,
    chunks: chunks.length,
    parentChunks: parentChunks.length,
    childChunks: childChunks.length,
  };
}

// ============================================================================
// 嵌入生成
// ============================================================================

async function generateEmbedding(text: string): Promise<number[]> {
  // 使用阿里百炼 DashScope Text Embedding API
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY 环境变量未设置");
  }

  const response = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-v3",
        input: {
          texts: [text.slice(0, 8000)], // 截断过长文本
        },
        parameters: {
          dimension: 1024,
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`嵌入生成失败: ${response.status} ${error}`);
  }

  const data = await response.json();

  if (data.output?.embeddings?.[0]?.embedding) {
    return data.output.embeddings[0].embedding;
  }

  throw new Error("嵌入响应格式错误");
}

// ============================================================================
// 工具函数
// ============================================================================

function getArgValue(argName: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`${argName}=`));
  return arg ? arg.split("=")[1] : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printStats(stats: MigrationStats) {
  const duration = ((stats.endTime || Date.now()) - stats.startTime) / 1000;

  console.log("\n" + "=".repeat(60));
  console.log("📊 迁移统计");
  console.log("=".repeat(60));
  console.log(`总书签数:     ${stats.totalBookmarks}`);
  console.log(`已处理:       ${stats.processedBookmarks}`);
  console.log(`已跳过:       ${stats.skippedBookmarks}`);
  console.log(`错误数:       ${stats.errors.length}`);
  console.log("");
  console.log(`生成切片总数: ${stats.totalChunks}`);
  console.log(`  - Parent:   ${stats.totalParentChunks}`);
  console.log(`  - Child:    ${stats.totalChildChunks}`);
  console.log("");
  console.log(`耗时:         ${duration.toFixed(1)} 秒`);
  console.log(
    `处理速度:     ${(stats.processedBookmarks / duration).toFixed(2)} 书签/秒`,
  );

  if (stats.errors.length > 0) {
    console.log("\n❌ 错误详情:");
    for (const err of stats.errors.slice(0, 10)) {
      console.log(`  - 书签 ${err.bookmarkId}: ${err.error}`);
    }
    if (stats.errors.length > 10) {
      console.log(`  ... 还有 ${stats.errors.length - 10} 个错误`);
    }
  }

  console.log("\n" + "=".repeat(60));

  if (CONFIG.dryRun) {
    console.log("⚠️  这是干跑模式，没有实际写入数据");
    console.log("   移除 --dry-run 参数以执行实际迁移");
  } else {
    console.log("✅ 迁移完成！");
  }
}

// ============================================================================
// 执行
// ============================================================================

main().catch(console.error);
