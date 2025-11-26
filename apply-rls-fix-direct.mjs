/**
 * 直接应用 RLS 修复
 * 使用 Supabase Admin API
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://guwtnzcumkqsdcwrmdta.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1d3RuemN1bWtxc2Rjd3JtZHRhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzY1Njk1NywiZXhwIjoyMDc5MjMyOTU3fQ.zqesQEeI2VFpBoVw8aXTaDlKwhqjs2E9AQMrC9OGcv8'

console.log('🔧 应用 RLS 策略修复...')
console.log('Supabase URL:', supabaseUrl)
console.log('')

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function applyFix() {
  try {
    // 读取迁移文件
    const sql = readFileSync('./supabase/migrations/20251124000001_fix_bookmarks_update_policy.sql', 'utf-8')

    console.log('📋 迁移 SQL:')
    console.log('─'.repeat(60))
    console.log(sql)
    console.log('─'.repeat(60))
    console.log('')

    // 方法 1: 尝试使用 Supabase REST API
    console.log('方法 1: 使用 Supabase REST API...')

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ query: sql }),
    })

    if (response.ok) {
      console.log('✅ 方法 1 成功！')
      const data = await response.json()
      console.log('结果:', data)
      return
    }

    console.log('⚠️  方法 1 失败，状态码:', response.status)
    console.log('错误:', await response.text())
    console.log('')

    // 方法 2: 分步执行
    console.log('方法 2: 分步执行 SQL 语句...')

    // 步骤 1: 删除旧策略
    console.log('1️⃣ 删除旧策略...')
    const dropSQL = 'DROP POLICY IF EXISTS "Users can update own bookmarks" ON public.bookmarks'

    // 使用 postgres 元数据
    const { data: dropData, error: dropError } = await supabase
      .from('_migrations')
      .select('*')
      .limit(0)

    if (dropError && !dropError.message.includes('does not exist')) {
      console.log('⚠️  无法访问数据库元数据')
    }

    // 步骤 2: 创建新策略
    console.log('2️⃣ 创建新策略...')
    const createSQL = `
      CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
          FOR UPDATE
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id)
    `

    console.log('')
    console.log('❌ 无法通过 API 直接执行 DDL 语句')
    console.log('')
    console.log('📌 请手动执行以下步骤:')
    console.log('')
    console.log('1. 打开 Supabase Dashboard:')
    console.log('   https://supabase.com/dashboard/project/guwtnzcumkqsdcwrmdta')
    console.log('')
    console.log('2. 打开 SQL Editor (左侧菜单)')
    console.log('')
    console.log('3. 复制并执行以下 SQL:')
    console.log('─'.repeat(60))
    console.log(sql)
    console.log('─'.repeat(60))
    console.log('')
    console.log('4. 点击 "Run" 按钮')
    console.log('')
    console.log('详细说明请参阅: FIX_RLS_GUIDE.md')
    console.log('')

  } catch (error) {
    console.error('❌ 错误:', error.message)
    process.exit(1)
  }
}

applyFix()
