/**
 * Container 适配器
 *
 * 适配旧系统 ClassificationContainer.initialize(supabase) 模式。
 * 新系统无 DI 容器，此类仅保留签名兼容。
 *
 * 旧系统接口来源：src/lib/classification/container.ts
 *
 * @version 2.0.0
 * @since 2026-03-09
 */

import { classify } from "../classify";
import { organizeInbox } from "../batch/inbox-organize";
import {
  mapLegacyRequest,
  mapToLegacyResult,
  type LegacyClassificationRequest,
  type LegacyClassificationResult,
} from "./type-mapping";

// ============================================================================
// ClassificationContainer — 兼容旧 DI 容器模式
// ============================================================================

/**
 * 兼容旧系统 ClassificationContainer
 *
 * 旧系统用法：
 * ```typescript
 * const container = ClassificationContainer.initialize(supabase);
 * const service = container.getClassificationService();
 * await service.classify(userId, bookmark);
 * ```
 *
 * 新系统不需要 supabase 参数，内部自行获取。
 * 所有方法都委托给新系统的函数。
 */
export class ClassificationContainer {
  private static _instance: ClassificationContainer | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  /**
   * 初始化容器（兼容旧签名）
   *
   * 旧系统要求传入 supabase client，新系统不需要。
   */

  static initialize(_supabase?: unknown): ClassificationContainer {
    if (!ClassificationContainer._instance) {
      ClassificationContainer._instance = new ClassificationContainer();
    }
    return ClassificationContainer._instance;
  }

  /**
   * 获取单例
   */
  static getInstance(): ClassificationContainer {
    if (!ClassificationContainer._instance) {
      ClassificationContainer._instance = new ClassificationContainer();
    }
    return ClassificationContainer._instance;
  }

  /**
   * 检查是否已初始化
   */
  static isInitialized(): boolean {
    return ClassificationContainer._instance !== null;
  }

  /**
   * 重置容器（用于测试）
   */
  static reset(): void {
    ClassificationContainer._instance = null;
  }

  /**
   * 获取分类服务
   *
   * 返回一个兼容旧 IClassificationService 接口的对象。
   * 旧系统签名：classify(userId, bookmark) → ClassificationResult
   */
  getClassificationService(): {
    classify: (
      userId: string,
      bookmark: {
        id?: number;
        title: string;
        url?: string;
        summary?: string;
        tags?: string[];
      },
    ) => Promise<LegacyClassificationResult>;
    classifyBatch: (
      userId: string,
      bookmarks: Array<{
        id?: number;
        title: string;
        url?: string;
        summary?: string;
        tags?: string[];
      }>,
    ) => Promise<LegacyClassificationResult[]>;
  } {
    return {
      classify: async (userId, bookmark) => {
        const request: LegacyClassificationRequest = {
          userId,
          bookmarkId: String(bookmark.id ?? ""),
          title: bookmark.title,
          url: bookmark.url,
          summary: bookmark.summary,
          tags: bookmark.tags,
        };
        const newRequest = mapLegacyRequest(request);
        const result = await classify(newRequest);
        return mapToLegacyResult(result);
      },
      classifyBatch: async (userId, bookmarks) => {
        const results = await Promise.all(
          bookmarks.map(async (bookmark) => {
            const request: LegacyClassificationRequest = {
              userId,
              bookmarkId: String(bookmark.id ?? ""),
              title: bookmark.title,
              url: bookmark.url,
              summary: bookmark.summary,
              tags: bookmark.tags,
            };
            const newRequest = mapLegacyRequest(request);
            const result = await classify(newRequest);
            return mapToLegacyResult(result);
          }),
        );
        return results;
      },
    };
  }

  /**
   * 获取收件箱整理服务
   *
   * 委托给新系统的 organizeInbox()
   */
  getInboxOrganizerService(): {
    organize: typeof organizeInbox;
  } {
    return {
      organize: organizeInbox,
    };
  }

  /**
   * 获取增强容器（兼容旧签名，返回 this）
   */
  getEnhanced(): ClassificationContainer {
    return this;
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 获取已初始化的容器
 *
 * 旧系统用法：getClassificationContainer()
 */
export function getClassificationContainer(): ClassificationContainer {
  return ClassificationContainer.getInstance();
}
