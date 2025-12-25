/**
 * Utils 模块统一导出
 *
 * Phase 4: lib/ 模块整理
 * 提供工具函数的集中访问点
 */

// AI 相关工具 - 已迁移到 @/lib/ai-generator
// 请使用: import { ... } from "@/lib/ai-generator"
export * from "./embedding-generator";
// auto-classify: 使用命名导出避免与 ai-generator 的 FolderRecommendation 冲突
export {
  CONFIDENCE_THRESHOLDS,
  getOrCreateInboxFolder,
  determineClassifyAction,
  type ClassifyAction,
} from "./auto-classify";

// API 相关工具
export * from "./api-health";
export * from "./api-response";
export * from "./fetch-error-handler";
export * from "./fetch-with-retry";
export * from "./resilient-fetch";
export * from "./rate-limiter";
export * from "./request-id";

// 内容处理工具
export * from "./content-extractor";
export * from "./crawler";
export * from "./html-utils";
export * from "./jina-reader";
export * from "./metadata-parser";
export * from "./smart-content-fetcher";
export * from "./url-extractor";
export * from "./wechat-parser";

// 图片处理工具
export * from "./image-analyzer";
export * from "./image-proxy";
export * from "./placeholder-image";

// 搜索相关工具
export * from "./fulltext-search";
export * from "./semantic-search";

// 文件和导出工具
export * from "./file-upload";
export * from "./export";

// 日期和时间工具
export * from "./date-utils";
export * from "./reading-time";

// 标签相关工具
export * from "./unified-tags";
export * from "./usage-tags-api-helpers";

// 异步和性能工具
export * from "./async-task-retry";
export * from "./performance-monitor";

// 通知工具 (React 组件)
export * from "./classification-notification";
