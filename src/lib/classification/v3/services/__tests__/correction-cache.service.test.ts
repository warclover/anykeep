/**
 * CorrectionCacheService 单元测试
 */

import {
  CorrectionCacheService,
  type CorrectionCacheConfig,
} from "../correction-cache.service";

describe("CorrectionCacheService", () => {
  let service: CorrectionCacheService;

  const defaultConfig: Partial<CorrectionCacheConfig> = {
    expirationMs: 1000, // 1 秒用于测试
    maxEntries: 100,
    enableSimilarUrlMatching: true,
    cleanupIntervalMs: 60 * 60 * 1000, // 禁用自动清理
  };

  beforeEach(() => {
    service = new CorrectionCacheService(defaultConfig);
  });

  afterEach(() => {
    service.stop();
  });

  describe("基本缓存操作", () => {
    it("应该能够写入和读取缓存", () => {
      const userId = "user-1";
      const url = "https://example.com/article/123";
      const folderId = 42;
      const folderName = "技术文章";

      service.set(userId, url, folderId, folderName);

      const result = service.get(userId, url);

      expect(result).not.toBeNull();
      expect(result?.folderId).toBe(folderId);
      expect(result?.folderName).toBe(folderName);
      expect(result?.confidence).toBe(100); // 精确匹配置信度 100%
    });

    it("应该在缓存未命中时返回 null", () => {
      const result = service.get("user-1", "https://unknown.com/page");
      expect(result).toBeNull();
    });

    it("应该支持 URL 标准化（忽略协议和 www）", () => {
      const userId = "user-1";
      const folderId = 42;
      const folderName = "测试";

      // 写入时使用 https://www.
      service.set(
        userId,
        "https://www.example.com/page",
        folderId,
        folderName
      );

      // 读取时使用 http:// 无 www
      const result = service.get(userId, "http://example.com/page");

      expect(result).not.toBeNull();
      expect(result?.folderId).toBe(folderId);
    });

    it("应该能够删除缓存条目", () => {
      const userId = "user-1";
      const url = "https://example.com/delete-me";

      service.set(userId, url, 1, "folder");
      expect(service.get(userId, url)).not.toBeNull();

      const deleted = service.delete(userId, url);

      expect(deleted).toBe(true);
      expect(service.get(userId, url)).toBeNull();
    });
  });

  describe("缓存过期", () => {
    it("应该在缓存过期后返回 null", async () => {
      const shortExpirationService = new CorrectionCacheService({
        expirationMs: 50, // 50ms 过期
        cleanupIntervalMs: 60 * 60 * 1000,
      });

      try {
        shortExpirationService.set(
          "user-1",
          "https://example.com/expire",
          1,
          "folder"
        );

        // 立即读取应该命中
        expect(
          shortExpirationService.get("user-1", "https://example.com/expire")
        ).not.toBeNull();

        // 等待过期
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 过期后应该返回 null
        expect(
          shortExpirationService.get("user-1", "https://example.com/expire")
        ).toBeNull();
      } finally {
        shortExpirationService.stop();
      }
    });
  });

  describe("相似 URL 匹配", () => {
    it("应该能够匹配同域名下的相似 URL", () => {
      const userId = "user-1";
      const folderId = 42;
      const folderName = "GitHub 项目";

      // 写入多个同域名 URL
      service.set(
        userId,
        "https://github.com/user/repo1",
        folderId,
        folderName
      );
      service.set(
        userId,
        "https://github.com/user/repo2",
        folderId,
        folderName
      );
      service.set(
        userId,
        "https://github.com/user/repo3",
        folderId,
        folderName
      );

      // 查询未缓存的同域名 URL
      const result = service.get(userId, "https://github.com/user/new-repo");

      expect(result).not.toBeNull();
      expect(result?.folderId).toBe(folderId);
      // 相似匹配置信度应该小于 100%
      expect(result?.confidence).toBeLessThan(100);
      expect(result?.confidence).toBeGreaterThanOrEqual(60);
    });

    it("在相似匹配置信度低于阈值时应该返回 null", () => {
      const userId = "user-1";

      // 写入分散到不同文件夹的 URL
      service.set(userId, "https://mixed.com/page1", 1, "文件夹 1");
      service.set(userId, "https://mixed.com/page2", 2, "文件夹 2");
      service.set(userId, "https://mixed.com/page3", 3, "文件夹 3");
      service.set(userId, "https://mixed.com/page4", 4, "文件夹 4");

      // 每个文件夹只有 25%，低于 60% 阈值
      const result = service.get(userId, "https://mixed.com/new-page");
      expect(result).toBeNull();
    });
  });

  describe("LRU 淘汰", () => {
    it("应该在超过最大条目数时淘汰最旧的条目", () => {
      const smallCacheService = new CorrectionCacheService({
        maxEntries: 3,
        cleanupIntervalMs: 60 * 60 * 1000,
        enableSimilarUrlMatching: false,
      });

      try {
        // 写入 4 个条目，应该淘汰第一个
        smallCacheService.set("user-1", "https://a.com/1", 1, "a");
        smallCacheService.set("user-1", "https://b.com/2", 2, "b");
        smallCacheService.set("user-1", "https://c.com/3", 3, "c");
        smallCacheService.set("user-1", "https://d.com/4", 4, "d");

        // 第一个应该被淘汰
        expect(smallCacheService.get("user-1", "https://a.com/1")).toBeNull();

        // 其他应该存在
        expect(
          smallCacheService.get("user-1", "https://b.com/2")
        ).not.toBeNull();
        expect(
          smallCacheService.get("user-1", "https://c.com/3")
        ).not.toBeNull();
        expect(
          smallCacheService.get("user-1", "https://d.com/4")
        ).not.toBeNull();
      } finally {
        smallCacheService.stop();
      }
    });
  });

  describe("统计信息", () => {
    it("应该正确跟踪命中和未命中统计", () => {
      service.set("user-1", "https://hit.com/page", 1, "folder");

      // 命中
      service.get("user-1", "https://hit.com/page");
      service.get("user-1", "https://hit.com/page");

      // 未命中
      service.get("user-1", "https://miss.com/page");

      const stats = service.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.writes).toBe(1);
      expect(stats.hitRate).toBe(67); // 2/3 ≈ 67%
    });
  });

  describe("清理功能", () => {
    it("应该能够清空所有缓存", () => {
      service.set("user-1", "https://a.com/1", 1, "a");
      service.set("user-1", "https://b.com/2", 2, "b");

      // 清空前验证有数据
      expect(service.get("user-1", "https://a.com/1")).not.toBeNull();

      service.clear();

      // 清空后统计应该重置
      const stats = service.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.writes).toBe(0);

      // 清空后再查询应该返回 null（这会增加 misses）
      expect(service.get("user-1", "https://a.com/1")).toBeNull();
      expect(service.get("user-1", "https://b.com/2")).toBeNull();
    });
  });
});
