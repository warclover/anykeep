/**
 * 检查失效收藏是否正确标记
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkInvalidBookmarks() {
  console.log("🔍 检查失效收藏...\n");

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 查询所有失效的收藏
  const { data: invalidBookmarks, error } = await supabase
    .from("bookmarks")
    .select(
      "id, title, url, is_invalid, invalidated_at, last_validation_at, is_in_trash",
    )
    .eq("is_invalid", true)
    .is("deleted_at", null);

  if (error) {
    console.error("❌ 查询失败:", error);
    return;
  }

  if (!invalidBookmarks || invalidBookmarks.length === 0) {
    console.log("✅ 暂无失效的收藏");
    return;
  }

  console.log(`🔴 找到 ${invalidBookmarks.length} 个失效收藏:\n`);

  invalidBookmarks.forEach((bookmark, index) => {
    console.log(`${index + 1}. [${bookmark.id}] ${bookmark.title}`);
    console.log(`   URL: ${bookmark.url}`);
    console.log(
      `   失效时间: ${new Date(bookmark.invalidated_at).toLocaleString("zh-CN")}`,
    );
    console.log(
      `   最后验证: ${new Date(bookmark.last_validation_at).toLocaleString("zh-CN")}`,
    );
    console.log(`   在垃圾箱: ${bookmark.is_in_trash ? "是" : "否"}`);
    console.log();
  });

  // 测试虚拟文件夹查询（模拟 /home?folder=invalid）
  console.log("\n📁 测试「已失效」虚拟文件夹查询...\n");

  const { data: virtualFolderBookmarks, error: virtualError } = await supabase
    .from("bookmarks")
    .select("id, title")
    .eq("is_invalid", true)
    .eq("is_in_trash", false) // 排除垃圾箱
    .is("deleted_at", null);

  if (virtualError) {
    console.error("❌ 虚拟文件夹查询失败:", virtualError);
    return;
  }

  console.log(
    `✅ 虚拟文件夹返回 ${virtualFolderBookmarks?.length || 0} 个失效收藏（排除垃圾箱）`,
  );

  if (virtualFolderBookmarks && virtualFolderBookmarks.length > 0) {
    console.log("\n💡 用户可以访问以下 URL 查看失效收藏:");
    console.log("   http://localhost:3000/home?folder=invalid");
  }
}

checkInvalidBookmarks().catch((error) => {
  console.error("❌ 检查失败:", error);
  process.exit(1);
});
