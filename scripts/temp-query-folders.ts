import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const userId = "fd8f3544-7ba6-4c65-b3ae-01141826fb9e";

  // 1. 查询用户的所有文件夹
  console.log("=== 用户文件夹 ===");
  const { data: folders, error: foldersError } = await supabase
    .from("folders")
    .select("id, name, parent_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("id");

  if (foldersError) {
    console.error("Folders error:", foldersError);
  } else if (folders) {
    folders.forEach((f) =>
      console.log("ID:", f.id, "Name:", f.name, "Parent:", f.parent_id),
    );
  }

  // 2. 查询 v5 folder profiles
  console.log("\n=== V5 Folder Profiles ===");
  const { data: profiles, error: profilesError } = await supabase
    .from("classification_folder_profiles_v5")
    .select("folder_id, bookmark_count, alpha_coefficient, needs_update")
    .eq("user_id", userId)
    .order("folder_id");

  if (profilesError) {
    console.error("Profiles error:", profilesError);
  } else if (profiles) {
    console.log("Total profiles:", profiles.length);
    profiles.forEach((p) =>
      console.log(
        "FolderID:",
        p.folder_id,
        "BookmarkCount:",
        p.bookmark_count,
        "Alpha:",
        p.alpha_coefficient,
      ),
    );
  }

  // 3. 特别查看 folder 32 是什么
  console.log("\n=== Folder 32 详情 ===");
  const { data: folder32 } = await supabase
    .from("folders")
    .select("id, name, parent_id")
    .eq("id", 32)
    .single();
  console.log("Folder 32:", folder32);

  // 4. 查找包含 LIMS 关键词的文件夹
  console.log("\n=== LIMS 相关文件夹 ===");
  const { data: limsFolders } = await supabase
    .from("folders")
    .select("id, name")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .ilike("name", "%lims%");
  console.log("LIMS folders:", limsFolders);

  // 5. 检查 LIMS 文件夹的 profile 是否存在
  if (limsFolders && limsFolders.length > 0) {
    const limsFolderId = limsFolders[0].id;
    console.log("\n=== LIMS 文件夹 Profile ===");
    const { data: limsProfile } = await supabase
      .from("classification_folder_profiles_v5")
      .select("folder_id, bookmark_count, alpha_coefficient")
      .eq("folder_id", limsFolderId)
      .single();
    console.log("LIMS Profile:", limsProfile);

    // 6. 检查 LIMS 文件夹中有多少书签
    console.log("\n=== LIMS 文件夹书签 ===");
    const { data: limsBookmarks, count } = await supabase
      .from("bookmarks")
      .select("id, title", { count: "exact" })
      .eq("folder_id", limsFolderId)
      .is("deleted_at", null)
      .limit(5);
    console.log("LIMS bookmarks count:", count);
    if (limsBookmarks) {
      limsBookmarks.forEach((b) => console.log("  -", b.title));
    }
  }
}

main().catch(console.error);
