/**
 * V5.5 晶体生长系统 - 功能测试脚本
 *
 * 测试覆盖：
 * 1. 配额服务
 * 2. 混沌池管理
 * 3. 晶核检测
 * 4. 结晶流程
 * 5. 异步命名
 */

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

// 从环境变量获取配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ 缺少必需的环境变量: NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  message: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<void>,
): Promise<void> {
  const start = performance.now();
  try {
    await testFn();
    results.push({
      name,
      status: "PASS",
      message: "测试通过",
      duration: performance.now() - start,
    });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({
      name,
      status: "FAIL",
      message: error instanceof Error ? error.message : String(error),
      duration: performance.now() - start,
    });
    console.log(`❌ ${name}: ${error}`);
  }
}

// ============================================
// 测试用例
// ============================================

async function testDatabaseTables(): Promise<void> {
  // 检查 chaos_pool 表是否存在
  const { error: chaosError } = await supabase
    .from("chaos_pool")
    .select("id")
    .limit(1);

  if (chaosError && chaosError.code !== "PGRST116") {
    throw new Error(`chaos_pool 表不存在: ${chaosError.message}`);
  }

  // 检查 folders 表的新字段
  const { data: folders, error: foldersError } = await supabase
    .from("folders")
    .select("is_ai_generated, ai_generation_source, crystal_birth_time")
    .limit(1);

  if (foldersError) {
    throw new Error(`folders 表字段检查失败: ${foldersError.message}`);
  }
}

async function testQuotaStatsRPC(): Promise<void> {
  // 获取一个测试用户
  const { data: user } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .single();

  if (!user) {
    throw new Error("没有找到测试用户");
  }

  const { data, error } = await supabase.rpc("get_unified_quota_stats", {
    p_user_id: user.id,
  });

  if (error) {
    throw new Error(`配额统计 RPC 失败: ${error.message}`);
  }

  const stats = Array.isArray(data) ? data[0] : data;

  if (
    stats.ai_folder_count === undefined ||
    stats.total_folder_count === undefined ||
    stats.empty_folder_count === undefined
  ) {
    throw new Error("配额统计返回字段不完整");
  }

  console.log(
    `   配额统计: AI文件夹=${stats.ai_folder_count}, 总数=${stats.total_folder_count}, 空文件夹=${stats.empty_folder_count}`,
  );
}

async function testChaosPoolRPC(): Promise<void> {
  // 获取测试用户
  const { data: user } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .single();

  if (!user) {
    throw new Error("没有找到测试用户");
  }

  // 获取一个书签用于测试
  const { data: bookmark } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!bookmark) {
    console.log("   跳过: 用户没有书签");
    return;
  }

  // 测试添加到混沌池
  const { data: added, error: addError } = await supabase.rpc(
    "add_to_chaos_pool",
    {
      p_user_id: user.id,
      p_bookmark_id: bookmark.id,
    },
  );

  if (addError) {
    throw new Error(`添加混沌池失败: ${addError.message}`);
  }

  // 测试获取混沌池 ID 列表
  const { data: ids, error: idsError } = await supabase.rpc(
    "get_chaos_pool_bookmark_ids",
    {
      p_user_id: user.id,
    },
  );

  if (idsError) {
    throw new Error(`获取混沌池 ID 失败: ${idsError.message}`);
  }

  console.log(`   混沌池书签数: ${ids?.length || 0}`);

  // 清理测试数据
  await supabase
    .from("chaos_pool")
    .delete()
    .eq("user_id", user.id)
    .eq("bookmark_id", bookmark.id);
}

async function testNeighborSearchRPC(): Promise<void> {
  // 获取测试用户
  const { data: user } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .single();

  if (!user) {
    throw new Error("没有找到测试用户");
  }

  // 获取有 embedding 的书签
  const { data: bookmark } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", user.id)
    .not("embedding", "is", null)
    .limit(1)
    .single();

  if (!bookmark) {
    console.log("   跳过: 用户没有带 embedding 的书签");
    return;
  }

  // 测试邻居搜索（即使没有混沌池数据也不应报错）
  const { data: neighbors, error } = await supabase.rpc(
    "find_chaos_pool_neighbors",
    {
      p_user_id: user.id,
      p_bookmark_id: bookmark.id,
      p_radius: 0.2,
      p_limit: 5,
    },
  );

  if (error) {
    throw new Error(`邻居搜索失败: ${error.message}`);
  }

  console.log(`   找到邻居数: ${neighbors?.length || 0}`);
}

async function testCrystallizeFolderRPC(): Promise<void> {
  // 获取测试用户
  const { data: user } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .single();

  if (!user) {
    throw new Error("没有找到测试用户");
  }

  // 创建测试书签
  const testBookmarks = await Promise.all([
    supabase
      .from("bookmarks")
      .insert({
        user_id: user.id,
        title: "V5.5 测试书签 1",
        url: "https://test.example.com/1",
      })
      .select("id")
      .single(),
    supabase
      .from("bookmarks")
      .insert({
        user_id: user.id,
        title: "V5.5 测试书签 2",
        url: "https://test.example.com/2",
      })
      .select("id")
      .single(),
  ]);

  const bookmarkIds = testBookmarks
    .filter((r) => r.data)
    .map((r) => r.data!.id);

  if (bookmarkIds.length < 2) {
    throw new Error("创建测试书签失败");
  }

  try {
    // 测试结晶事务
    const { data, error } = await supabase.rpc("crystallize_folder", {
      p_user_id: user.id,
      p_folder_name: "V5.5 测试文件夹",
      p_bookmark_ids: bookmarkIds,
      p_ai_source: "CRYSTAL_GROWTH",
    });

    if (error) {
      throw new Error(`结晶事务失败: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    console.log(
      `   创建文件夹 ID: ${result.folder_id}, 移动书签数: ${result.bookmarks_moved}`,
    );

    // 验证文件夹创建成功
    const { data: folder } = await supabase
      .from("folders")
      .select("id, name, is_ai_generated, ai_generation_source")
      .eq("id", result.folder_id)
      .single();

    if (!folder || !folder.is_ai_generated) {
      throw new Error("文件夹未正确标记为 AI 生成");
    }

    // 清理测试数据
    await supabase.from("bookmarks").delete().in("id", bookmarkIds);
    await supabase.from("folders").delete().eq("id", result.folder_id);

    console.log(`   ✓ 事务测试完成，已清理测试数据`);
  } catch (error) {
    // 清理失败情况下的测试数据
    await supabase.from("bookmarks").delete().in("id", bookmarkIds);
    throw error;
  }
}

async function testQuotaAPI(): Promise<void> {
  // 这个测试需要通过 HTTP 调用 API
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/folders/quota`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  // 未登录应该返回 401
  if (response.status !== 401) {
    const data = await response.json();
    console.log(`   API 响应: ${JSON.stringify(data)}`);
  } else {
    console.log("   API 需要认证（预期行为）");
  }
}

async function testFeatureFlags(): Promise<void> {
  const flags = {
    V55_ENABLED: process.env.V55_ENABLED,
    V55_ROLLOUT_PERCENT: process.env.V55_ROLLOUT_PERCENT,
    V55_SHADOW_MODE: process.env.V55_SHADOW_MODE,
    V55_CHAOS_POOL_ENABLED: process.env.V55_CHAOS_POOL_ENABLED,
    V55_CRYSTAL_GROWTH_ENABLED: process.env.V55_CRYSTAL_GROWTH_ENABLED,
    V55_ASYNC_NAMING_ENABLED: process.env.V55_ASYNC_NAMING_ENABLED,
  };

  console.log("   Feature Flags:");
  for (const [key, value] of Object.entries(flags)) {
    console.log(`     ${key}: ${value ?? "(未设置)"}`);
  }

  if (process.env.V55_ENABLED !== "true") {
    throw new Error("V55_ENABLED 未设置为 true");
  }
}

// ============================================
// 运行测试
// ============================================

async function main(): Promise<void> {
  console.log("\n🧪 AnyKeep v5.5 晶体生长系统 - 功能测试\n");
  console.log("=".repeat(50));

  await runTest("1. 数据库表结构检查", testDatabaseTables);
  await runTest("2. Feature Flags 检查", testFeatureFlags);
  await runTest("3. 配额统计 RPC", testQuotaStatsRPC);
  await runTest("4. 混沌池 RPC", testChaosPoolRPC);
  await runTest("5. 邻居搜索 RPC", testNeighborSearchRPC);
  await runTest("6. 结晶事务 RPC", testCrystallizeFolderRPC);
  await runTest("7. 配额查询 API", testQuotaAPI);

  console.log("\n" + "=".repeat(50));
  console.log("\n📊 测试结果汇总:\n");

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;

  console.log(`   ✅ 通过: ${passed}`);
  console.log(`   ❌ 失败: ${failed}`);
  console.log(`   ⏭️  跳过: ${skipped}`);

  if (failed > 0) {
    console.log("\n❌ 失败的测试:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`   - ${r.name}: ${r.message}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(
    failed === 0
      ? "\n🎉 所有测试通过！\n"
      : "\n⚠️  部分测试失败，请检查上述错误\n",
  );

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
