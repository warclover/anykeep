/**
 * 临时脚本：创建 smart_lists 表和 init_smart_list_presets 函数
 * 用法：npx tsx scripts/create-smart-lists-function.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Creating smart_lists table and function...");

  // 1. 创建表（如果不存在）
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.smart_lists (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      icon VARCHAR(50) DEFAULT 'filter',
      color VARCHAR(20) DEFAULT 'default',
      filters JSONB NOT NULL DEFAULT '{}'::jsonb,
      sort_by VARCHAR(50) DEFAULT 'created_desc',
      view_mode VARCHAR(20) DEFAULT 'inherit',
      sort_order INT DEFAULT 0,
      is_pinned BOOLEAN DEFAULT false,
      is_preset BOOLEAN DEFAULT false,
      bookmark_count INT DEFAULT 0,
      last_accessed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      deleted_at TIMESTAMP WITH TIME ZONE
    );
  `;

  // 2. 创建/替换函数
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION public.init_smart_list_presets(p_user_id UUID)
    RETURNS INT AS $$
    DECLARE
      inserted_count INT := 0;
    BEGIN
      IF EXISTS (
        SELECT 1 FROM public.smart_lists
        WHERE user_id = p_user_id
        AND is_preset = true
        AND deleted_at IS NULL
      ) THEN
        RETURN 0;
      END IF;

      INSERT INTO public.smart_lists (user_id, name, description, icon, color, filters, sort_by, sort_order, is_preset)
      VALUES
      (p_user_id, '最近一周', '过去7天内收藏的内容', 'calendar', 'blue',
       '{"dateRange": {"type": "relative", "value": 7, "unit": "day"}}'::jsonb,
       'created_desc', 0, true),
      (p_user_id, '高价值收藏', '评分为5星的精选内容', 'star', 'amber',
       '{"isHighValue": true}'::jsonb,
       'created_desc', 1, true),
      (p_user_id, '待阅读', '尚未阅读的收藏内容', 'book-open', 'green',
       '{"isRead": false}'::jsonb,
       'created_desc', 2, true),
      (p_user_id, '优质经验', '标记为优质经验的内容', 'award', 'orange',
       '{"usageTags": ["优质经验"]}'::jsonb,
       'created_desc', 3, true),
      (p_user_id, '推荐关注', '值得持续关注的来源', 'eye', 'purple',
       '{"usageTags": ["值得关注"]}'::jsonb,
       'created_desc', 4, true),
      (p_user_id, '值得复读', '需要反复阅读的精华内容', 'refresh-ccw', 'emerald',
       '{"usageTags": ["值得复读"]}'::jsonb,
       'created_desc', 5, true)
      ON CONFLICT DO NOTHING;

      GET DIAGNOSTICS inserted_count = ROW_COUNT;
      RETURN inserted_count;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  // 3. 创建 RLS 策略（使用 DO 块处理已存在的情况）
  const createRLSSQL = `
    ALTER TABLE public.smart_lists ENABLE ROW LEVEL SECURITY;

    DO $$ BEGIN
      CREATE POLICY "smart_lists_user_select" ON public.smart_lists
        FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE POLICY "smart_lists_user_insert" ON public.smart_lists
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE POLICY "smart_lists_user_update" ON public.smart_lists
        FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
        WITH CHECK (auth.uid() = user_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE POLICY "smart_lists_user_delete" ON public.smart_lists
        FOR DELETE USING (auth.uid() = user_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  // 4. 创建索引
  const createIndexSQL = `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_smart_lists_unique_name
      ON public.smart_lists(user_id, name)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_smart_lists_user_active
      ON public.smart_lists(user_id, sort_order)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_smart_lists_user_pinned
      ON public.smart_lists(user_id, is_pinned DESC, sort_order)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_smart_lists_user_presets
      ON public.smart_lists(user_id, is_preset)
      WHERE deleted_at IS NULL AND is_preset = true;
  `;

  // 5. 创建触发器
  const createTriggerSQL = `
    CREATE OR REPLACE FUNCTION public.update_smart_lists_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_smart_lists_updated_at ON public.smart_lists;
    CREATE TRIGGER trigger_smart_lists_updated_at
      BEFORE UPDATE ON public.smart_lists
      FOR EACH ROW
      EXECUTE FUNCTION public.update_smart_lists_updated_at();
  `;

  try {
    // 使用 rpc 调用 exec_sql 或直接用 pg 客户端
    // 由于 Supabase JS 客户端不支持直接执行 SQL，我们需要使用 pg 模块
    // 这里尝试通过 rpc 调用一个管理函数

    // 方案 B：使用 REST API 直接发送 SQL（需要 service role key）
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        sql:
          createTableSQL +
          createFunctionSQL +
          createRLSSQL +
          createIndexSQL +
          createTriggerSQL,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.log("REST API response:", text);
      console.log(
        "\n无法通过 REST API 执行 SQL，请通过 Supabase Dashboard 手动执行以下 SQL：\n",
      );
      console.log("=".repeat(80));
      console.log(createTableSQL);
      console.log(createFunctionSQL);
      console.log(createRLSSQL);
      console.log(createIndexSQL);
      console.log(createTriggerSQL);
      console.log("=".repeat(80));
    } else {
      console.log("SQL executed successfully!");
    }
  } catch (err) {
    console.error("Error:", err);
    console.log("\n请通过 Supabase Dashboard SQL Editor 手动执行迁移文件：");
    console.log(
      "supabase/migrations/20251213000002_create_smart_lists_table.sql",
    );
  }
}

main();
