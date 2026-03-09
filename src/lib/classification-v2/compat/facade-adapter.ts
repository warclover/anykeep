/**
 * Facade 适配器
 *
 * 适配旧系统 getClassificationFacade().classify() 调用签名。
 * 40+ 个 API 路由通过此适配器桥接到新系统，零修改。
 *
 * 旧系统接口来源：src/lib/classification/facade.ts
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { classify } from "../classify";
import { batchClassify } from "../batch/batch-classify";
import {
  mapLegacyRequest,
  mapToLegacyResult,
  type LegacyClassificationRequest,
  type LegacyClassificationResult,
} from "./type-mapping";

// ============================================================================
// ClassificationFacade — 兼容旧系统的门面类
// ============================================================================

/**
 * 兼容旧系统 ClassificationFacade 的接口
 *
 * 旧系统用法：
 * ```typescript
 * const facade = getClassificationFacade();
 * const result = await facade.classify(request);
 * ```
 *
 * 新系统内部直接调用 classify()，然后将结果映射回旧格式。
 */
export class ClassificationFacade {
  /**
   * 统一分类入口
   *
   * 接受旧系统 ClassificationRequest，返回旧系统 ClassificationResult
   */
  async classify(
    request: LegacyClassificationRequest,
  ): Promise<LegacyClassificationResult> {
    const newRequest = mapLegacyRequest(request);
    const result = await classify(newRequest);
    return mapToLegacyResult(result);
  }

  /**
   * 批量分类
   *
   * 旧系统签名：classifyBatch(requests) → results[]
   */
  async classifyBatch(
    requests: LegacyClassificationRequest[],
  ): Promise<LegacyClassificationResult[]> {
    const newRequests = requests.map(mapLegacyRequest);
    const batchResult = await batchClassify({ requests: newRequests });
    return batchResult.results.map(mapToLegacyResult);
  }

  /**
   * 仅快速分类（兼容旧系统 classifyQuick）
   *
   * 新系统无 quick 模式，直接走完整 classify。
   * CascadeRanker 的提前终止机制天然支持快速返回。
   */
  async classifyQuick(
    request: LegacyClassificationRequest,
  ): Promise<LegacyClassificationResult> {
    return this.classify(request);
  }

  /**
   * 旧系统 setContainer 兼容（no-op）
   *
   * 新系统无 DI 容器，此方法仅保留签名兼容。
   */

  setContainer(_container: unknown): void {
    // no-op: 新系统不使用 DI 容器
  }
}

// ============================================================================
// 单例 + 工厂函数
// ============================================================================

let _facade: ClassificationFacade | null = null;

/**
 * 获取 ClassificationFacade 单例
 *
 * 旧系统用法：
 * ```typescript
 * import { getClassificationFacade } from '@/lib/classification';
 * const result = await getClassificationFacade().classify(request);
 * ```
 */
export function getClassificationFacade(
  _config?: unknown,
): ClassificationFacade {
  if (!_facade) {
    _facade = new ClassificationFacade();
  }
  return _facade;
}

/**
 * 创建新的 ClassificationFacade 实例
 *
 * 旧系统用法：createClassificationFacade(supabase, config)
 * 新系统不需要 supabase 参数（内部自行获取）。
 */
export function createClassificationFacade(
  _supabase?: unknown,

  _config?: unknown,
): ClassificationFacade {
  return new ClassificationFacade();
}
