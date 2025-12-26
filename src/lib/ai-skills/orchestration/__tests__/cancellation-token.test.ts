/**
 * CancellationToken 单元测试
 *
 * @version 1.0.0
 * @since 2025-12-26
 */

import {
  CancellationTokenSource,
  NullCancellationToken,
  checkCancellation,
  throwIfCancelled,
} from "../cancellation-token";
import { CancellationError } from "../types";

describe("CancellationTokenSource", () => {
  describe("基础功能", () => {
    it("初始状态应未取消", () => {
      const source = new CancellationTokenSource();
      expect(source.isCancelled).toBe(false);
      expect(source.token.isCancelled).toBe(false);
      expect(source.reason).toBeUndefined();
    });

    it("取消后状态应更新", () => {
      const source = new CancellationTokenSource();
      source.cancel("用户取消");

      expect(source.isCancelled).toBe(true);
      expect(source.token.isCancelled).toBe(true);
      expect(source.reason).toBe("用户取消");
      expect(source.token.reason).toBe("用户取消");
    });

    it("重复取消应忽略", () => {
      const source = new CancellationTokenSource();
      source.cancel("第一次取消");
      source.cancel("第二次取消");

      expect(source.reason).toBe("第一次取消");
    });

    it("取消原因可为空", () => {
      const source = new CancellationTokenSource();
      source.cancel();

      expect(source.isCancelled).toBe(true);
      expect(source.reason).toBeUndefined();
    });
  });

  describe("回调机制", () => {
    it("取消时应执行已注册的回调", () => {
      const source = new CancellationTokenSource();
      const callback = jest.fn();

      source.token.onCancel(callback);
      source.cancel("测试取消");

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("多个回调应全部执行", () => {
      const source = new CancellationTokenSource();
      const callbacks = [jest.fn(), jest.fn(), jest.fn()];

      callbacks.forEach((cb) => source.token.onCancel(cb));
      source.cancel();

      callbacks.forEach((cb) => {
        expect(cb).toHaveBeenCalledTimes(1);
      });
    });

    it("已取消后注册的回调应立即执行", () => {
      const source = new CancellationTokenSource();
      source.cancel();

      const callback = jest.fn();
      source.token.onCancel(callback);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("回调执行失败不应影响其他回调", () => {
      const source = new CancellationTokenSource();
      const errorCallback = jest.fn(() => {
        throw new Error("回调错误");
      });
      const normalCallback = jest.fn();

      source.token.onCancel(errorCallback);
      source.token.onCancel(normalCallback);

      // 不应抛出错误
      expect(() => source.cancel()).not.toThrow();
      expect(normalCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe("throwIfCancelled", () => {
    it("未取消时不应抛出", () => {
      const source = new CancellationTokenSource();
      expect(() => source.token.throwIfCancelled()).not.toThrow();
    });

    it("已取消时应抛出 CancellationError", () => {
      const source = new CancellationTokenSource();
      source.cancel("测试原因");

      expect(() => source.token.throwIfCancelled()).toThrow(CancellationError);
      expect(() => source.token.throwIfCancelled()).toThrow("测试原因");
    });

    it("取消原因为空时应使用默认消息", () => {
      const source = new CancellationTokenSource();
      source.cancel();

      expect(() => source.token.throwIfCancelled()).toThrow("操作已取消");
    });
  });

  describe("withTimeout", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("超时后应自动取消", () => {
      const source = CancellationTokenSource.withTimeout(1000);

      expect(source.isCancelled).toBe(false);

      jest.advanceTimersByTime(1000);

      expect(source.isCancelled).toBe(true);
      expect(source.reason).toContain("1000ms");
    });

    it("手动取消应清除超时定时器", () => {
      const source = CancellationTokenSource.withTimeout(1000);

      source.cancel("手动取消");
      jest.advanceTimersByTime(1000);

      // 原因应该是手动取消的原因，不是超时原因
      expect(source.reason).toBe("手动取消");
    });
  });

  describe("link", () => {
    it("任一源取消应取消链接源", () => {
      const source1 = new CancellationTokenSource();
      const source2 = new CancellationTokenSource();
      const linked = CancellationTokenSource.link(source1, source2);

      expect(linked.isCancelled).toBe(false);

      source1.cancel("源1取消");

      expect(linked.isCancelled).toBe(true);
      expect(linked.reason).toBe("源1取消");
    });

    it("链接多个源应正确工作", () => {
      const sources = [
        new CancellationTokenSource(),
        new CancellationTokenSource(),
        new CancellationTokenSource(),
      ];
      const linked = CancellationTokenSource.link(...sources);

      sources[1].cancel("中间源取消");

      expect(linked.isCancelled).toBe(true);
    });
  });
});

describe("NullCancellationToken", () => {
  it("永不取消", () => {
    expect(NullCancellationToken.isCancelled).toBe(false);
    expect(NullCancellationToken.reason).toBeUndefined();
  });

  it("onCancel 不执行任何操作", () => {
    const callback = jest.fn();
    NullCancellationToken.onCancel(callback);
    expect(callback).not.toHaveBeenCalled();
  });

  it("throwIfCancelled 永不抛出", () => {
    expect(() => NullCancellationToken.throwIfCancelled()).not.toThrow();
  });
});

describe("辅助函数", () => {
  describe("checkCancellation", () => {
    it("未取消时返回 false", () => {
      const source = new CancellationTokenSource();
      expect(checkCancellation(source.token)).toBe(false);
    });

    it("已取消时返回 true", () => {
      const source = new CancellationTokenSource();
      source.cancel();
      expect(checkCancellation(source.token)).toBe(true);
    });

    it("token 为空时返回 false", () => {
      expect(checkCancellation(undefined)).toBe(false);
    });
  });

  describe("throwIfCancelled", () => {
    it("未取消时不抛出", () => {
      const source = new CancellationTokenSource();
      expect(() => throwIfCancelled(source.token)).not.toThrow();
    });

    it("已取消时抛出", () => {
      const source = new CancellationTokenSource();
      source.cancel("测试");
      expect(() => throwIfCancelled(source.token)).toThrow(CancellationError);
    });

    it("token 为空时不抛出", () => {
      expect(() => throwIfCancelled(undefined)).not.toThrow();
    });
  });
});

describe("CancellationError", () => {
  it("应有正确的 name 属性", () => {
    const error = new CancellationError("测试");
    expect(error.name).toBe("CancellationError");
  });

  it("应保存错误消息", () => {
    const error = new CancellationError("自定义消息");
    expect(error.message).toBe("自定义消息");
  });

  it("空参数应使用默认消息", () => {
    const error = new CancellationError();
    expect(error.message).toBe("操作已取消");
  });
});
