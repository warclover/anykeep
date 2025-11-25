/**
 * AI 文件夹推荐 API
 * POST /api/ai/recommend-folder - 根据内容推荐文件夹
 */

import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { recommendFolder, type FolderRecommendation } from '@/lib/utils/ai-generator'
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  databaseError,
  internalError,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/logger'

/**
 * 请求体验证 Schema
 */
const recommendFolderSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(500),
  summary: z.string().max(1000).optional().default(''),
  tags: z.array(z.string()).max(10).optional().default([]),
})

/**
 * POST /api/ai/recommend-folder
 * 根据收藏内容推荐合适的文件夹
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return unauthorizedError('请先登录')
    }

    // 2. 解析并验证请求体
    const body = await request.json()
    const validation = recommendFolderSchema.safeParse(body)

    if (!validation.success) {
      return handleValidationError(validation.error)
    }

    const { title, summary, tags } = validation.data

    // 3. 获取用户的所有文件夹
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('id, name')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (foldersError) {
      return databaseError('获取文件夹列表失败', foldersError)
    }

    // 4. 调用 AI 推荐
    const recommendation: FolderRecommendation = await recommendFolder(
      title,
      summary,
      tags,
      folders || []
    )

    logger.info(
      {
        userId: user.id,
        title: title.substring(0, 50),
        recommendation: {
          folderId: recommendation.folderId,
          folderName: recommendation.folderName,
          confidence: recommendation.confidence,
          suggestNew: recommendation.suggestNew,
        },
      },
      'AI folder recommendation completed'
    )

    // 5. 返回推荐结果
    return successResponse(recommendation)
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'POST /api/ai/recommend-folder error'
    )
    return internalError('文件夹推荐失败')
  }
}
