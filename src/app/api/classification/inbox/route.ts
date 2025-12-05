/**
 * 待整理智能整理 API
 * GET /api/classification/inbox - 分析待整理文件夹
 * POST /api/classification/inbox - 应用整理建议
 * DELETE /api/classification/inbox - 拒绝整理建议
 */

import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ClassificationContainer } from '@/lib/classification'
import {
  successResponse,
  handleValidationError,
  unauthorizedError,
  notFoundError,
  internalError,
} from '@/lib/utils/api-response'
import { logger } from '@/lib/logger'

/**
 * 应用建议 Schema
 */
const applySuggestionSchema = z.object({
  suggestionId: z.number().int().positive(),
})

/**
 * 拒绝建议 Schema
 */
const rejectSuggestionSchema = z.object({
  suggestionId: z.number().int().positive(),
})

/**
 * GET /api/classification/inbox
 * 分析待整理文件夹，生成整理建议
 */
export async function GET() {
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

    // 2. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase)
    const inboxOrganizerService = container.getInboxOrganizerService()

    // 3. 分析待整理文件夹
    const analysis = await inboxOrganizerService.analyze(user.id)

    logger.info(
      {
        userId: user.id,
        inboxCount: analysis.inboxCount,
        suggestionCount: analysis.suggestions.length,
      },
      'Inbox analysis completed'
    )

    // 4. 返回分析结果
    return successResponse(analysis)
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'GET /api/classification/inbox error'
    )
    return internalError('分析待整理文件夹失败')
  }
}

/**
 * POST /api/classification/inbox
 * 应用整理建议
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
    const validation = applySuggestionSchema.safeParse(body)

    if (!validation.success) {
      return handleValidationError(validation.error)
    }

    const { suggestionId } = validation.data

    // 3. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase)
    const inboxOrganizerService = container.getInboxOrganizerService()

    // 4. 应用建议
    try {
      await inboxOrganizerService.applySuggestion(user.id, suggestionId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('not found') || message.includes('Unauthorized')) {
        return notFoundError('建议不存在或已过期')
      }
      throw error
    }

    logger.info(
      {
        userId: user.id,
        suggestionId,
      },
      'Suggestion applied'
    )

    // 5. 返回成功
    return successResponse({ success: true })
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'POST /api/classification/inbox error'
    )
    return internalError('应用建议失败')
  }
}

/**
 * DELETE /api/classification/inbox
 * 拒绝整理建议
 */
export async function DELETE(request: NextRequest) {
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
    const validation = rejectSuggestionSchema.safeParse(body)

    if (!validation.success) {
      return handleValidationError(validation.error)
    }

    const { suggestionId } = validation.data

    // 3. 初始化分类容器并获取服务
    const container = ClassificationContainer.initialize(supabase)
    const inboxOrganizerService = container.getInboxOrganizerService()

    // 4. 拒绝建议
    try {
      await inboxOrganizerService.rejectSuggestion(user.id, suggestionId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('not found') || message.includes('Unauthorized')) {
        return notFoundError('建议不存在或已过期')
      }
      throw error
    }

    logger.info(
      {
        userId: user.id,
        suggestionId,
      },
      'Suggestion rejected'
    )

    // 5. 返回成功
    return successResponse({ success: true })
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'DELETE /api/classification/inbox error'
    )
    return internalError('拒绝建议失败')
  }
}
