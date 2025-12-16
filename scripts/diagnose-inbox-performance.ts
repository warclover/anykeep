/**
 * Inbox Performance Diagnosis Script
 * 诊断 /api/classification/inbox 性能瓶颈
 *
 * 执行方式: npx tsx scripts/diagnose-inbox-performance.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error(
    "   SUPABASE_SERVICE_ROLE_KEY:",
    supabaseServiceKey ? "✓" : "✗",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface DiagnosisResult {
  step: string;
  duration: number;
  details: Record<string, unknown>;
}

async function diagnoseInboxPerformance(userId?: string) {
  const results: DiagnosisResult[] = [];

  console.log("\n" + "=".repeat(60));
  console.log("🔍 AnyKeep Inbox Performance Diagnosis");
  console.log("=".repeat(60) + "\n");

  // 0. 获取测试用户
  if (!userId) {
    console.log("[0] Finding test user...");
    const { data: users } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    if (!users || users.length === 0) {
      console.error("❌ No users found in database");
      process.exit(1);
    }
    userId = users[0].id;
  }
  console.log(`    Using user ID: ${userId!.slice(0, 8)}...`);
  console.log();

  // 1. 检查 inbox 书签数量
  console.log("[1] Checking inbox bookmark count...");
  let t1 = performance.now();

  // 先获取 inbox folder
  const { data: inboxFolder } = await supabase
    .from("folders")
    .select("id")
    .eq("user_id", userId)
    .eq("is_system", true)
    .eq("system_type", "INBOX")
    .single();

  // 然后获取未分类书签 (folder_id IS NULL 或 folder_id = inbox_folder_id)
  const { count: inboxCount } = await supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or(
      `folder_id.is.null${inboxFolder ? `,folder_id.eq.${inboxFolder.id}` : ""}`,
    );

  let t2 = performance.now();
  results.push({
    step: "inbox_bookmark_count",
    duration: t2 - t1,
    details: { count: inboxCount },
  });
  console.log(`    📊 Inbox bookmarks: ${inboxCount || 0}`);
  console.log(`    ⏱️  Query time: ${(t2 - t1).toFixed(2)}ms`);
  console.log();

  // 2. 检查有 embedding 的书签数量
  console.log("[2] Checking bookmarks with embedding...");
  t1 = performance.now();
  const { count: embeddingCount } = await supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("embedding", "is", null);
  t2 = performance.now();
  results.push({
    step: "embedding_count",
    duration: t2 - t1,
    details: { count: embeddingCount },
  });
  console.log(`    📊 Bookmarks with embedding: ${embeddingCount || 0}`);
  console.log(`    ⏱️  Query time: ${(t2 - t1).toFixed(2)}ms`);
  console.log();

  // 3. 检查 folder 数量
  console.log("[3] Checking user folder count...");
  t1 = performance.now();
  const { count: folderCount } = await supabase
    .from("folders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_system", false);
  t2 = performance.now();
  results.push({
    step: "folder_count",
    duration: t2 - t1,
    details: { count: folderCount },
  });
  console.log(`    📊 User folders: ${folderCount || 0}`);
  console.log(`    ⏱️  Query time: ${(t2 - t1).toFixed(2)}ms`);
  console.log();

  // 4. 检查 folder_profiles 数量
  console.log("[4] Checking folder profiles...");
  t1 = performance.now();
  const { count: profileCount } = await supabase
    .from("folder_profiles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  t2 = performance.now();
  results.push({
    step: "folder_profile_count",
    duration: t2 - t1,
    details: { count: profileCount },
  });
  console.log(`    📊 Folder profiles: ${profileCount || 0}`);
  console.log(`    ⏱️  Query time: ${(t2 - t1).toFixed(2)}ms`);
  console.log();

  // 5. 模拟 N+1 查询影响
  console.log("[5] Simulating N+1 query pattern (10 sequential queries)...");
  const queryCount = 10;
  t1 = performance.now();
  for (let i = 0; i < queryCount; i++) {
    await supabase
      .from("folder_profiles")
      .select("folder_id, computed_embedding")
      .eq("user_id", userId)
      .limit(1);
  }
  t2 = performance.now();
  const n1Duration = t2 - t1;
  results.push({
    step: "n_plus_1_simulation",
    duration: n1Duration,
    details: { queryCount, avgPerQuery: n1Duration / queryCount },
  });
  console.log(
    `    📊 ${queryCount} sequential queries: ${n1Duration.toFixed(2)}ms`,
  );
  console.log(
    `    📊 Average per query: ${(n1Duration / queryCount).toFixed(2)}ms`,
  );
  console.log();

  // 6. 批量查询对比
  console.log("[6] Batch query comparison (1 query for all)...");
  t1 = performance.now();
  const { data: allProfiles } = await supabase
    .from("folder_profiles")
    .select("folder_id, computed_embedding")
    .eq("user_id", userId);
  t2 = performance.now();
  const batchDuration = t2 - t1;
  results.push({
    step: "batch_query",
    duration: batchDuration,
    details: { profilesFetched: allProfiles?.length || 0 },
  });
  console.log(`    📊 1 batch query: ${batchDuration.toFixed(2)}ms`);
  console.log(`    📊 Profiles fetched: ${allProfiles?.length || 0}`);
  console.log();

  // 7. 计算 N+1 vs 批量查询的差异
  const n1VsBatchRatio = n1Duration / batchDuration;
  const potentialSaving = n1Duration - batchDuration;

  console.log("[7] N+1 vs Batch Query Analysis:");
  console.log(`    📊 N+1 pattern: ${n1Duration.toFixed(2)}ms`);
  console.log(`    📊 Batch pattern: ${batchDuration.toFixed(2)}ms`);
  console.log(`    📊 Ratio: ${n1VsBatchRatio.toFixed(2)}x slower`);
  console.log(`    📊 Potential saving: ${potentialSaving.toFixed(2)}ms`);
  console.log();

  // 8. 测试 bookmarks 全量查询 vs 分页查询
  console.log("[8] Testing bookmarks query patterns...");

  // 全量查询
  t1 = performance.now();
  const { data: allBookmarks } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  t2 = performance.now();
  const fullQueryDuration = t2 - t1;
  const fullDataSize = JSON.stringify(allBookmarks || []).length;

  // 分页查询 (limit 20)
  const t3 = performance.now();
  const { data: pagedBookmarks } = await supabase
    .from("bookmarks")
    .select("id, title, url, platform, cover_url, created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  const t4 = performance.now();
  const pagedQueryDuration = t4 - t3;
  const pagedDataSize = JSON.stringify(pagedBookmarks || []).length;

  results.push({
    step: "bookmarks_full_query",
    duration: fullQueryDuration,
    details: { count: allBookmarks?.length || 0, dataSize: fullDataSize },
  });
  results.push({
    step: "bookmarks_paged_query",
    duration: pagedQueryDuration,
    details: { count: pagedBookmarks?.length || 0, dataSize: pagedDataSize },
  });

  console.log(
    `    📊 Full query (SELECT *): ${fullQueryDuration.toFixed(2)}ms, ${(fullDataSize / 1024).toFixed(2)}KB, ${allBookmarks?.length || 0} items`,
  );
  console.log(
    `    📊 Paged query (limit 20): ${pagedQueryDuration.toFixed(2)}ms, ${(pagedDataSize / 1024).toFixed(2)}KB, ${pagedBookmarks?.length || 0} items`,
  );
  console.log(
    `    📊 Data size reduction: ${((1 - pagedDataSize / fullDataSize) * 100).toFixed(1)}%`,
  );
  console.log();

  // 9. 输出诊断总结
  console.log("=".repeat(60));
  console.log("📋 DIAGNOSIS SUMMARY");
  console.log("=".repeat(60));
  console.log();

  // 问题诊断
  const issues: string[] = [];
  const recommendations: string[] = [];

  if ((inboxCount || 0) > 50) {
    issues.push(
      `⚠️  High inbox count (${inboxCount}): Clustering will be slow`,
    );
    recommendations.push(
      "→ Implement pagination for clustering (max 200 items)",
    );
  }

  if (n1VsBatchRatio > 2) {
    issues.push(
      `⚠️  N+1 query issue confirmed: ${n1VsBatchRatio.toFixed(1)}x slower than batch`,
    );
    recommendations.push(
      `→ Switch to batch query: Save ~${potentialSaving.toFixed(0)}ms per request`,
    );
  }

  if (fullDataSize > 100 * 1024) {
    issues.push(
      `⚠️  Large data transfer: ${(fullDataSize / 1024).toFixed(0)}KB`,
    );
    recommendations.push(
      `→ Implement pagination: Reduce to ~${(pagedDataSize / 1024).toFixed(0)}KB`,
    );
  }

  if ((profileCount || 0) === 0 && (folderCount || 0) > 0) {
    issues.push("⚠️  No folder profiles computed");
    recommendations.push("→ Run folder profile computation job");
  }

  if (issues.length === 0) {
    console.log("✅ No significant performance issues detected");
  } else {
    console.log("Issues Found:");
    issues.forEach((issue) => console.log(`  ${issue}`));
    console.log();
    console.log("Recommendations:");
    recommendations.forEach((rec) => console.log(`  ${rec}`));
  }

  console.log();
  console.log("=".repeat(60));
  console.log("📊 RAW METRICS");
  console.log("=".repeat(60));
  console.log(JSON.stringify(results, null, 2));

  return { results, issues, recommendations };
}

// 执行诊断
diagnoseInboxPerformance()
  .then(() => {
    console.log("\n✅ Diagnosis complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Diagnosis failed:", error);
    process.exit(1);
  });
