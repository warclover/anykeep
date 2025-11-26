/**
 * 重分类检查 API
 * GET /api/reclassify/check
 *
 * 检查是否需要触发重分类：
 * 1. 待整理文件夹中的书签数量是否达到阈值
 * 2. 距离上次重分类是否超过一周
 * 3. 是否有待处理的建议
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  successResponse,
  unauthorizedError,
  internalError,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/logger'
import type { ReclassifySettings } from '@/types/supabase'

// 默认配置
const DEFAULT_INBOX_THRESHOLD = 10 // 待整理达到 10 条时触发
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000 // 一周的毫秒数

export async function GET(_request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return unauthorizedError()
    }

    // 2. 获取用户的重分类配置
    const { data: profile } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .single()

    const settings = (profile?.settings as Record<string, unknown>)?.reclassify as ReclassifySettings | undefined
    const inboxThreshold = settings?.inbox_threshold ?? DEFAULT_INBOX_THRESHOLD
    const lastRunAt = settings?.last_run_at ? new Date(settings.last_run_at) : null
    const autoRunWeekly = settings?.auto_run_weekly ?? true

    // 3. 获取待整理文件夹中的书签数量
    const { data: inboxFolder } = await supabase
      .from('folders')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_system', true)
      .eq('system_type', 'INBOX')
      .is('deleted_at', null)
      .single()

    let inboxCount = 0
    if (inboxFolder) {
      const { count } = await supabase
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('folder_id', inboxFolder.id)
        .is('deleted_at', null)

      inboxCount = count ?? 0
    }

    // 4. 获取待处理建议数量
    const { data: pendingCount } = await supabase.rpc('get_pending_suggestions_count', {
      p_user_id: user.id,
    })

    // 5. 判断触发条件
    const now = new Date()
    const needsWeeklyRun = autoRunWeekly && lastRunAt
      ? (now.getTime() - lastRunAt.getTime()) > WEEK_IN_MS
      : false
    const needsThresholdRun = inboxCount >= inboxThreshold
    const shouldTrigger = (needsWeeklyRun || needsThresholdRun) && pendingCount === 0

    return successResponse({
      shouldTrigger,
      hasPendingSuggestions: (pendingCount ?? 0) > 0,
      pendingSuggestionsCount: pendingCount ?? 0,
      triggers: {
        weekly: needsWeeklyRun,
        threshold: needsThresholdRun,
      },
      stats: {
        inboxCount,
        inboxThreshold,
        lastRunAt: lastRunAt?.toISOString() ?? null,
        daysSinceLastRun: lastRunAt
          ? Math.floor((now.getTime() - lastRunAt.getTime()) / (24 * 60 * 60 * 1000))
          : null,
      },
    })
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'GET /api/reclassify/check error'
    )
    return internalError('检查重分类状态失败')
  }
}
