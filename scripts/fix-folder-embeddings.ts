/**
 * 文件夹向量修复脚本
 * V4.2.8 存量数据修复
 *
 * 使用方法：
 * npx tsx scripts/fix-folder-embeddings.ts
 *
 * @since 2025-12-22
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ 缺少 Supabase 环境变量");
  process.exit(1);
}

if (!DASHSCOPE_API_KEY) {
  console.error("❌ 缺少 DASHSCOPE_API_KEY 环境变量");
  process.exit(1);
}

// 使用 service role key 创建客户端（绕过 RLS）
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * 生成文本的向量嵌入
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-v3",
        input: text,
        dimensions: 1024,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * 修复单个文件夹的名称向量
 */
async function fixFolderEmbedding(
  folderId: number,
  folderName: string,
  userId: string,
): Promise<boolean> {
  try {
    console.log(`  📝 处理文件夹: ${folderName} (ID: ${folderId})`);

    // 生成名称向量
    const embedding = await generateEmbedding(folderName);
    const embeddingString = `[${embedding.join(",")}]`;

    // 调用数据库函数更新
    const { error } = await supabase.rpc("update_folder_name_embedding", {
      p_folder_id: folderId,
      p_name_embedding: embeddingString,
    });

    if (error) {
      console.error(`  ❌ 失败: ${error.message}`);
      return false;
    }

    console.log(`  ✅ 成功`);
    return true;
  } catch (error) {
    console.error(
      `  ❌ 异常: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log("🔧 文件夹向量修复脚本 V4.2.8\n");

  // 1. 查询所有缺失向量的文件夹
  console.log("📊 查询缺失向量的文件夹...\n");

  const { data: folders, error: queryError } = await supabase
    .from("folders")
    .select(
      `
      id,
      name,
      user_id,
      created_at,
      folder_profiles!left (
        name_embedding
      )
    `,
    )
    .eq("is_system", false)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (queryError) {
    console.error(`❌ 查询失败: ${queryError.message}`);
    process.exit(1);
  }

  // 过滤出缺失向量的文件夹
  const foldersToFix = (folders || []).filter((f) => {
    const profile = f.folder_profiles as
      | { name_embedding: unknown }
      | null
      | undefined;
    return !profile || profile.name_embedding === null;
  });

  console.log(`📋 统计结果:`);
  console.log(`   - 总文件夹数: ${folders?.length || 0}`);
  console.log(`   - 缺失向量数: ${foldersToFix.length}`);
  console.log(
    `   - 已有向量数: ${(folders?.length || 0) - foldersToFix.length}\n`,
  );

  if (foldersToFix.length === 0) {
    console.log("✨ 所有文件夹都已有向量，无需修复！");
    return;
  }

  // 2. 逐个修复
  console.log(`🚀 开始修复 ${foldersToFix.length} 个文件夹...\n`);

  let successCount = 0;
  let failedCount = 0;

  for (const folder of foldersToFix) {
    const success = await fixFolderEmbedding(
      folder.id,
      folder.name,
      folder.user_id,
    );

    if (success) {
      successCount++;
    } else {
      failedCount++;
    }

    // 避免 API 限流，间隔 200ms
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // 3. 输出结果
  console.log(`\n📊 修复完成:`);
  console.log(`   ✅ 成功: ${successCount}`);
  console.log(`   ❌ 失败: ${failedCount}`);
}

main().catch((error) => {
  console.error("脚本执行失败:", error);
  process.exit(1);
});
