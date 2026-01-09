/**
 * DistributedLockManager 单元测试
 *
 * @version 1.0.1
 * @since 2026-01-08
 * @updated 2026-01-09 - 适配 LockHandle 接口安全修复
 */

import type { LockHandle } from "../distributed-lock";
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
    it("should acquire lock successfully and return LockHandle", async () => {
      const mockInstanceId = "test-instance-123";
      mockRpc.mockResolvedValue({ data: mockInstanceId, error: null });

      const result = await lockManager.tryAcquire("test-lock");

      expect(result).not.toBeNull();
      expect(result?.lockKey).toBe("test-lock");
      expect(result?.instanceId).toBe(mockInstanceId);
      expect(typeof result?.lockId).toBe("number");
      expect(mockRpc).toHaveBeenCalledWith(
        "try_acquire_workflow_lock",
        expect.objectContaining({
          p_lock_key: "test-lock",
        }),
      );
    });

    it("should return null when lock is held", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await lockManager.tryAcquire("test-lock", {
        maxRetries: 1,
        retryIntervalMs: 10,
      });

      expect(result).toBeNull();
    });

    it("should retry on error and return LockHandle on success", async () => {
      const mockInstanceId = "test-instance-456";
      mockRpc
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue({ data: mockInstanceId, error: null });

      const result = await lockManager.tryAcquire("test-lock", {
        maxRetries: 2,
        retryIntervalMs: 10,
      });

      expect(result).not.toBeNull();
      expect(result?.instanceId).toBe(mockInstanceId);
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });

    it("should respect custom TTL", async () => {
      mockRpc.mockResolvedValue({ data: "instance-id", error: null });

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
    it("should release lock successfully with LockHandle", async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });

      const handle: LockHandle = {
        lockKey: "test-lock",
        lockId: 123456,
        instanceId: "test-instance-789",
      };

      const result = await lockManager.release(handle);

      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith(
        "release_workflow_lock",
        expect.objectContaining({
          p_lock_key: "test-lock",
          p_lock_id: 123456,
          p_instance_id: "test-instance-789",
        }),
      );
    });

    it("should return false when lock not found or owned by another instance", async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });

      const handle: LockHandle = {
        lockKey: "test-lock",
        lockId: 123456,
        instanceId: "wrong-instance",
      };

      const result = await lockManager.release(handle);

      expect(result).toBe(false);
    });

    it("should handle release errors gracefully", async () => {
      mockRpc.mockRejectedValue(new Error("Release failed"));

      const handle: LockHandle = {
        lockKey: "test-lock",
        lockId: 123456,
        instanceId: "test-instance",
      };

      // 不应抛出异常，返回 false
      const result = await lockManager.release(handle);
      expect(result).toBe(false);
    });
  });

  describe("withLock", () => {
    it("should execute operation when lock acquired", async () => {
      mockRpc
        .mockResolvedValueOnce({ data: "instance-id", error: null }) // acquire
        .mockResolvedValueOnce({ data: true, error: null }); // release

      const operation = jest.fn(() => Promise.resolve("result"));

      const result = await lockManager.withLock("test-lock", operation);

      expect(result).toBe("result");
      expect(operation).toHaveBeenCalled();
    });

    it("should return null when lock not acquired", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

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
        .mockResolvedValueOnce({ data: "instance-id", error: null }) // acquire
        .mockResolvedValueOnce({ data: true, error: null }); // release

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
