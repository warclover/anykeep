/**
 * 检查数据库 schema 是否包含新字段
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkSchema() {
  console.log("🔍 检查数据库 schema...\n");

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 检查 bookmarks 表的字段
  const { data, error } = await supabase
    .from("bookmarks")
    .select(
      "id, is_in_trash, trashed_at, is_invalid, invalidated_at, last_validation_at",
    )
    .limit(1);

  if (error) {
    console.error("❌ 查询失败:", error);
    console.log("\n可能的原因:");
    console.log("  - 字段尚未添加到数据库");
    console.log("  - 需要运行迁移: npm run supabase:db:push");
    return false;
  }

  console.log("✅ 数据库 schema 检查通过！");
  console.log("\n已确认的字段:");
  console.log("  ✓ is_in_trash");
  console.log("  ✓ trashed_at");
  console.log("  ✓ is_invalid");
  console.log("  ✓ invalidated_at");
  console.log("  ✓ last_validation_at");

  // 检查 validation_history 表是否存在
  const { error: historyError } = await supabase
    .from("validation_history")
    .select("id")
    .limit(1);

  if (historyError) {
    console.log("\n⚠️  validation_history 表不存在");
    return false;
  }

  console.log("  ✓ validation_history 表");

  return true;
}

checkSchema()
  .then((success) => {
    if (success) {
      console.log("\n✨ 所有检查通过！可以开始使用验证功能。");
    } else {
      console.log("\n❌ 请先运行数据库迁移:");
      console.log("   npm run supabase:db:push");
    }
  })
  .catch((error) => {
    console.error("❌ 检查失败:", error);
    process.exit(1);
  });
