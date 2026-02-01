/**
 * Intent 模块入口
 *
 * 意图分析相关功能的统一入口
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

// 分类器接口
export {
  type IntentClassifier,
  type ClassifierChainConfig,
  type ClassifierMetadata,
  type ClassifierConstructor,
  type ClassifierRegistration,
  CONFIDENCE_THRESHOLDS,
} from "./classifier-interface";

// 分类器链
export { ClassifierChain, createClassifierChain } from "./classifier-chain";

// 分类器适配器
export {
  RuleBasedClassifier,
  createRuleBasedClassifier,
  type RuleBasedClassifierConfig,
} from "./rule-based-classifier";

export {
  SemanticClassifier,
  createSemanticClassifier,
  type SemanticClassifierConfig,
} from "./semantic-classifier";

export {
  LLMClassifier,
  createLLMClassifier,
  type LLMClassifierConfig,
} from "./llm-classifier";

// 类型导出
export * from "./types";
