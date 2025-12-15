/**
 * Async Task Retry Tests
 *
 * V4.2.7: 异步任务重试工具单元测试
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import {
  executeWithRetry,
  executeInBackground,
  bookmarkAITasks,
  type AsyncTaskConfig,
  type TaskResult,
} from "../async-task-retry";

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock jobQueueService
jest.mock("@/lib/classification/services/job-queue.service", () => ({
  jobQueueService: {
    enqueue: jest.fn(),
  },
}));

// Import mock after jest.mock to get the mocked version
import { jobQueueService } from "@/lib/classification/services/job-queue.service";
const mockEnqueue = jobQueueService.enqueue as jest.Mock;

// ============================================================================
// Test Helpers
// ============================================================================

const createMockTaskFn = <T>(result: T, shouldFail = false, delay = 0) => {
  return jest.fn().mockImplementation(async () => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (shouldFail) {
      throw new Error("Task failed");
    }
    return result;
  });
};

const defaultConfig: AsyncTaskConfig = {
  jobType: "generate_ai_content",
  userId: "test-user-id",
  payload: { bookmarkId: 123 },
};

// ============================================================================
// Tests: executeWithRetry
// ============================================================================

describe("executeWithRetry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Successful Execution", () => {
    it("should return success result when task succeeds on first try", async () => {
      const taskFn = createMockTaskFn({ data: "success" });

      const result = await executeWithRetry(taskFn, defaultConfig);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: "success" });
      expect(result.error).toBeUndefined();
      expect(result.enqueuedJobId).toBeUndefined();
      expect(taskFn).toHaveBeenCalledTimes(1);
    });

    it("should not enqueue when task succeeds", async () => {
      const taskFn = createMockTaskFn("success");

      await executeWithRetry(taskFn, defaultConfig);

      expect(mockEnqueue).not.toHaveBeenCalled();
    });
  });

  describe("Immediate Retry", () => {
    it("should retry on failure up to maxImmediateRetries", async () => {
      let attempts = 0;
      const taskFn = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return "success";
      });

      const result = await executeWithRetry(taskFn, {
        ...defaultConfig,
        maxImmediateRetries: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(taskFn).toHaveBeenCalledTimes(3);
    });

    it("should use exponential backoff between retries", async () => {
      const taskFn = createMockTaskFn(null, true);
      const startTime = Date.now();

      await executeWithRetry(taskFn, {
        ...defaultConfig,
        maxImmediateRetries: 3,
        enqueueOnFailure: false,
      });

      const elapsed = Date.now() - startTime;
      // 第一次失败后等待 100ms，第二次失败后等待 200ms
      // 总计至少 300ms
      expect(elapsed).toBeGreaterThanOrEqual(200);
    });
  });

  describe("Enqueue on Failure", () => {
    it("should enqueue to job_queue when all retries fail", async () => {
      const taskFn = createMockTaskFn(null, true);
      mockEnqueue.mockResolvedValueOnce("job-123");

      const result = await executeWithRetry(taskFn, {
        ...defaultConfig,
        maxImmediateRetries: 2,
        enqueueOnFailure: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Task failed");
      expect(result.enqueuedJobId).toBe("job-123");
      expect(mockEnqueue).toHaveBeenCalledWith(
        defaultConfig.userId,
        defaultConfig.jobType,
        defaultConfig.payload,
        { priority: 0, maxAttempts: 3 },
      );
    });

    it("should not enqueue when enqueueOnFailure is false", async () => {
      const taskFn = createMockTaskFn(null, true);

      const result = await executeWithRetry(taskFn, {
        ...defaultConfig,
        maxImmediateRetries: 1,
        enqueueOnFailure: false,
      });

      expect(result.success).toBe(false);
      expect(result.enqueuedJobId).toBeUndefined();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("should handle enqueue failure gracefully", async () => {
      const taskFn = createMockTaskFn(null, true);
      mockEnqueue.mockRejectedValueOnce(new Error("Queue error"));

      const result = await executeWithRetry(taskFn, {
        ...defaultConfig,
        maxImmediateRetries: 1,
        enqueueOnFailure: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Task failed");
      expect(result.enqueuedJobId).toBeUndefined();
    });

    it("should use provided priority", async () => {
      const taskFn = createMockTaskFn(null, true);
      mockEnqueue.mockResolvedValueOnce("job-456");

      await executeWithRetry(taskFn, {
        ...defaultConfig,
        maxImmediateRetries: 1,
        priority: 10,
      });

      expect(mockEnqueue).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        { priority: 10, maxAttempts: 3 },
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle non-Error exceptions", async () => {
      const taskFn = jest.fn().mockRejectedValue("string error");

      const result = await executeWithRetry(taskFn, {
        ...defaultConfig,
        maxImmediateRetries: 1,
        enqueueOnFailure: false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("string error");
    });

    it("should return void data correctly", async () => {
      const taskFn = jest.fn().mockResolvedValue(undefined);

      const result = await executeWithRetry(taskFn, defaultConfig);

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });
});

// ============================================================================
// Tests: executeInBackground
// ============================================================================

describe("executeInBackground", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should execute task in background without blocking", () => {
    const taskFn = createMockTaskFn("result", false, 100);

    // This should return immediately
    executeInBackground(taskFn, defaultConfig);

    // Task should be called but not awaited
    expect(taskFn).toHaveBeenCalled();
  });

  it("should call onComplete callback when provided", async () => {
    const taskFn = createMockTaskFn("result");
    const onComplete = jest.fn();

    executeInBackground(taskFn, defaultConfig, onComplete);

    // Wait for background task to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onComplete).toHaveBeenCalledWith({
      success: true,
      data: "result",
    });
  });

  it("should call onComplete with failure result on error", async () => {
    const taskFn = createMockTaskFn(null, true);
    mockEnqueue.mockResolvedValueOnce("job-789");
    const onComplete = jest.fn();

    executeInBackground(taskFn, defaultConfig, onComplete);

    // Wait for background task to complete (including retry delays)
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Task failed",
        enqueuedJobId: "job-789",
      }),
    );
  });
});

// ============================================================================
// Tests: bookmarkAITasks
// ============================================================================

describe("bookmarkAITasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateContent", () => {
    it("should execute with correct job type", async () => {
      const taskFn = createMockTaskFn(undefined, true);
      mockEnqueue.mockResolvedValueOnce("job-content");

      bookmarkAITasks.generateContent(
        taskFn,
        "user-1",
        100,
        "https://example.com",
      );

      // Wait for background task
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockEnqueue).toHaveBeenCalledWith(
        "user-1",
        "generate_ai_content",
        { bookmarkId: 100, url: "https://example.com" },
        expect.objectContaining({ priority: 5 }),
      );
    });
  });

  describe("generateEmbedding", () => {
    it("should execute with correct job type and priority", async () => {
      const taskFn = createMockTaskFn(undefined, true);
      mockEnqueue.mockResolvedValueOnce("job-embedding");

      bookmarkAITasks.generateEmbedding(taskFn, "user-2", 200);

      // Wait for background task
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockEnqueue).toHaveBeenCalledWith(
        "user-2",
        "generate_embedding",
        { bookmarkId: 200 },
        expect.objectContaining({ priority: 3 }),
      );
    });
  });

  describe("classifyBookmark", () => {
    it("should execute with correct job type and priority", async () => {
      const taskFn = createMockTaskFn(undefined, true);
      mockEnqueue.mockResolvedValueOnce("job-classify");

      bookmarkAITasks.classifyBookmark(taskFn, "user-3", 300);

      // Wait for background task
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(mockEnqueue).toHaveBeenCalledWith(
        "user-3",
        "classify_bookmark",
        { bookmarkId: 300 },
        expect.objectContaining({ priority: 7 }),
      );
    });
  });
});

// ============================================================================
// Tests: Type Safety
// ============================================================================

describe("Type Safety", () => {
  it("should correctly type TaskResult", async () => {
    interface CustomData {
      id: number;
      name: string;
    }

    const taskFn = createMockTaskFn<CustomData>({ id: 1, name: "test" });

    const result: TaskResult<CustomData> = await executeWithRetry(
      taskFn,
      defaultConfig,
    );

    if (result.success && result.data) {
      // TypeScript should infer correct types
      expect(result.data.id).toBe(1);
      expect(result.data.name).toBe("test");
    }
  });
});
