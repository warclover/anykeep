/**
 * SuperMemo SM-2 间隔重复算法
 *
 * 核心公式:
 * - EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
 * - I(1) = 1, I(2) = 3, I(n) = I(n-1) * EF  (for n > 2, q >= 3)
 *
 * 其中:
 * - EF: Easiness Factor (难度因子), 范围 1.3-2.5
 * - q: Quality of response (回忆质量), 范围 0-5
 * - I(n): 第 n 次复习的间隔天数
 *
 * @module shared/review/sm2-algorithm
 */

import type { SM2Input, SM2Output, ReviewResponse } from "./types";

export class SM2Algorithm {
  /** 最小难度因子 */
  private static readonly MIN_EASE_FACTOR = 1.3;
  /** 最大难度因子 */
  private static readonly MAX_EASE_FACTOR = 2.5;
  /** 最大间隔天数（AnyKeep 限制） */
  private static readonly MAX_INTERVAL = 90;

  /**
   * 计算下次复习参数
   * @param input SM-2 算法输入参数
   * @returns SM-2 算法输出结果
   * @throws 当 quality 不在 0-5 范围内时抛出错误
   */
  static calculate(input: SM2Input): SM2Output {
    const { quality, repetitions, easeFactor, interval } = input;

    // 验证输入
    if (quality < 0 || quality > 5) {
      throw new Error(`Invalid quality: ${quality}. Must be 0-5.`);
    }

    // 质量 < 3 表示遗忘，重置复习进度
    if (quality < 3) {
      return {
        interval: 1,
        repetitions: 0,
        easeFactor: Math.max(this.MIN_EASE_FACTOR, easeFactor - 0.2),
      };
    }

    // 计算新的难度因子
    // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
    const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    const newEaseFactor = Math.max(
      this.MIN_EASE_FACTOR,
      Math.min(this.MAX_EASE_FACTOR, easeFactor + efDelta),
    );

    // 计算新间隔
    let newInterval: number;
    if (repetitions === 0) {
      newInterval = 1; // 第一次：1天
    } else if (repetitions === 1) {
      newInterval = 3; // 第二次：3天
    } else if (repetitions === 2) {
      newInterval = 7; // 第三次：7天（符合1-3-7）
    } else {
      newInterval = Math.round(interval * newEaseFactor);
    }

    // 限制最大间隔
    newInterval = Math.min(newInterval, this.MAX_INTERVAL);

    return {
      interval: newInterval,
      repetitions: repetitions + 1,
      easeFactor: Number(newEaseFactor.toFixed(2)),
    };
  }

  /**
   * 将用户反馈转换为 SM-2 质量分数
   * @param response 用户反馈
   * @returns 质量分数 (0-5)
   */
  static responseToQuality(response: ReviewResponse): number {
    const mapping: Record<ReviewResponse, number> = {
      mastered: 5, // 完美回忆
      fuzzy: 3, // 勉强回忆
      forgotten: 0, // 完全遗忘
      archived: 5, // 归档视为完全掌握
    };
    return mapping[response];
  }

  /**
   * 将质量分数转换为用户反馈类型
   * @param quality 质量分数
   * @returns 用户反馈类型
   */
  static qualityToResponse(quality: number): ReviewResponse {
    if (quality >= 4) return "mastered";
    if (quality >= 3) return "fuzzy";
    return "forgotten";
  }

  /**
   * 预测下次复习日期
   * @param interval 间隔天数
   * @returns 下次复习日期
   */
  static predictNextReview(interval: number): Date {
    const next = new Date();
    next.setDate(next.getDate() + interval);
    next.setHours(9, 0, 0, 0); // 默认设置为上午9点
    return next;
  }

  /**
   * 计算遗忘风险 (0-1)
   * 基于距离下次复习时间的比例
   * @param nextReviewAt 下次复习时间
   * @param intervalDays 当前间隔天数
   * @returns 遗忘风险值
   */
  static calculateForgettingRisk(
    nextReviewAt: Date | null,
    intervalDays: number,
  ): number {
    if (!nextReviewAt) return 0;

    const now = new Date();
    const daysUntilReview =
      (nextReviewAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    // 逾期越多，风险越高
    if (daysUntilReview <= 0) {
      // 逾期：风险 = 0.5 + 0.5 * (逾期天数 / 间隔天数)
      const overdueDays = Math.abs(daysUntilReview);
      return Math.min(1, 0.5 + (0.5 * overdueDays) / intervalDays);
    }

    // 未到期：风险 = 0.5 * (1 - 剩余天数 / 间隔天数)
    return Math.max(0, 0.5 * (1 - daysUntilReview / intervalDays));
  }

  /**
   * 简化版 1-3-7-14-30-60-90 调度（用于新手模式）
   * @param repetitions 复习次数
   * @returns 下次间隔天数
   */
  static simpleSchedule(repetitions: number): number {
    const schedule = [1, 3, 7, 14, 30, 60, 90];
    return schedule[Math.min(repetitions, schedule.length - 1)];
  }

  /**
   * 根据用户反馈计算完整的 SM-2 更新结果
   * @param response 用户反馈
   * @param currentState 当前状态
   * @returns SM-2 输出结果
   */
  static calculateFromResponse(
    response: ReviewResponse,
    currentState: {
      repetitions: number;
      easeFactor: number;
      intervalDays: number;
    },
  ): SM2Output {
    const quality = this.responseToQuality(response);
    return this.calculate({
      quality,
      repetitions: currentState.repetitions,
      easeFactor: currentState.easeFactor,
      interval: currentState.intervalDays,
    });
  }
}
