/**
 * Hooks 统一导出
 *
 * Phase 3: Hook 重组
 * 将 40 个 hooks 按职责分类到 4 个子目录：
 * - core/   : 6 个通用工具类
 * - data/   : 12 个数据获取类
 * - ui/     : 5 个 UI 状态类
 * - domain/ : 17 个业务逻辑类
 *
 * 兼容性说明：
 * 旧路径 `@/hooks/use-xxx` 通过此文件重新导出继续可用
 * 新代码推荐使用分类路径，如 `@/hooks/core/use-dialogs`
 */

// Core - 通用工具类
export * from "./core";

// Data - 数据获取类
export * from "./data";

// UI - UI 状态类
export * from "./ui";

// Domain - 业务逻辑类
export * from "./domain";
