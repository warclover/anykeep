/**
 * User Stage Service
 * Manages user classification lifecycle stages
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { ClassificationStage } from '../types'
import type { IUserStageService } from './interfaces'
import { USER_LIFECYCLE_THRESHOLDS } from '../constants'

/**
 * Service for determining and managing user classification stages
 */
export class UserStageService implements IUserStageService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get user's classification stage
   */
  async getStage(userId: string): Promise<ClassificationStage> {
    const { data, error } = await this.supabase.rpc('get_user_classification_stage', {
      p_user_id: userId,
    })

    if (error) {
      throw new Error(`Failed to get user stage: ${error.message}`)
    }

    return (data as ClassificationStage) || 'onboarding'
  }

  /**
   * Check if user is in cold start phase
   */
  async isInColdStart(userId: string): Promise<boolean> {
    const stage = await this.getStage(userId)
    return stage === 'onboarding' || stage === 'cold_start'
  }

  /**
   * Get stage from bookmark count (client-side calculation)
   */
  getStageFromCount(
    bookmarkCount: number,
    onboardingCompleted: boolean
  ): ClassificationStage {
    if (!onboardingCompleted && bookmarkCount === 0) {
      return 'onboarding'
    }
    if (bookmarkCount <= USER_LIFECYCLE_THRESHOLDS.COLD_START_MAX) {
      return 'cold_start'
    }
    if (bookmarkCount <= USER_LIFECYCLE_THRESHOLDS.GROWING_MAX) {
      return 'growing'
    }
    return 'mature'
  }

  /**
   * Get stage description for UI
   */
  getStageDescription(stage: ClassificationStage): {
    title: string
    description: string
    tip: string
  } {
    switch (stage) {
      case 'onboarding':
        return {
          title: '新手入门',
          description: '欢迎使用 AnyKeep！选择你的兴趣领域，让我们帮你创建初始文件夹。',
          tip: '选择 2-5 个兴趣领域可以获得最佳体验',
        }
      case 'cold_start':
        return {
          title: '冷启动期',
          description: '继续收藏内容，系统正在学习你的偏好。目前书签将放入「待整理」文件夹。',
          tip: '收藏超过 20 条后，系统将开始智能分类',
        }
      case 'growing':
        return {
          title: '成长期',
          description: '系统已开始学习你的分类偏好，高置信度的书签将自动分类。',
          tip: '定期整理「待整理」文件夹可以帮助系统更好地学习',
        }
      case 'mature':
        return {
          title: '成熟期',
          description: '系统已充分了解你的偏好，大部分书签将自动准确分类。',
          tip: '你可以手动调整分类来进一步优化推荐',
        }
    }
  }
}
