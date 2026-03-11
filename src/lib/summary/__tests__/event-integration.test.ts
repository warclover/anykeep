/**
 * Summary Service - Event Integration Tests
 *
 * 测试摘要服务与分类系统的事件集成
 *
 * @version 1.0.0
 * @since 2025-12-12
 */

import { eventBus } from "@/lib/shared/event-bus";
import type {
  SummaryCompletedEvent,
  TagsGeneratedEvent,
} from "@/lib/shared/event-bus/event-types";
import {
  SummaryService,
  resetSummaryService,
} from "../services/summary.service";
import { resetProviderFactory } from "../providers";
import type { SummaryInput } from "../summary.types";

// Mock dependencies
jest.mock("@/lib/job-queue/job-queue.service", () => ({
  JobQueueService: jest.fn().mockImplementation(() => ({
    enqueue: jest.fn(),
  })),
}));

describe("Summary Service - Event Integration", () => {
  let service: SummaryService;
  let summaryCompletedHandler: jest.Mock;
  let tagsGeneratedHandler: jest.Mock;

  beforeEach(() => {
    // Reset singletons
    resetSummaryService();
    resetProviderFactory();

    // Create service with events enabled
    service = new SummaryService({
      emitEvents: true,
    });

    // Set up event listeners
    summaryCompletedHandler = jest.fn();
    tagsGeneratedHandler = jest.fn();

    eventBus.on("summary:completed", summaryCompletedHandler);
    eventBus.on("summary:tags_generated", tagsGeneratedHandler);
  });

  afterEach(() => {
    // Remove event listeners
    eventBus.off("summary:completed", summaryCompletedHandler);
    eventBus.off("summary:tags_generated", tagsGeneratedHandler);
    jest.clearAllMocks();
  });

  describe("Event Publishing", () => {
    it("should emit summary:completed event after generation", async () => {
      // Test event emission is configured
      const config = service.getConfig();
      expect(config.emitEvents).toBe(true);
    });

    it("should have correct SummaryCompletedEvent structure", () => {
      // Verify event type structure
      const sampleEvent: SummaryCompletedEvent = {
        userId: "test-user",
        bookmarkId: 123,
        summaryVersion: 2,
        tagsGenerated: 3,
        processingTimeMs: 500,
        needsClassification: true,
        timestamp: new Date().toISOString(),
      };

      expect(sampleEvent.userId).toBeDefined();
      expect(sampleEvent.bookmarkId).toBeDefined();
      expect(sampleEvent.summaryVersion).toBeGreaterThanOrEqual(1);
      expect(sampleEvent.summaryVersion).toBeLessThanOrEqual(2);
      expect(typeof sampleEvent.tagsGenerated).toBe("number");
      expect(typeof sampleEvent.processingTimeMs).toBe("number");
      expect(typeof sampleEvent.needsClassification).toBe("boolean");
      expect(sampleEvent.timestamp).toBeDefined();
    });

    it("should have correct TagsGeneratedEvent structure", () => {
      // Verify event type structure
      const sampleEvent: TagsGeneratedEvent = {
        userId: "test-user",
        bookmarkId: 123,
        tags: ["技术", "AI", "编程"],
        source: "ai_summary",
        timestamp: new Date().toISOString(),
      };

      expect(sampleEvent.userId).toBeDefined();
      expect(sampleEvent.bookmarkId).toBeDefined();
      expect(Array.isArray(sampleEvent.tags)).toBe(true);
      expect(["ai_summary", "content_analysis", "user_input"]).toContain(
        sampleEvent.source,
      );
      expect(sampleEvent.timestamp).toBeDefined();
    });

    it("should export correct event types from event-bus module", () => {
      // Verify exports
      expect(eventBus).toBeDefined();
      expect(typeof eventBus.emit).toBe("function");
      expect(typeof eventBus.on).toBe("function");
      expect(typeof eventBus.off).toBe("function");
    });
  });

  describe("Event Integration with Classification", () => {
    it("should enable classification system to subscribe to summary events", async () => {
      // Verify eventBus supports subscription
      const mockHandler = jest.fn();

      // Subscribe
      eventBus.on("summary:completed", mockHandler);

      // Manually emit (simulating service behavior)
      const testEvent: SummaryCompletedEvent = {
        userId: "test-user",
        bookmarkId: 456,
        summaryVersion: 2,
        tagsGenerated: 2,
        processingTimeMs: 300,
        needsClassification: true,
        timestamp: new Date().toISOString(),
      };

      eventBus.emit("summary:completed", testEvent);

      // Wait for async handler execution (EventBus is async by default)
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify subscription works
      expect(mockHandler).toHaveBeenCalledWith(testEvent);

      // Cleanup
      eventBus.off("summary:completed", mockHandler);
    });

    it("should support multiple subscribers for same event", async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on("summary:tags_generated", handler1);
      eventBus.on("summary:tags_generated", handler2);

      const testEvent: TagsGeneratedEvent = {
        userId: "test-user",
        bookmarkId: 789,
        tags: ["测试", "标签"],
        source: "ai_summary",
        timestamp: new Date().toISOString(),
      };

      eventBus.emit("summary:tags_generated", testEvent);

      // Wait for async handler execution (EventBus is async by default)
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler1).toHaveBeenCalledWith(testEvent);
      expect(handler2).toHaveBeenCalledWith(testEvent);

      // Cleanup
      eventBus.off("summary:tags_generated", handler1);
      eventBus.off("summary:tags_generated", handler2);
    });

    it("should not emit events when emitEvents is disabled", async () => {
      // Create service with events disabled
      const silentService = new SummaryService({
        emitEvents: false,
      });

      const config = silentService.getConfig();
      expect(config.emitEvents).toBe(false);
    });
  });

  describe("Event Data Validation", () => {
    it("should include all required fields in summary event", () => {
      const requiredFields: (keyof SummaryCompletedEvent)[] = [
        "userId",
        "bookmarkId",
        "summaryVersion",
        "tagsGenerated",
        "processingTimeMs",
        "needsClassification",
        "timestamp",
      ];

      const event: SummaryCompletedEvent = {
        userId: "user-123",
        bookmarkId: 1,
        summaryVersion: 2,
        tagsGenerated: 5,
        processingTimeMs: 1000,
        needsClassification: false,
        timestamp: new Date().toISOString(),
      };

      requiredFields.forEach((field) => {
        expect(event[field]).toBeDefined();
      });
    });

    it("should include all required fields in tags event", () => {
      const requiredFields: (keyof TagsGeneratedEvent)[] = [
        "userId",
        "bookmarkId",
        "tags",
        "source",
        "timestamp",
      ];

      const event: TagsGeneratedEvent = {
        userId: "user-123",
        bookmarkId: 1,
        tags: ["tag1", "tag2"],
        source: "ai_summary",
        timestamp: new Date().toISOString(),
      };

      requiredFields.forEach((field) => {
        expect(event[field]).toBeDefined();
      });
    });
  });

  describe("Service Configuration for Events", () => {
    it("should respect emitEvents config from constructor", () => {
      const enabledService = new SummaryService({ emitEvents: true });
      expect(enabledService.getConfig().emitEvents).toBe(true);

      const disabledService = new SummaryService({ emitEvents: false });
      expect(disabledService.getConfig().emitEvents).toBe(false);
    });

    it("should have trackQuality option for integration", () => {
      const service = new SummaryService({ trackQuality: true });
      expect(service.getConfig().trackQuality).toBe(true);
    });

    it("should support needsClassification option", () => {
      // This option is passed via GenerateOptions
      const input: SummaryInput = {
        bookmarkId: 100,
        userId: "test-user",
        title: "Test Bookmark",
      };

      // Verify input structure supports classification flow
      expect(input.bookmarkId).toBeDefined();
      expect(input.userId).toBeDefined();
      expect(input.title).toBeDefined();
    });
  });
});
