/**
 * 测试失效检测功能
 * 使用 Supabase Service Role 直接触发验证
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testValidation() {
  console.log("🚀 开始测试失效检测功能...\n");

  // 1. 创建 Supabase 客户端（使用服务角色）
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 2. 获取所有用户（限制10个用于测试）
  const { data: users, error: usersError } = await supabase
    .from("profiles")
    .select("id, nickname, phone")
    .limit(10);

  if (usersError) {
    console.error("❌ 获取用户列表失败:", usersError);
    return;
  }

  if (!users || users.length === 0) {
    console.log("⚠️  没有找到任何用户");
    return;
  }

  console.log(`📋 找到 ${users.length} 个用户\n`);

  // 3. 为每个用户执行验证
  for (const user of users) {
    console.log(`\n👤 用户: ${user.nickname || user.phone || user.id}`);

    // 获取用户的收藏数量
    const { count: bookmarksCount } = await supabase
      .from("bookmarks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .eq("is_in_trash", false);

    console.log(`   📚 收藏数量: ${bookmarksCount || 0}`);

    if (!bookmarksCount || bookmarksCount === 0) {
      console.log("   ⏭️  跳过（无收藏）");
      continue;
    }

    // 调用验证 API
    try {
      const response = await fetch(
        "http://localhost:3000/api/bookmarks/validate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            limit: 50, // 限制数量，避免超时
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`   ❌ 验证失败: ${response.status}`, errorData);
        continue;
      }

      const result = await response.json();
      console.log("   ✅ 验证完成:");
      console.log(`      - 总数: ${result.data.total}`);
      console.log(`      - 检测: ${result.data.checked}`);
      console.log(`      - 跳过: ${result.data.skipped}`);
      console.log(`      - 有效: ${result.data.valid}`);
      console.log(`      - 失效: ${result.data.invalid}`);
      console.log(`      - 耗时: ${result.data.duration}ms`);

      // 显示失效的收藏
      if (result.data.invalid > 0) {
        console.log(`\n   🔴 失效的收藏:`);
        const invalidResults = result.data.results.filter(
          (r: any) => r.status === "invalid",
        );
        invalidResults.slice(0, 5).forEach((r: any) => {
          console.log(`      - [${r.bookmarkId}] ${r.url}`);
          console.log(`        错误: ${r.error || `HTTP ${r.statusCode}`}`);
        });
        if (invalidResults.length > 5) {
          console.log(`      ... 还有 ${invalidResults.length - 5} 个`);
        }
      }

      // 显示跳过的原因统计
      if (result.data.skipped > 0) {
        console.log(`\n   ⏭️  跳过原因统计:`);
        const skippedResults = result.data.results.filter(
          (r: any) => r.status === "skipped",
        );
        const reasonCounts: Record<string, number> = {};
        skippedResults.forEach((r: any) => {
          reasonCounts[r.skipReason] = (reasonCounts[r.skipReason] || 0) + 1;
        });
        Object.entries(reasonCounts).forEach(([reason, count]) => {
          console.log(`      - ${reason}: ${count}`);
        });
      }
    } catch (error) {
      console.error(
        "   ❌ 请求失败:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log("\n\n✨ 测试完成！");
}

// 运行测试
testValidation().catch((error) => {
  console.error("❌ 测试失败:", error);
  process.exit(1);
});
