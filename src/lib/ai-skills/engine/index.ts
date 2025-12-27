/**
 * 执行引擎层模块导出
 *
 * @module ai-skills/engine
 * @version 2.1.0
 * @since 2025-12-24
 * @updated 2025-12-27 - 添加请求注册表
 */

// 类型导出
export type {
  EngineContext,
  EngineExecuteOptions,
  EngineExecutionSummary,
  UnifiedEngineConfig,
  OrchestrationEngineConfig,
  EpisodicMemoryContext, // 重新导出情景记忆类型
} from "./types";

// 编排引擎
export {
  OrchestrationEngine,
  createOrchestrationEngine,
  orchestrationEngine,
} from "./orchestration-engine";

// 统一引擎
export {
  UnifiedEngine,
  createUnifiedEngine,
  unifiedEngine,
  type AtomicExecutor,
} from "./unified-engine";

// 输入预处理模块
export {
  InputPreprocessor,
  createInputPreprocessor,
  type PreprocessResult,
  type InputPreprocessorConfig,
} from "./input-preprocessor";

// 输入验证模块
export {
  InputValidator,
  createInputValidator,
  inputValidator,
  validateInput,
  sanitizeInput,
  INPUT_VALIDATOR_DEFAULTS,
  type InputValidatorConfig,
  type ValidationResult,
} from "./input-validator";

// 执行协调模块
export {
  ExecutionCoordinator,
  createExecutionCoordinator,
  type ExecutionCoordinatorConfig,
  type ExecutionMode,
  type ForceExecutionOptions,
} from "./execution-coordinator";

// 输出增强模块
export {
  OutputEnhancer,
  createOutputEnhancer,
  type OutputEnhancerConfig,
} from "./output-enhancer";

// 请求注册表（取消支持）
export {
  RequestRegistry,
  getRequestRegistry,
  createRequestRegistry,
  type RequestInfo,
  type RequestRegistryConfig,
} from "./request-registry";
