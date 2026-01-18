/**
 * 批量更新现有文件夹的智能标签
 *
 * 用途：
 * - 为存量文件夹生成智能标签，提升分类准确度
 * - 解决"lims+实验室"等新文件夹的冷启动问题
 *
 * 运行方式：
 * ```bash
 * npx tsx scripts/update-folder-smart-tags.ts
 * ```
 *
 * @version 1.0.0
 * @since 2026-01-15
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { generateFolderTags } from "../src/lib/classification/utils/folder-tag-generator";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env.local") });

// ============================================================================
// 配置
// ============================================================================

const BATCH_SIZE = 20; // 每批处理数量
const DRY_RUN = process.argv.includes("--dry-run"); // 试运行模式

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log("========================================");
  console.log("批量更新文件夹智能标签");
  console.log("========================================\n");

  if (DRY_RUN) {
    console.log("⚠️  试运行模式：不会实际更新数据库\n");
  }

  // 1. 初始化 Supabase 客户端
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ 错误：缺少 Supabase 环境变量");
    console.error("   请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 2. 查询所有非系统文件夹
  console.log("📂 查询所有文件夹...");

  const { data: folders, error: queryError } = await supabase
    .from("folders")
    .select("id, name, user_id")
    .eq("is_system", false)
    .is("deleted_at", null)
    .order("id", { ascending: true });

  if (queryError) {
    console.error("❌ 查询失败:", queryError.message);
    process.exit(1);
  }

  if (!folders || folders.length === 0) {
    console.log("✅ 没有需要更新的文件夹");
    return;
  }

  console.log(`   找到 ${folders.length} 个文件夹\n`);

  // 3. 批量生成智能标签
  console.log("🏷️  生成智能标签...\n");

  const updates: Array<{
    folderId: number;
    folderName: string;
    tags: string[];
  }> = [];

  for (const folder of folders) {
    const tags = generateFolderTags(folder.name);
    updates.push({
      folderId: folder.id,
      folderName: folder.name,
      tags,
    });

    console.log(
      `   [${folder.id}] ${folder.name}\n` +
        `       标签: ${tags.slice(0, 3).join(", ")}` +
        (tags.length > 3 ? ` (+ ${tags.length - 3} more)` : ""),
    );
  }

  console.log(`\n✅ 共生成 ${updates.length} 个文件夹的智能标签\n`);

  if (DRY_RUN) {
    console.log("⚠️  试运行模式结束，未执行数据库更新");
    console.log("   移除 --dry-run 参数以实际更新");
    return;
  }

  // 4. 批量更新数据库
  console.log("💾 更新数据库...\n");

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(updates.length / BATCH_SIZE);

    console.log(`   批次 ${batchNum}/${totalBatches} (${batch.length} 个文件夹)`);

    for (const update of batch) {
      try {
        // 直接更新 folder_profiles 表的 top_tags 字段
        const { error } = await supabase
          .from("folder_profiles")
          .update({ top_tags: update.tags, updated_at: new Date().toISOString() })
          .eq("folder_id", update.folderId);

        if (error) {
          console.error(`      ❌ [${update.folderId}] ${update.folderName}: ${error.message}`);
          failCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        console.error(`      ❌ [${update.folderId}] ${update.folderName}: ${error}`);
        failCount++;
      }
    }
  }

  // 5. 输出结果
  console.log("\n========================================");
  console.log("更新完成");
  console.log("========================================");
  console.log(`✅ 成功: ${successCount} 个`);
  console.log(`❌ 失败: ${failCount} 个`);
  console.log(`📊 总计: ${updates.length} 个`);

  if (failCount > 0) {
    console.log("\n⚠️  部分更新失败，请检查日志");
    process.exit(1);
  }
}

// ============================================================================
// 错误处理
// ============================================================================

main().catch((error) => {
  console.error("\n❌ 脚本执行失败:", error);
  process.exit(1);
});
