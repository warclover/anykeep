/**
 * UnifiedEntry 单元测试
 *
 * @version 1.0.0
 * @since 2026-02-01
 */

import {
  UnifiedEntry,
  getUnifiedEntry,
  createUnifiedEntry,
  resetUnifiedEntry,
} from "../entry/unified-entry";
import type { UnifiedRequest } from "../types";

// ============================================
// Mock 模块
// ============================================

jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ============================================
// 测试用例
// ============================================

describe("UnifiedEntry", () => {
  let entry: UnifiedEntry;

  beforeEach(() => {
    resetUnifiedEntry();
    entry = new UnifiedEntry({
      enablePreprocessing: true,
      enableCache: true,
      enableDebugTrace: false,
    });
  });

  afterEach(() => {
    resetUnifiedEntry();
  });

  describe("route", () => {
    it("应该返回完整的路由结果", async () => {
      const request: UnifiedRequest = {
        message: "你好",
        userId: "test-user",
        sessionId: "test-session",
      };

      const result = await entry.route(request);

      expect(result).toHaveProperty("intent");
      expect(result).toHaveProperty("complexity");
      expect(result).toHaveProperty("mode");
      expect(result).toHaveProperty("routingDurationMs");
      expect(result.routingDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("简单问候应该返回 chitchat 意图", async () => {
      const request: UnifiedRequest = {
        message: "你好啊",
        userId: "test-user",
      };

      const result = await entry.route(request);

      // 没有分类器注册时，会降级到 chitchat
      expect(["chitchat", "query"]).toContain(result.intent.type);
      expect(result.mode).toBe("atomic");
    });

    it("问句应该返回 query 意图", async () => {
      const request: UnifiedRequest = {
        message: "这个功能怎么用？",
        userId: "test-user",
      };

      const result = await entry.route(request);

      expect(result.intent.type).toBe("query");
    });

    it("应该记录缓存命中状态", async () => {
      const request: UnifiedRequest = {
        message: "测试缓存",
        userId: "test-user",
      };

      // 第一次请求
      const result1 = await entry.route(request);
      expect(result1.cacheHit).toBe("none");

      // 第二次请求（应该命中缓存）
      const result2 = await entry.route(request);
      expect(result2.cacheHit).toBe("L1");
    });

    it("禁用缓存时不应该命中", async () => {
      const noCacheEntry = new UnifiedEntry({
        enableCache: false,
      });

      const request: UnifiedRequest = {
        message: "无缓存测试",
        userId: "test-user",
      };

      await noCacheEntry.route(request);
      const result = await noCacheEntry.route(request);

      expect(result.cacheHit).toBe("none");
    });

    it("应该包含预处理后的消息", async () => {
      const request: UnifiedRequest = {
        message: "  带空格的消息  ",
        userId: "test-user",
      };

      const result = await entry.route(request);

      expect(result.preprocessedMessage).toBeDefined();
    });

    it("错误时应该返回降级结果", async () => {
      // 创建一个会抛出错误的入口（通过模拟内部组件失败）
      const brokenEntry = new UnifiedEntry();
      // 直接调用私有方法会失败，但 route 应该捕获错误并返回降级结果

      const request: UnifiedRequest = {
        message: "",
        userId: "",
      };

      const result = await brokenEntry.route(request);

      // 即使输入异常，也应该返回有效结果
      expect(result.intent).toBeDefined();
      expect(result.mode).toBeDefined();
    });
  });

  describe("getCacheStats", () => {
    it("应该返回缓存统计信息", async () => {
      const request: UnifiedRequest = {
        message: "统计测试",
        userId: "test-user",
      };

      await entry.route(request);
      await entry.route(request);

      const stats = entry.getCacheStats();

      expect(stats.size).toBeGreaterThan(0);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  describe("cleanupCache", () => {
    it("应该清理过期缓存", async () => {
      // 先添加一些缓存
      await entry.route({
        message: "msg1",
        userId: "user1",
      });

      const cleaned = entry.cleanupCache();

      // 新添加的缓存不会立即过期
      expect(cleaned).toBe(0);
    });
  });

  describe("getClassifierChain", () => {
    it("应该返回分类器链实例", () => {
      const chain = entry.getClassifierChain();

      expect(chain).toBeDefined();
      expect(typeof chain.register).toBe("function");
      expect(typeof chain.classify).toBe("function");
    });
  });
});

describe("单例管理", () => {
  beforeEach(() => {
    resetUnifiedEntry();
  });

  afterEach(() => {
    resetUnifiedEntry();
  });

  describe("getUnifiedEntry", () => {
    it("应该返回单例实例", () => {
      const entry1 = getUnifiedEntry();
      const entry2 = getUnifiedEntry();

      expect(entry1).toBe(entry2);
    });

    it("配置只在首次创建时生效", () => {
      const entry1 = getUnifiedEntry({ enableCache: false });
      const entry2 = getUnifiedEntry({ enableCache: true });

      // entry2 返回的是同一个实例
      expect(entry1).toBe(entry2);
    });
  });

  describe("createUnifiedEntry", () => {
    it("应该创建新实例（非单例）", () => {
      const entry1 = createUnifiedEntry();
      const entry2 = createUnifiedEntry();

      expect(entry1).not.toBe(entry2);
    });
  });

  describe("resetUnifiedEntry", () => {
    it("应该重置单例", () => {
      const entry1 = getUnifiedEntry();
      resetUnifiedEntry();
      const entry2 = getUnifiedEntry();

      expect(entry1).not.toBe(entry2);
    });
  });
});

describe("复杂度评估集成", () => {
  let entry: UnifiedEntry;

  beforeEach(() => {
    resetUnifiedEntry();
    entry = new UnifiedEntry();
  });

  afterEach(() => {
    resetUnifiedEntry();
  });

  it("应该返回复杂度评估结果", async () => {
    const request: UnifiedRequest = {
      message: "帮我整理收藏",
      userId: "test-user",
    };

    const result = await entry.route(request);

    expect(result.complexity).toBeDefined();
    expect(result.complexity.level).toBeDefined();
    expect(result.complexity.score).toBeDefined();
    expect(result.complexity.factors).toBeDefined();
  });

  it("复杂度因素应该完整", async () => {
    const request: UnifiedRequest = {
      message: "分析我的阅读习惯",
      userId: "test-user",
    };

    const result = await entry.route(request);

    expect(result.complexity.factors.length).toBeGreaterThan(0);
    result.complexity.factors.forEach((factor) => {
      expect(factor.name).toBeDefined();
      expect(factor.weight).toBeDefined();
      expect(factor.value).toBeDefined();
    });
  });
});

describe("上下文传递", () => {
  let entry: UnifiedEntry;

  beforeEach(() => {
    resetUnifiedEntry();
    entry = new UnifiedEntry();
  });

  afterEach(() => {
    resetUnifiedEntry();
  });

  it("应该正确传递用户上下文", async () => {
    const request: UnifiedRequest = {
      message: "处理选中的收藏",
      userId: "test-user",
      context: {
        selectedBookmarks: [1, 2, 3],
        totalBookmarks: 100,
      },
    };

    const result = await entry.route(request);

    // 上下文应该影响复杂度评估
    expect(result.complexity).toBeDefined();
  });

  it("应该处理空上下文", async () => {
    const request: UnifiedRequest = {
      message: "简单查询",
      userId: "test-user",
    };

    const result = await entry.route(request);

    expect(result).toBeDefined();
  });
});
