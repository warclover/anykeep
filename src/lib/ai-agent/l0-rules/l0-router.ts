/**
 * L0 路由器 - 极简版
 *
 * 设计原则：
 * 1. 纯规则匹配，无 LLM 调用
 * 2. 返回 null 表示需要走 LLM 路由
 * 3. 长度逃逸：超过阈值的复杂请求交给 LLM
 *
 * @version 1.0.0
 * @since 2026-01-12
 */

import { L0_RULES, type L0Rule } from "./rule-definitions";
import { FeatureFlags } from "../config/feature-flags";
import { logger } from "@/lib/logger";
import type { IntentType } from "@/lib/shared/types";

const log = logger.child({ namespace: "l0-router" });

/**
 * 最大输入长度阈值
 * 超过此长度的请求被认为是复杂请求，交给 LLM 处理
 */
const MAX_INPUT_LENGTH = 50;

/**
 * L0 匹配置信度
 * L0 规则匹配成功时的固定置信度
 */
const L0_CONFIDENCE = 0.95;

/**
 * L0 匹配结果
 */
export interface L0MatchResult {
  /** 是否匹配成功 */
  matched: boolean;
  /** 匹配的规则 */
  rule?: L0Rule;
  /** 提取的参数 */
  params?: Record<string, unknown>;
  /** 置信度 */
  confidence: number;
  /** 调试信息 */
  debug?: {
    ruleId?: string;
    patternIndex?: number;
    inputLength: number;
    skipReason?: string;
  };
}

/**
 * L0 路由器类
 */
class L0Router {
  /**
   * 尝试 L0 匹配
   *
   * @param input - 用户输入
   * @returns 匹配结果，matched=false 表示需要走 LLM 路由
   */
  tryMatch(input: string): L0MatchResult {
    const normalizedInput = input.trim();
    const inputLength = normalizedInput.length;

    // 0. 检查 Feature Flag
    if (!FeatureFlags.ENABLE_INTENT_DRIVEN_TOOLS) {
      return {
        matched: false,
        confidence: 0,
        debug: {
          inputLength,
          skipReason: "feature_disabled",
        },
      };
    }

    // 1. 空输入检查
    if (inputLength === 0) {
      return {
        matched: false,
        confidence: 0,
        debug: {
          inputLength: 0,
          skipReason: "empty_input",
        },
      };
    }

    // 2. 长度逃逸：超过阈值的复杂请求交给 LLM
    if (inputLength > MAX_INPUT_LENGTH) {
      log.debug(
        {
          inputLength,
          threshold: MAX_INPUT_LENGTH,
        },
        "L0 skip: input too long",
      );
      return {
        matched: false,
        confidence: 0,
        debug: {
          inputLength,
          skipReason: "input_too_long",
        },
      };
    }

    // 3. 遍历规则尝试匹配
    for (const rule of L0_RULES) {
      for (
        let patternIndex = 0;
        patternIndex < rule.patterns.length;
        patternIndex++
      ) {
        const pattern = rule.patterns[patternIndex];
        const match = normalizedInput.match(pattern);

        if (match) {
          const params = rule.paramExtractor(match, normalizedInput);

          log.info(
            {
              ruleId: rule.id,
              ruleName: rule.name,
              intentType: rule.intentType,
              toolId: rule.toolId,
              params,
              inputPreview: normalizedInput.substring(0, 30),
            },
            "L0 rule matched",
          );

          return {
            matched: true,
            rule,
            params,
            confidence: L0_CONFIDENCE,
            debug: {
              ruleId: rule.id,
              patternIndex,
              inputLength,
            },
          };
        }
      }
    }

    // 4. 无匹配
    log.debug(
      {
        inputPreview: normalizedInput.substring(0, 30),
        inputLength,
      },
      "L0 no match, fallback to LLM",
    );

    return {
      matched: false,
      confidence: 0,
      debug: {
        inputLength,
        skipReason: "no_pattern_match",
      },
    };
  }

  /**
   * 检查是否为 L0 可处理的请求（不执行匹配）
   *
   * @param input - 用户输入
   * @returns 是否可能是 L0 请求
   */
  isL0Candidate(input: string): boolean {
    const normalizedInput = input.trim();

    // 长度检查
    if (
      normalizedInput.length === 0 ||
      normalizedInput.length > MAX_INPUT_LENGTH
    ) {
      return false;
    }

    // 快速关键词检查（不进行完整正则匹配）
    const quickPatterns = [
      /多少/,
      /统计/,
      /查看/,
      /看看/,
      /列表/,
      /搜索/,
      /找/,
      /最近/,
      /文件夹/,
      /标签/,
    ];

    return quickPatterns.some((p) => p.test(normalizedInput));
  }

  /**
   * 获取路由器统计信息
   */
  getStats(): {
    ruleCount: number;
    maxInputLength: number;
    l0Confidence: number;
  } {
    return {
      ruleCount: L0_RULES.length,
      maxInputLength: MAX_INPUT_LENGTH,
      l0Confidence: L0_CONFIDENCE,
    };
  }
}

/**
 * L0 路由匹配结果转换为意图路由结果
 */
export interface L0RouteResult {
  /** 执行模式 */
  mode: "atomic";
  /** 意图类型 */
  intentType: IntentType;
  /** 意图子类型 */
  intentSubType?: string;
  /** 工具 ID */
  toolId: string;
  /** 工具参数 */
  params: Record<string, unknown>;
  /** 置信度 */
  confidence: number;
  /** 来源标识 */
  source: "l0_rule";
  /** 规则 ID */
  ruleId: string;
}

/**
 * 将 L0 匹配结果转换为路由结果
 */
export function toL0RouteResult(result: L0MatchResult): L0RouteResult | null {
  if (!result.matched || !result.rule) {
    return null;
  }

  return {
    mode: "atomic",
    intentType: result.rule.intentType,
    toolId: result.rule.toolId,
    params: result.params || {},
    confidence: result.confidence,
    source: "l0_rule",
    ruleId: result.rule.id,
  };
}

// 导出单例
export const l0Router = new L0Router();
