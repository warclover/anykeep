/**
 * 复习优先级计算器
 * 根据多种因素计算 Flashcard 的复习优先级
 *
 * @module shared/review/priority-calculator
 */

import type { ReviewQueueItem } from "./types";
import { SM2Algorithm } from "./sm2-algorithm";

/**
 * 优先级权重配置
 */
const PRIORITY_WEIGHTS = {
  /** 逾期天数权重 */
  overdue: 0.4,
  /** 难度权重（基于 ease factor） */
  difficulty: 0.3,
  /** 间隔倒数权重（间隔越短优先级越高） */
  intervalInverse: 0.2,
  /** 遗忘风险权重 */
  forgettingRisk: 0.1,
};

/**
 * 计算单个 Flashcard 的优先级分数
 * @param item 复习队列项
 * @returns 优先级分数 (0-100)
 */
export function calculatePriority(item: ReviewQueueItem): number {
  const { daysOverdue, easeFactor, intervalDays, nextReviewAt } = item;

  // 1. 逾期分数 (0-40)
  // 逾期越多分数越高，最高 40 分
  const overdueScore = Math.min(40, Math.max(0, daysOverdue * 2));

  // 2. 难度分数 (0-30)
  // ease factor 越低越难，分数越高
  // ease factor 范围: 1.3-2.5，转换为 0-30
  const difficultyScore = ((2.5 - easeFactor) / 1.2) * 30;

  // 3. 间隔倒数分数 (0-20)
  // 间隔越短，分数越高
  const intervalScore = Math.min(20, (1 / Math.max(1, intervalDays)) * 100);

  // 4. 遗忘风险分数 (0-10)
  const forgettingRisk = SM2Algorithm.calculateForgettingRisk(
    nextReviewAt ? new Date(nextReviewAt) : null,
    intervalDays,
  );
  const forgettingScore = forgettingRisk * 10;

  // 综合计算
  const totalScore =
    overdueScore * PRIORITY_WEIGHTS.overdue +
    difficultyScore * PRIORITY_WEIGHTS.difficulty +
    intervalScore * PRIORITY_WEIGHTS.intervalInverse +
    forgettingScore * PRIORITY_WEIGHTS.forgettingRisk;

  // 归一化到 0-100
  return Math.min(100, Math.max(0, totalScore));
}

/**
 * 对复习队列按优先级排序
 * @param items 复习队列项数组
 * @returns 排序后的数组（优先级从高到低）
 */
export function sortByPriority(items: ReviewQueueItem[]): ReviewQueueItem[] {
  return [...items].sort((a, b) => {
    const priorityA = calculatePriority(a);
    const priorityB = calculatePriority(b);
    return priorityB - priorityA;
  });
}

/**
 * 筛选出高优先级的项目
 * @param items 复习队列项数组
 * @param threshold 优先级阈值 (0-100)
 * @returns 高优先级项目数组
 */
export function filterHighPriority(
  items: ReviewQueueItem[],
  threshold: number = 30,
): ReviewQueueItem[] {
  return items.filter((item) => calculatePriority(item) >= threshold);
}

/**
 * 获取今日到期的项目
 * @param items 复习队列项数组
 * @returns 今日到期的项目
 */
export function getDueToday(items: ReviewQueueItem[]): ReviewQueueItem[] {
  return items.filter((item) => item.daysOverdue >= 0);
}

/**
 * 获取逾期的项目
 * @param items 复习队列项数组
 * @returns 逾期项目（按逾期天数降序）
 */
export function getOverdue(items: ReviewQueueItem[]): ReviewQueueItem[] {
  return items
    .filter((item) => item.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/**
 * 智能选择本周复习项目
 * @param items 所有待复习项目
 * @param weeklyLimit 每周上限
 * @returns 本周应复习的项目
 */
export function selectWeeklyReviewItems(
  items: ReviewQueueItem[],
  weeklyLimit: number,
): ReviewQueueItem[] {
  // 1. 先按优先级排序
  const sorted = sortByPriority(items);

  // 2. 优先选择逾期项目
  const overdue = sorted.filter((item) => item.daysOverdue > 0);
  const notOverdue = sorted.filter((item) => item.daysOverdue <= 0);

  // 3. 组合结果
  const selected: ReviewQueueItem[] = [];

  // 先加入逾期项目
  for (const item of overdue) {
    if (selected.length >= weeklyLimit) break;
    selected.push(item);
  }

  // 再加入未逾期但优先级高的项目
  for (const item of notOverdue) {
    if (selected.length >= weeklyLimit) break;
    selected.push(item);
  }

  return selected;
}

/**
 * 计算复习队列的统计信息
 * @param items 复习队列项数组
 * @returns 统计信息
 */
export function calculateQueueStats(items: ReviewQueueItem[]): {
  total: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
  avgPriority: number;
  avgEaseFactor: number;
} {
  if (items.length === 0) {
    return {
      total: 0,
      overdue: 0,
      dueToday: 0,
      upcoming: 0,
      avgPriority: 0,
      avgEaseFactor: 0,
    };
  }

  const overdue = items.filter((i) => i.daysOverdue > 0).length;
  const dueToday = items.filter((i) => i.daysOverdue === 0).length;
  const upcoming = items.filter((i) => i.daysOverdue < 0).length;

  const priorities = items.map(calculatePriority);
  const avgPriority = priorities.reduce((a, b) => a + b, 0) / priorities.length;

  const avgEaseFactor =
    items.reduce((sum, i) => sum + i.easeFactor, 0) / items.length;

  return {
    total: items.length,
    overdue,
    dueToday,
    upcoming,
    avgPriority: Number(avgPriority.toFixed(1)),
    avgEaseFactor: Number(avgEaseFactor.toFixed(2)),
  };
}
