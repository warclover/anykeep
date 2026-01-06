/**
 * Knowledge Studio v2 - 时间与字数预估器
 * @module knowledge-studio/v2
 *
 * Phase 2.2: 提供生成时间和字数预估功能
 */

import type { BlueprintOutline, OutlineNode } from "../blueprint/types";
import { LENGTH_MODE_CONFIG, type LengthMode } from "./constants";

// ============================================================
// Types
// ============================================================

/**
 * 预估结果
 */
export interface GenerationEstimate {
  /** 预估字数范围 */
  words: {
    min: number;
    max: number;
    /** 预估中位数 */
    estimated: number;
  };
  /** 预估时间范围（秒） */
  time: {
    min: number;
    max: number;
    /** 显示文本 */
    display: string;
  };
  /** 素材数量 */
  materialCount: number;
  /** 章节数量 */
  sectionCount: number;
  /** 长度模式 */
  lengthMode: LengthMode;
  /** 长度模式显示名称 */
  lengthModeLabel: string;
}

// ============================================================
// Constants
// ============================================================

/** 每章节预估字数（按模式） */
const WORDS_PER_SECTION = {
  short: 300,
  medium: 450,
  long: 600,
} as const;

/** 基础生成时间（秒） */
const BASE_GENERATION_TIME = 30;

/** 每千字额外时间（秒） */
const TIME_PER_1000_WORDS = 20;

/** 每篇素材额外时间（秒） */
const TIME_PER_MATERIAL = 5;

// ============================================================
// Utility Functions
// ============================================================

/**
 * 统计大纲章节总数
 */
export function countSections(outline: BlueprintOutline): number {
  function countNodes(nodes: OutlineNode[]): number {
    let count = nodes.length;
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        count += countNodes(node.children);
      }
    }
    return count;
  }
  return countNodes(outline.nodes);
}

/**
 * 计算大纲已有的预估字数
 */
function getOutlineEstimatedWords(outline: BlueprintOutline): number {
  if (outline.totalEstimatedWords) {
    return outline.totalEstimatedWords;
  }

  function sumWords(nodes: OutlineNode[]): number {
    let total = 0;
    for (const node of nodes) {
      total += node.estimatedWords ?? 0;
      if (node.children) {
        total += sumWords(node.children);
      }
    }
    return total;
  }

  return sumWords(outline.nodes);
}

// ============================================================
// Main Functions
// ============================================================

/**
 * 根据大纲章节数和目标长度估算输出字数
 *
 * @param outline - 大纲数据
 * @param targetLength - 目标长度模式
 * @returns 预估字数范围
 */
export function estimateOutputWords(
  outline: BlueprintOutline,
  targetLength: LengthMode,
): { min: number; max: number; estimated: number } {
  const sectionCount = countSections(outline);
  const config = LENGTH_MODE_CONFIG[targetLength];

  // 优先使用大纲自带的预估字数
  const outlineEstimate = getOutlineEstimatedWords(outline);
  if (outlineEstimate > 0) {
    return {
      min: Math.max(config.minWords, Math.floor(outlineEstimate * 0.8)),
      max: Math.min(config.maxWords, Math.ceil(outlineEstimate * 1.2)),
      estimated: outlineEstimate,
    };
  }

  // 根据章节数估算
  const perSectionWords = WORDS_PER_SECTION[targetLength];
  const estimated = sectionCount * perSectionWords;

  return {
    min: Math.max(config.minWords, Math.floor(estimated * 0.8)),
    max: Math.min(config.maxWords, Math.ceil(estimated * 1.2)),
    estimated: Math.round((config.minWords + config.maxWords) / 2),
  };
}

/**
 * 估算生成时间
 *
 * @param estimatedWords - 预估字数
 * @param materialCount - 素材数量
 * @returns 时间范围（秒）和显示文本
 */
export function estimateGenerationTime(
  estimatedWords: number,
  materialCount: number,
): { min: number; max: number; display: string } {
  const wordsTime = (estimatedWords / 1000) * TIME_PER_1000_WORDS;
  const materialsTime = materialCount * TIME_PER_MATERIAL;
  const baseTime = BASE_GENERATION_TIME + wordsTime + materialsTime;

  const min = Math.floor(baseTime * 0.7);
  const max = Math.ceil(baseTime * 1.5);

  // 格式化显示
  let display: string;
  if (max < 60) {
    display = `约 ${min}-${max} 秒`;
  } else {
    const minMinutes = Math.floor(min / 60);
    const maxMinutes = Math.ceil(max / 60);
    if (minMinutes === maxMinutes) {
      display = `约 ${minMinutes} 分钟`;
    } else {
      display = `约 ${minMinutes}-${maxMinutes} 分钟`;
    }
  }

  return { min, max, display };
}

/**
 * 获取完整的生成预估信息
 *
 * @param outline - 大纲数据
 * @param targetLength - 目标长度模式
 * @param materialCount - 素材数量
 * @returns 完整预估结果
 */
export function getGenerationEstimate(
  outline: BlueprintOutline,
  targetLength: LengthMode,
  materialCount: number,
): GenerationEstimate {
  const sectionCount = countSections(outline);
  const words = estimateOutputWords(outline, targetLength);
  const time = estimateGenerationTime(words.estimated, materialCount);
  const config = LENGTH_MODE_CONFIG[targetLength];

  return {
    words,
    time,
    materialCount,
    sectionCount,
    lengthMode: targetLength,
    lengthModeLabel: config.label,
  };
}

/**
 * 格式化字数显示
 *
 * @param words - 字数范围
 * @returns 格式化文本
 */
export function formatWordsDisplay(words: {
  min: number;
  max: number;
}): string {
  return `约 ${words.min.toLocaleString()}-${words.max.toLocaleString()} 字`;
}
