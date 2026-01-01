/**
 * 分发核心服务模块
 *
 * @module distribution/core
 * @description 核心服务实现
 */

export { DistributionRegistry } from "./distribution.registry";
export {
  DistributionService,
  type DistributionServiceConfig,
  type CreateTargetInput,
  type UpdateTargetInput,
} from "./distribution.service";
export {
  DistributionEventBus,
  type EventBusConfig,
} from "./distribution.event-bus";
export { DistributionScheduler } from "./distribution.scheduler";
