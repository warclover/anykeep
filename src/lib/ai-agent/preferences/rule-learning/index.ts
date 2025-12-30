/**
 * 规则学习模块导出
 *
 * @module ai-agent/preferences/rule-learning
 */

export { RuleExtractor, createRuleExtractor } from "./rule-extractor";

export type {
  RuleExtractorConfig,
  ExtractedRule,
  RuleCandidate,
  CorrectionPattern,
  RuleType,
  RuleCondition,
  RuleAction,
  TimeCondition,
  ContextCondition,
  RuleApplicationResult,
  IRuleExtractor,
} from "./types";

export { DEFAULT_EXTRACTOR_CONFIG, LOG_MODULE } from "./types";
