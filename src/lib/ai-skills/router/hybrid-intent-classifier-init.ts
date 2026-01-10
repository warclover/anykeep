/**
 * HybridIntentClassifier 初始化辅助函数
 *
 * 用于在应用启动时初始化语义匹配器
 *
 * @version 1.0.0
 * @since 2026-01-09
 */

import { logger } from "@/lib/logger";
import { HybridIntentClassifier } from "./hybrid-intent-classifier";
import type { IntentRule } from "./types";
import { DEFAULT_RULES } from "./intent-classifier";

/**
 * 初始化 HybridIntentClassifier
 *
 * @param rules - 意图规则列表（可选，默认使用 DEFAULT_RULES）
 * @returns 初始化后的分类器
 */
export async function initializeHybridIntentClassifier(
  rules?: IntentRule[],
): Promise<HybridIntentClassifier> {
  const classifier = new HybridIntentClassifier({
    enableSemanticMatching: true,
    debug: process.env.NODE_ENV === "development",
  });

  const rulesToUse = rules || DEFAULT_RULES;

  try {
    await classifier.initialize(rulesToUse);
    logger.info(
      {
        ruleCount: rulesToUse.length,
        semanticStatus: classifier.getSemanticMatcherStatus(),
      },
      "HybridIntentClassifier initialized successfully",
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      "HybridIntentClassifier initialization failed",
    );
    // 即使初始化失败，也返回分类器（会回退到纯规则匹配）
  }

  return classifier;
}
