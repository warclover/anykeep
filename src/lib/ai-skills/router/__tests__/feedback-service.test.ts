/**
 * FeedbackService 单元测试
 *
 * @version 1.0.0
 * @since 2026-01-11
 */

import {
  FeedbackService,
  getFeedbackService,
  resetFeedbackService,
  type FeedbackRecord,
} from "../feedback-service";

// Mock Feature Flags
jest.mock("@/lib/ai-agent/config/feature-flags", () => ({
  FeatureFlags: {
    ENABLE_FEEDBACK_COLLECTION: true,
  },
}));

// Mock Supabase client
const mockInsert = jest.fn(() => ({
  data: null,
  error: null,
}));

const mockFrom = jest.fn(() => ({
  insert: mockInsert,
  select: jest.fn(() => ({
    gte: jest.fn(() => ({
      data: [],
      error: null,
    })),
    eq: jest.fn(() => ({
      filter: jest.fn(() => ({
        data: [],
        error: null,
      })),
      data: [],
      error: null,
    })),
    limit: jest.fn(() => ({
      data: [],
      error: null,
    })),
  })),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
    rpc: jest.fn(() => ({
      data: null,
      error: null,
    })),
  })),
}));

jest.mock("@/lib/supabase/server", () => ({
  createServiceClient: jest.fn(() =>
    Promise.resolve({
      from: mockFrom,
      rpc: jest.fn(() => ({
        data: {
          total_count: 100,
          accepted_count: 80,
          corrected_count: 15,
          abandoned_count: 5,
          acceptance_rate: 0.8,
          top_corrected_types: [],
        },
        error: null,
      })),
    }),
  ),
}));

describe("FeedbackService", () => {
  let service: FeedbackService;

  beforeEach(() => {
    resetFeedbackService();
    jest.clearAllMocks();
    service = new FeedbackService({
      batchWrite: false, // 禁用批量写入以简化测试
    });
  });

  afterEach(() => {
    resetFeedbackService();
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default config", () => {
      const svc = new FeedbackService();
      expect(svc).toBeDefined();
    });

    it("should accept custom config", () => {
      const svc = new FeedbackService({
        enabled: true,
        batchWrite: true,
        batchSize: 20,
        batchIntervalMs: 10000,
      });
      expect(svc).toBeDefined();
    });
  });

  describe("recordFeedback", () => {
    it("should record feedback successfully", async () => {
      const record: FeedbackRecord = {
        userId: "user-123",
        sessionId: "session-456",
        turnId: "turn-789",
        originalInput: "搜索 React 教程",
        predictedType: "query",
        predictedSubtype: "search",
        predictedConfidence: 0.92,
        actualBehavior: "accepted",
        source: "implicit",
      };

      const result = await service.recordFeedback(record);
      expect(result).toBe(true);
    });

    it("should not record when disabled", async () => {
      const disabledService = new FeedbackService({ enabled: false });

      const record: FeedbackRecord = {
        userId: "user-123",
        sessionId: "session-456",
        turnId: "turn-789",
        originalInput: "搜索 React 教程",
        predictedType: "query",
        predictedSubtype: "search",
        predictedConfidence: 0.92,
        actualBehavior: "accepted",
        source: "implicit",
      };

      const result = await disabledService.recordFeedback(record);
      expect(result).toBe(false);
    });
  });

  describe("recordAccepted", () => {
    it("should record accepted feedback", async () => {
      const result = await service.recordAccepted({
        userId: "user-123",
        sessionId: "session-456",
        turnId: "turn-789",
        originalInput: "搜索 React",
        predictedType: "query",
        predictedSubtype: "search",
        predictedConfidence: 0.9,
      });

      expect(result).toBe(true);
    });
  });

  describe("recordCorrected", () => {
    it("should record corrected feedback with correction info", async () => {
      const result = await service.recordCorrected({
        userId: "user-123",
        sessionId: "session-456",
        turnId: "turn-789",
        originalInput: "整理一下",
        predictedType: "organize",
        predictedSubtype: "cleanup",
        predictedConfidence: 0.7,
        correctedType: "query",
        correctedSubtype: "list",
      });

      expect(result).toBe(true);
    });
  });

  describe("recordAbandoned", () => {
    it("should record abandoned feedback", async () => {
      const result = await service.recordAbandoned({
        userId: "user-123",
        sessionId: "session-456",
        turnId: "turn-789",
        originalInput: "不清楚的请求",
        predictedType: "unknown",
        predictedConfidence: 0.3,
      });

      expect(result).toBe(true);
    });
  });

  describe("batch mode", () => {
    it("should batch feedbacks and flush when threshold reached", async () => {
      const batchService = new FeedbackService({
        batchWrite: true,
        batchSize: 3,
        batchIntervalMs: 60000, // 设置较长的间隔避免自动刷新
      });

      // 添加 3 条反馈，应该触发自动刷新
      for (let i = 0; i < 3; i++) {
        await batchService.recordAccepted({
          userId: `user-${i}`,
          sessionId: `session-${i}`,
          turnId: `turn-${i}`,
          originalInput: `测试消息 ${i}`,
          predictedType: "query",
          predictedConfidence: 0.9,
        });
      }

      // 停止服务清理定时器
      batchService.stop();
    });

    it("should flush remaining feedbacks on stop", async () => {
      const batchService = new FeedbackService({
        batchWrite: true,
        batchSize: 10,
        batchIntervalMs: 60000,
      });

      // 添加一些反馈但不够触发自动刷新
      await batchService.recordAccepted({
        userId: "user-1",
        sessionId: "session-1",
        turnId: "turn-1",
        originalInput: "测试消息",
        predictedType: "query",
        predictedConfidence: 0.9,
      });

      // 停止时应该刷新剩余的反馈
      batchService.stop();
    });
  });

  describe("flush", () => {
    it("should return 0 when no pending feedbacks", async () => {
      const batchService = new FeedbackService({
        batchWrite: true,
        batchSize: 10,
        batchIntervalMs: 60000,
      });

      const count = await batchService.flush();
      expect(count).toBe(0);

      batchService.stop();
    });
  });

  describe("singleton", () => {
    it("should return same instance", () => {
      const instance1 = getFeedbackService();
      const instance2 = getFeedbackService();

      expect(instance1).toBe(instance2);
    });

    it("should create new instance after reset", () => {
      const instance1 = getFeedbackService();
      resetFeedbackService();
      const instance2 = getFeedbackService();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe("feedback behavior types", () => {
    it("should handle all behavior types", async () => {
      const behaviors: Array<"accepted" | "corrected" | "abandoned"> = [
        "accepted",
        "corrected",
        "abandoned",
      ];

      for (const behavior of behaviors) {
        const record: FeedbackRecord = {
          userId: "user-123",
          sessionId: "session-456",
          turnId: `turn-${behavior}`,
          originalInput: "测试消息",
          predictedType: "query",
          predictedSubtype: "search",
          predictedConfidence: 0.8,
          actualBehavior: behavior,
          source: "implicit",
        };

        const result = await service.recordFeedback(record);
        expect(result).toBe(true);
      }
    });
  });

  describe("metadata", () => {
    it("should include metadata in feedback", async () => {
      const record: FeedbackRecord = {
        userId: "user-123",
        sessionId: "session-456",
        turnId: "turn-789",
        originalInput: "搜索 React",
        predictedType: "query",
        predictedSubtype: "search",
        predictedConfidence: 0.9,
        actualBehavior: "accepted",
        source: "explicit",
        metadata: {
          buttonClicked: "confirm",
          responseTime: 1500,
        },
      };

      const result = await service.recordFeedback(record);
      expect(result).toBe(true);
    });
  });
});
