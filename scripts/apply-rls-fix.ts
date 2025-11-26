/**
 * 应用 RLS 策略修复迁移
 * 修复 DELETE API 的 RLS 策略问题
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少 Supabase 环境变量')
  console.error('需要: NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function applyMigration() {
  try {
    console.log('📋 读取迁移文件...')
    const migrationPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '20251124000001_fix_bookmarks_update_policy.sql'
    )
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    console.log('🔧 应用 RLS 策略修复...')
    console.log('SQL:')
    console.log(sql)
    console.log('')

    // 执行 SQL
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql })

    if (error) {
      // 如果 rpc 方法不存在，尝试直接执行
      console.log('⚠️  RPC 方法不可用，尝试直接执行 SQL...')

      // 分割 SQL 语句
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith('--'))

      for (const statement of statements) {
        if (statement) {
          console.log('执行:', statement.substring(0, 100) + '...')
          const { error: execError } = await supabase.rpc('exec', {
            sql: statement,
          })

          if (execError) {
            console.error('❌ 执行失败:', execError.message)
            throw execError
          }
        }
      }
    }

    console.log('✅ RLS 策略修复成功应用！')
    console.log('')
    console.log('修复内容:')
    console.log('- 删除了不完整的 UPDATE 策略')
    console.log('- 重新创建了包含 WITH CHECK 子句的 UPDATE 策略')
    console.log('- 现在软删除操作（UPDATE deleted_at）可以正常工作')
    console.log('')
    console.log('下一步: 测试 DELETE 功能')
  } catch (error) {
    console.error('❌ 迁移应用失败:', error)
    process.exit(1)
  }
}

applyMigration()
