/**
 * 批量计算文件夹画像脚本
 *
 * 功能：
 * 1. 诊断当前文件夹 profile 状态
 * 2. 检查书签 embedding 覆盖率
 * 3. 为所有文件夹计算画像
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function computeFolderProfiles() {
  console.log("===========================================");
  console.log("文件夹画像批量计算工具");
  console.log("===========================================\n");

  // 1. 获取所有用户
  const { data: users, error: usersError } = await supabase
    .from("profiles")
    .select("id, nickname");

  if (usersError) {
    console.error("获取用户列表失败:", usersError);
    return;
  }

  console.log(`找到 ${users?.length || 0} 个用户\n`);

  for (const user of users || []) {
    console.log(`\n--- 处理用户: ${user.nickname || user.id} ---`);

    // 2. 获取用户的所有非系统文件夹
    const { data: folders, error: foldersError } = await supabase
      .from("folders")
      .select("id, name")
      .eq("user_id", user.id)
      .eq("is_system", false)
      .is("deleted_at", null);

    if (foldersError) {
      console.error(`获取文件夹失败:`, foldersError);
      continue;
    }

    console.log(`文件夹数量: ${folders?.length || 0}`);

    if (!folders || folders.length === 0) {
      console.log("无文件夹，跳过");
      continue;
    }

    // 3. 检查书签 embedding 覆盖率
    const { data: bookmarkStats } = await supabase.rpc("get_bookmark_stats", {
      p_user_id: user.id,
    });

    // 如果 RPC 不存在，使用原始查询
    const { data: bookmarks } = await supabase
      .from("bookmarks")
      .select("id, folder_id, embedding")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    const totalBookmarks = bookmarks?.length || 0;
    const withEmbedding = bookmarks?.filter((b) => b.embedding !== null).length || 0;
    const coverageRate = totalBookmarks > 0 ? ((withEmbedding / totalBookmarks) * 100).toFixed(1) : "0";

    console.log(`书签总数: ${totalBookmarks}`);
    console.log(`有向量书签: ${withEmbedding} (${coverageRate}%)`);

    // 4. 按文件夹统计
    console.log("\n文件夹书签分布:");
    for (const folder of folders) {
      const folderBookmarks = bookmarks?.filter((b) => b.folder_id === folder.id) || [];
      const folderWithEmb = folderBookmarks.filter((b) => b.embedding !== null).length;

      if (folderBookmarks.length > 0) {
        console.log(`  [${folder.id}] ${folder.name}: ${folderBookmarks.length} 书签, ${folderWithEmb} 有向量`);
      } else {
        console.log(`  [${folder.id}] ${folder.name}: 空文件夹`);
      }
    }

    // 5. 批量计算文件夹画像
    console.log("\n开始计算文件夹画像...");

    const { data: computedCount, error: computeError } = await supabase.rpc(
      "compute_user_folder_profiles",
      { p_user_id: user.id },
    );

    if (computeError) {
      console.error("计算画像失败:", computeError);
      continue;
    }

    console.log(`✓ 成功计算 ${computedCount} 个文件夹画像`);

    // 6. 验证结果
    const { data: profiles } = await supabase
      .from("folder_profiles")
      .select(`
        folder_id,
        bookmark_count,
        profile_embedding,
        top_tags,
        folders!inner(name)
      `)
      .eq("user_id", user.id);

    console.log("\n画像计算结果:");
    for (const profile of profiles || []) {
      const hasEmb = profile.profile_embedding !== null ? "✓" : "✗";
      // folders 是 Supabase join 返回的数组（单条记录）
      const folders = profile.folders as unknown as { name: string }[] | null;
      const folderName = folders?.[0]?.name || "未知";
      console.log(
        `  [${profile.folder_id}] ${folderName}: ` +
          `${profile.bookmark_count} 书签, 向量=${hasEmb}, ` +
          `标签=${(profile.top_tags || []).slice(0, 3).join(", ") || "无"}`,
      );
    }
  }

  console.log("\n===========================================");
  console.log("处理完成！");
  console.log("===========================================");
}

computeFolderProfiles().catch(console.error);
