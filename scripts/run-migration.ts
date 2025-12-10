/**
 * 临时脚本：执行清理无意义文件夹的迁移
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

async function runMigration() {
  console.log("Starting migration: cleanup invalid folders...\n");

  // 1. 查找无意义名称的文件夹
  const invalidNames = [
    "内容分类与标签管理",
    "内容分类",
    "标签管理",
    "未分类",
    "新建文件夹",
    "New Folder",
    "Untitled",
    "Unnamed",
  ];

  const { data: invalidFolders, error: findError } = await supabase
    .from("folders")
    .select("id, name, user_id")
    .in("name", invalidNames)
    .eq("is_system", false)
    .is("deleted_at", null);

  if (findError) {
    console.error("Error finding invalid folders:", findError);
    return;
  }

  console.log(`Found ${invalidFolders?.length || 0} invalid folders:`);
  invalidFolders?.forEach((f) => console.log(`  - [${f.id}] ${f.name}`));

  if (!invalidFolders || invalidFolders.length === 0) {
    console.log("\nNo invalid folders to clean up.");
    return;
  }

  const folderIds = invalidFolders.map((f) => f.id);

  // 2. 将书签移动到待整理
  const { data: movedBookmarks, error: moveError } = await supabase
    .from("bookmarks")
    .update({ folder_id: null, updated_at: new Date().toISOString() })
    .in("folder_id", folderIds)
    .is("deleted_at", null)
    .select("id");

  if (moveError) {
    console.error("Error moving bookmarks:", moveError);
    return;
  }

  console.log(`\nMoved ${movedBookmarks?.length || 0} bookmarks to inbox`);

  // 3. 删除文件夹画像
  const { error: profileError } = await supabase
    .from("folder_profiles")
    .delete()
    .in("folder_id", folderIds);

  if (profileError) {
    console.error("Error deleting folder profiles:", profileError);
    return;
  }

  console.log("Deleted folder profiles");

  // 4. 软删除文件夹
  for (const folder of invalidFolders) {
    const { error: deleteError } = await supabase
      .from("folders")
      .update({
        deleted_at: new Date().toISOString(),
        name: `${folder.name}_deleted_${folder.id}`,
      })
      .eq("id", folder.id);

    if (deleteError) {
      console.error(`Error deleting folder ${folder.id}:`, deleteError);
    }
  }

  console.log("Soft deleted invalid folders");
  console.log("\nMigration completed successfully!");
}

runMigration().catch(console.error);
