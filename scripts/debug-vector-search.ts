/**
 * 调试向量搜索问题
 * 用法：npx tsx scripts/debug-vector-search.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// 加载环境变量
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  console.log("🔍 调试向量搜索问题\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const testUserId = "fd8f3544-7ba6-4c65-b3ae-01141826fb9e";

  // 1. 检查该用户的文件夹画像
  console.log("1️⃣ 检查用户文件夹画像...");
  const { data: profiles, error: profileError } = await supabase
    .from("classification_folder_profiles_v5")
    .select("id, folder_id, user_id")
    .eq("user_id", testUserId);

  if (profileError) {
    console.error("❌ 查询画像失败:", profileError);
    return;
  }

  console.log(`   找到 ${profiles?.length || 0} 个画像`);

  if (!profiles || profiles.length === 0) {
    console.log("❌ 该用户没有文件夹画像数据");
    return;
  }

  // 2. 获���一个画像的向量用于测试
  console.log("\n2️⃣ 获取测试向量...");
  const { data: testProfile, error: vecError } = await supabase
    .from("classification_folder_profiles_v5")
    .select("content_embedding")
    .eq("user_id", testUserId)
    .limit(1)
    .single();

  if (vecError || !testProfile?.content_embedding) {
    console.error("❌ 获取向量失败:", vecError);
    return;
  }

  const testVector = testProfile.content_embedding;

  // 解析向量：Supabase 返回的可能是字符串格式 "[0.1,0.2,...]"
  let parsedVector: number[];
  if (typeof testVector === "string") {
    // 去掉首尾的 [ ] 并分割
    parsedVector = testVector
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((v: string) => parseFloat(v.trim()));
    console.log(`   向量格式: 字符串 → 已解析为数组`);
  } else if (Array.isArray(testVector)) {
    parsedVector = testVector;
  } else {
    console.error("❌ 未知的向量格式:", typeof testVector);
    return;
  }

  console.log(`   向量维度: ${parsedVector.length}`);

  // 3. 直接调用 RPC 函数测试
  console.log("\n3️⃣ 调用 match_folder_profiles_v5 RPC...");

  // 测试不同的阈值
  const thresholds = [0, 0.1, 0.3, 0.5, 0.7];

  for (const threshold of thresholds) {
    const { data: matches, error: rpcError } = await supabase.rpc(
      "match_folder_profiles_v5",
      {
        p_user_id: testUserId,
        p_content_embedding: parsedVector,
        p_behavior_embedding: null,
        p_alpha: 0,
        p_match_threshold: threshold,
        p_match_count: 10,
      },
    );

    if (rpcError) {
      console.error(`   阈值 ${threshold}: ❌ 错误 - ${rpcError.message}`);
    } else {
      console.log(
        `   阈值 ${threshold}: ✅ 返回 ${matches?.length || 0} 条结果`,
      );
      if (matches && matches.length > 0) {
        console.log(
          `      Top 1: folder_id=${matches[0].folder_id}, similarity=${matches[0].similarity?.toFixed(4)}`,
        );
      }
    }
  }

  // 4. 测试通过 TypeScript 代码调用
  console.log("\n4️⃣ 测试 VectorSearchService...");

  try {
    const { VectorSearchService } = await import(
      "../src/lib/classification/v5/shared/vector-search"
    );
    const { createLogger } = await import(
      "../src/lib/classification/v5/shared/logger"
    );

    const logger = createLogger("DebugTest");
    const vectorSearch = new VectorSearchService(logger, {
      minSimilarity: 0.0, // 完全不过滤
    });

    const searchResult = await vectorSearch.search({
      userId: testUserId,
      contentEmbedding: parsedVector,
      limit: 10,
    });

    console.log(`   VectorSearchService 返回 ${searchResult.length} 条结果`);
    if (searchResult.length > 0) {
      console.log(
        `   Top 1: folder_id=${searchResult[0].folderId}, similarity=${searchResult[0].similarity?.toFixed(4)}`,
      );
    }
  } catch (error) {
    console.error("   ❌ VectorSearchService 调用失败:", error);
  }

  console.log("\n✅ 调试完成");

  // 5. 测试 EmbeddingService 生成向量
  console.log("\n5️⃣ 测试 EmbeddingService 生成向量...");
  try {
    const { EmbeddingService } = await import(
      "../src/lib/classification/v5/shared/embedding"
    );
    const { createLogger } = await import(
      "../src/lib/classification/v5/shared/logger"
    );

    const logger = createLogger("DebugTest");
    const embeddingService = new EmbeddingService(logger, {});

    const testText = "AI 应用开发趋势和投资方向";
    const result = await embeddingService.generateEmbedding(testText);

    console.log(`   生成成功!`);
    console.log(`   向量类型: ${typeof result.embedding}`);
    console.log(`   是数组: ${Array.isArray(result.embedding)}`);
    console.log(`   向量维度: ${result.embedding.length}`);
    console.log(
      `   前5个值: [${result.embedding
        .slice(0, 5)
        .map((v) => v.toFixed(4))
        .join(", ")}]`,
    );

    // 6. 用生成的向量调用 VectorSearchService
    console.log("\n6️⃣ 用新生成的向量调用 VectorSearchService...");
    const { VectorSearchService } = await import(
      "../src/lib/classification/v5/shared/vector-search"
    );
    const vectorSearch = new VectorSearchService(logger, {
      minSimilarity: 0.0,
    });

    const searchResult = await vectorSearch.search({
      userId: testUserId,
      contentEmbedding: result.embedding,
      limit: 10,
    });

    console.log(`   VectorSearchService 返回 ${searchResult.length} 条结果`);
    if (searchResult.length > 0) {
      console.log(
        `   Top 1: folder_id=${searchResult[0].folderId}, name=${searchResult[0].folderName}, similarity=${searchResult[0].similarity?.toFixed(4)}`,
      );
    }

    // 7. 测试完整的 ClassificationPipelineService
    console.log("\n7️⃣ 测试完整的 ClassificationPipelineService...");
    const { ClassificationPipelineService } = await import(
      "../src/lib/classification/v5/classification-pipeline"
    );
    const { LLMService } = await import(
      "../src/lib/classification/v5/shared/llm"
    );

    const llmService = new LLMService(logger);
    const pipeline = new ClassificationPipelineService(
      logger,
      embeddingService,
      vectorSearch,
      llmService,
    );

    const classificationResult = await pipeline.classify({
      userId: testUserId,
      bookmarkId: "test-1667",
      title: "最好的 AI 应用时代要来了，为什么现在是软件行业最大的范式转变！",
      url: "https://example.com/ai-paradigm-shift",
      summary: "AI 应用开发趋势分析",
    });

    console.log(`   分类成功!`);
    console.log(`   推荐文件夹 ID: ${classificationResult.folderId}`);
    console.log(
      `   置信度: ${(classificationResult.confidence * 100).toFixed(1)}%`,
    );
    console.log(`   使用 T1: ${classificationResult.usedT1}`);
    console.log(`   总延迟: ${classificationResult.totalLatencyMs}ms`);
  } catch (error) {
    console.error("   ❌ 失败:", error);
  }
}

main().catch(console.error);
