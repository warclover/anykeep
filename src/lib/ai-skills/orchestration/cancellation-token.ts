/**
 * 取消令牌实现
 *
 * 提供异步操作取消机制
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import { CancellationError, type CancellationToken } from "./types";

/**
 * 取消令牌内部实现
 */
class CancellationTokenImpl implements CancellationToken {
  constructor(private readonly source: CancellationTokenSource) {}

  get isCancelled(): boolean {
    return this.source.isCancelled;
  }

  get reason(): string | undefined {
    return this.source.reason;
  }

  onCancel(callback: () => void): void {
    this.source.registerCallback(callback);
  }

  throwIfCancelled(): void {
    if (this.source.isCancelled) {
      throw new CancellationError(this.source.reason);
    }
  }
}

/**
 * 取消令牌源
 *
 * 用于创建和管理取消令牌
 *
 * @example
 * ```typescript
 * const source = new CancellationTokenSource();
 * const token = source.token;
 *
 * // 传递给异步操作
 * someAsyncOperation(token);
 *
 * // 用户点击取消
 * source.cancel("用户取消");
 * ```
 */
export class CancellationTokenSource {
  private _isCancelled = false;
  private _reason?: string;
  private _callbacks: (() => void)[] = [];
  private _token: CancellationToken;

  constructor() {
    this._token = new CancellationTokenImpl(this);
  }

  /**
   * 获取取消令牌
   */
  get token(): CancellationToken {
    return this._token;
  }

  /**
   * 注册取消回调（内部方法，由 CancellationTokenImpl 调用）
   */
  registerCallback(callback: () => void): void {
    if (this._isCancelled) {
      // 已取消，立即执行回调
      callback();
    } else {
      this._callbacks.push(callback);
    }
  }

  /**
   * 取消操作
   * @param reason - 取消原因
   */
  cancel(reason?: string): void {
    if (this._isCancelled) {
      return; // 已经取消，忽略重复调用
    }

    this._isCancelled = true;
    this._reason = reason;

    // 执行所有注册的回调
    for (const callback of this._callbacks) {
      try {
        callback();
      } catch (error) {
        // 忽略回调中的错误，继续执行其他回调
        console.error("取消回调执行失败:", error);
      }
    }

    // 清空回调列表
    this._callbacks = [];
  }

  /**
   * 是否已取消
   */
  get isCancelled(): boolean {
    return this._isCancelled;
  }

  /**
   * 取消原因
   */
  get reason(): string | undefined {
    return this._reason;
  }

  /**
   * 创建一个带超时的取消令牌源
   * @param timeoutMs - 超时时间（毫秒）
   * @returns 取消令牌源（超时后自动取消）
   */
  static withTimeout(timeoutMs: number): CancellationTokenSource {
    const source = new CancellationTokenSource();

    const timer = setTimeout(() => {
      source.cancel(`操作超时（${timeoutMs}ms）`);
    }, timeoutMs);

    // 当手动取消时，清除超时定时器
    source.token.onCancel(() => {
      clearTimeout(timer);
    });

    return source;
  }

  /**
   * 链接多个取消令牌源（任一取消则全部取消）
   * @param sources - 要链接的取消令牌源列表
   * @returns 链接后的取消令牌源
   */
  static link(...sources: CancellationTokenSource[]): CancellationTokenSource {
    const linkedSource = new CancellationTokenSource();

    for (const source of sources) {
      source.token.onCancel(() => {
        linkedSource.cancel(source.reason);
      });
    }

    return linkedSource;
  }
}

/**
 * 空取消令牌（永不取消）
 */
export const NullCancellationToken: CancellationToken = {
  isCancelled: false,
  reason: undefined,
  onCancel: () => {
    // 空操作
  },
  throwIfCancelled: () => {
    // 永不抛出
  },
};

/**
 * 检查取消状态的辅助函数
 * @param token - 取消令牌
 * @returns 是否已取消
 */
export function checkCancellation(token?: CancellationToken): boolean {
  return token?.isCancelled ?? false;
}

/**
 * 在异步操作中检查取消点
 * @param token - 取消令牌
 * @throws CancellationError 如果已取消
 */
export function throwIfCancelled(token?: CancellationToken): void {
  token?.throwIfCancelled();
}
