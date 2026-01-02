/**
 * Knowledge Studio - 模板自定义模块
 * @module knowledge-studio/templates
 * @description P4 实现 - 用户自建蓝图 Prompt 模板
 * @version 1.0.0
 * @since 2026-01-02
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
export {
  TemplateService,
  TemplateServiceStub, // 兼容别名
  createTemplateService,
} from "./template-service";

export {
  PromptCompiler,
  PromptCompilerStub, // 兼容别名
  createPromptCompiler,
} from "./prompt-compiler";
