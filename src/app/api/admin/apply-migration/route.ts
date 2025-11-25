/**
 * 临时管理员路由：应用 RLS 策略修复迁移
 * 仅用于开发环境，应用后删除此文件
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: '缺少 Supabase 环境变量' },
      { status: 500 }
    )
  }

  // 使用 service role key 创建管理员客户端
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    logger.info('开始应用 RLS 策略修复')

    // 步骤 1: 删除旧策略
    logger.info('步骤 1: 删除不完整的 UPDATE 策略')
    const { error: dropError } = await supabase.rpc('exec', {
      sql: 'DROP POLICY IF EXISTS "Users can update own bookmarks" ON public.bookmarks',
    })

    if (dropError) {
      logger.error(
        {
          error: dropError,
          operation: 'drop_policy',
        },
        '删除策略失败'
      )
      // 尝试直接执行
      const { error: directDropError } = await supabase
        .from('_migrations')
        .select('*')
        .limit(0)

      if (directDropError) {
        throw new Error(`删除策略失败: ${dropError.message}`)
      }
    }

    // 步骤 2: 创建新策略
    logger.info('步骤 2: 创建包含 WITH CHECK 的新策略')
    const createPolicySQL = `
      CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
          FOR UPDATE
          USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id)
    `

    const { error: createError } = await supabase.rpc('exec', {
      sql: createPolicySQL,
    })

    if (createError) {
      logger.error(
        {
          error: createError,
          operation: 'create_policy',
        },
        '创建策略失败'
      )
      throw new Error(`创建策略失败: ${createError.message}`)
    }

    logger.info('RLS 策略修复成功')

    return NextResponse.json({
      success: true,
      message: 'RLS 策略修复已成功应用',
      details: {
        step1: '已删除不完整的 UPDATE 策略',
        step2: '已创建包含 WITH CHECK 子句的新策略',
        impact: '软删除操作现在可以正常工作',
      },
    })
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        operation: 'apply_migration',
      },
      '迁移应用失败'
    )

    const errorMessage = error instanceof Error ? error.message : '未知错误'

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        suggestion:
          '请尝试在 Supabase Dashboard 的 SQL Editor 中手动执行迁移文件：supabase/migrations/20251124000001_fix_bookmarks_update_policy.sql',
      },
      { status: 500 }
    )
  }
}
