/**
 * Knowledge Studio - 模板自定义模块
 * @module knowledge-studio/templates
 * @description Phase 3 存根 - 用户自建蓝图 Prompt 模板
 * @version 0.1.0 (Stub)
 * @since 2025-01-02
 */

// 类型导出
export type {
  // 基础类型
  TemplateVisibility,
  TemplateStatus,
  TemplateVariableType,
  // 模板结构
  TemplateVariable,
  TemplatePromptSection,
  CustomTemplate,
  TemplateUsage,
  TemplateVersion,
  // 服务接口
  ITemplateService,
  IPromptCompiler,
} from "./types";

// 服务导出
export { TemplateServiceStub, createTemplateService } from "./template-service";
export { PromptCompilerStub, createPromptCompiler } from "./prompt-compiler";
