/**
 * DistributedLockManager 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import { DistributedLockManager } from "../distributed-lock";

// Mock Supabase
const mockRpc = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      rpc: mockRpc,
    }),
  ),
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("DistributedLockManager", () => {
  let lockManager: DistributedLockManager;

  beforeEach(() => {
    lockManager = new DistributedLockManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("tryAcquire", () => {
    it("should acquire lock successfully", async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });

      const result = await lockManager.tryAcquire("test-lock");

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith(
        "try_acquire_workflow_lock",
        expect.objectContaining({
          p_lock_key: "test-lock",
        }),
      );
    });

    it("should fail to acquire when lock is held", async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });

      const result = await lockManager.tryAcquire("test-lock", {
        maxRetries: 1,
        retryIntervalMs: 10,
      });

      expect(result).toBe(false);
    });

    it("should retry on error", async () => {
      mockRpc
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue({ data: true, error: null });

      const result = await lockManager.tryAcquire("test-lock", {
        maxRetries: 2,
        retryIntervalMs: 10,
      });

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });

    it("should respect custom TTL", async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });

      await lockManager.tryAcquire("test-lock", { ttlMs: 30000 });

      expect(mockRpc).toHaveBeenCalledWith(
        "try_acquire_workflow_lock",
        expect.objectContaining({
          p_ttl_ms: 30000,
        }),
      );
    });
  });

  describe("release", () => {
    it("should release lock successfully", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      await lockManager.release("test-lock");

      expect(mockRpc).toHaveBeenCalledWith(
        "release_workflow_lock",
        expect.objectContaining({
          p_lock_key: "test-lock",
        }),
      );
    });

    it("should handle release errors gracefully", async () => {
      mockRpc.mockRejectedValue(new Error("Release failed"));

      // 不应抛出异常
      await expect(lockManager.release("test-lock")).resolves.not.toThrow();
    });
  });

  describe("withLock", () => {
    it("should execute operation when lock acquired", async () => {
      mockRpc
        .mockResolvedValueOnce({ data: true, error: null }) // acquire
        .mockResolvedValueOnce({ data: null, error: null }); // release

      const operation = jest.fn(() => Promise.resolve("result"));

      const result = await lockManager.withLock("test-lock", operation);

      expect(result).toBe("result");
      expect(operation).toHaveBeenCalled();
    });

    it("should return null when lock not acquired", async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });

      const operation = jest.fn(() => Promise.resolve("result"));

      const result = await lockManager.withLock("test-lock", operation, {
        maxRetries: 1,
        retryIntervalMs: 10,
      });

      expect(result).toBeNull();
      expect(operation).not.toHaveBeenCalled();
    });

    it("should release lock even if operation fails", async () => {
      mockRpc
        .mockResolvedValueOnce({ data: true, error: null }) // acquire
        .mockResolvedValueOnce({ data: null, error: null }); // release

      const operation = jest.fn(() =>
        Promise.reject(new Error("Operation failed")),
      );

      await expect(
        lockManager.withLock("test-lock", operation),
      ).rejects.toThrow("Operation failed");

      // 验证 release 被调用
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });
  });
});
