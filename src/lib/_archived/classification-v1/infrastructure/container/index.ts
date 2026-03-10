/**
 * Classification Container Module
 *
 * 增强型依赖注入容器模块导出
 *
 * @version 1.0.0
 * @since 2026-01-24 Phase 4
 */

// 类型标识符
export { SERVICE_TYPES } from "./types";
export type { ServiceTypeKey, ServiceTypeSymbol } from "./types";

// 容器
export {
  EnhancedContainer,
  initializeContainer,
  getContainer,
  isContainerInitialized,
  resetContainer,
  createTestContainer,
} from "./container";
export type {
  ContainerConfig,
  ServiceLifetime,
  ServiceFactory,
} from "./container";

// 服务注册
export {
  registerRepositories,
  registerInfrastructureServices,
  registerBusinessServices,
  registerModernServices,
  registerAllServices,
} from "./registrations";
