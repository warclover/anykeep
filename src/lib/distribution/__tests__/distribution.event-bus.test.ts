/**
 * DistributionEventBus 单元测试
 */

import { DistributionEventBus } from "../core/distribution.event-bus";
import type { DistributionEvent } from "../types";

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe("DistributionEventBus", () => {
  let eventBus: DistributionEventBus;

  beforeEach(() => {
    eventBus = new DistributionEventBus({ enableLogging: false });
  });

  describe("subscribe", () => {
    it("should subscribe to an event type", () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      eventBus.subscribe("bookmark_created", handler);

      expect(eventBus.getSubscriberCount("bookmark_created")).toBe(1);
    });

    it("should allow multiple handlers for same event type", () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      eventBus.subscribe("bookmark_created", handler1);
      eventBus.subscribe("bookmark_created", handler2);

      expect(eventBus.getSubscriberCount("bookmark_created")).toBe(2);
    });

    it("should return unsubscribe function", () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      const unsubscribe = eventBus.subscribe("bookmark_created", handler);
      expect(eventBus.getSubscriberCount("bookmark_created")).toBe(1);

      unsubscribe();
      expect(eventBus.getSubscriberCount("bookmark_created")).toBe(0);
    });
  });

  describe("subscribeAll", () => {
    it("should subscribe to all events", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      eventBus.subscribeAll(handler);

      await eventBus.publish({
        type: "bookmark_created",
        bookmarkId: "b1",
        userId: "u1",
      });
      await eventBus.publish({
        type: "bookmark_updated",
        bookmarkId: "b2",
        userId: "u1",
      });

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should be counted in subscriber count", () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      eventBus.subscribeAll(handler);

      expect(eventBus.getSubscriberCount("bookmark_created")).toBe(1);
      expect(eventBus.getSubscriberCount("bookmark_updated")).toBe(1);
    });
  });

  describe("publish", () => {
    it("should call subscribed handlers", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      eventBus.subscribe("bookmark_created", handler);

      const event: DistributionEvent = {
        type: "bookmark_created",
        bookmarkId: "bookmark-1",
        userId: "user-1",
      };

      await eventBus.publish(event);

      expect(handler).toHaveBeenCalledWith(event);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should not call handlers for other event types", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      eventBus.subscribe("bookmark_updated", handler);

      await eventBus.publish({
        type: "bookmark_created",
        bookmarkId: "bookmark-1",
        userId: "user-1",
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("should call all handlers for event type", async () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);
      eventBus.subscribe("bookmark_created", handler1);
      eventBus.subscribe("bookmark_created", handler2);

      await eventBus.publish({
        type: "bookmark_created",
        bookmarkId: "bookmark-1",
        userId: "user-1",
      });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("should continue when one handler fails", async () => {
      const failingHandler = jest
        .fn()
        .mockRejectedValue(new Error("Handler error"));
      const successHandler = jest.fn().mockResolvedValue(undefined);

      eventBus.subscribe("bookmark_created", failingHandler);
      eventBus.subscribe("bookmark_created", successHandler);

      // Should not throw
      await expect(
        eventBus.publish({
          type: "bookmark_created",
          bookmarkId: "bookmark-1",
          userId: "user-1",
        }),
      ).resolves.not.toThrow();

      expect(failingHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });

    it("should do nothing when no handlers subscribed", async () => {
      // Should not throw
      await expect(
        eventBus.publish({
          type: "bookmark_created",
          bookmarkId: "bookmark-1",
          userId: "user-1",
        }),
      ).resolves.not.toThrow();
    });

    it("should call both specific and global handlers", async () => {
      const specificHandler = jest.fn().mockResolvedValue(undefined);
      const globalHandler = jest.fn().mockResolvedValue(undefined);

      eventBus.subscribe("bookmark_created", specificHandler);
      eventBus.subscribeAll(globalHandler);

      await eventBus.publish({
        type: "bookmark_created",
        bookmarkId: "bookmark-1",
        userId: "user-1",
      });

      expect(specificHandler).toHaveBeenCalled();
      expect(globalHandler).toHaveBeenCalled();
    });
  });

  describe("getSubscriberCount", () => {
    it("should return 0 for unsubscribed event type", () => {
      expect(eventBus.getSubscriberCount("bookmark_created")).toBe(0);
    });

    it("should return correct count", () => {
      eventBus.subscribe(
        "bookmark_created",
        jest.fn().mockResolvedValue(undefined),
      );
      eventBus.subscribe(
        "bookmark_created",
        jest.fn().mockResolvedValue(undefined),
      );

      expect(eventBus.getSubscriberCount("bookmark_created")).toBe(2);
    });

    it("should include global handlers in count", () => {
      eventBus.subscribe(
        "bookmark_created",
        jest.fn().mockResolvedValue(undefined),
      );
      eventBus.subscribeAll(jest.fn().mockResolvedValue(undefined));

      expect(eventBus.getSubscriberCount("bookmark_created")).toBe(2);
    });
  });

  describe("getAllSubscriberCounts", () => {
    it("should return counts for all event types", () => {
      eventBus.subscribe(
        "bookmark_created",
        jest.fn().mockResolvedValue(undefined),
      );
      eventBus.subscribe(
        "bookmark_created",
        jest.fn().mockResolvedValue(undefined),
      );
      eventBus.subscribe(
        "bookmark_updated",
        jest.fn().mockResolvedValue(undefined),
      );
      eventBus.subscribeAll(jest.fn().mockResolvedValue(undefined));

      const counts = eventBus.getAllSubscriberCounts();

      expect(counts["bookmark_created"]).toBe(3); // 2 specific + 1 global
      expect(counts["bookmark_updated"]).toBe(2); // 1 specific + 1 global
      expect(counts["_global"]).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all handlers", () => {
      eventBus.subscribe(
        "bookmark_created",
        jest.fn().mockResolvedValue(undefined),
      );
      eventBus.subscribe(
        "bookmark_updated",
        jest.fn().mockResolvedValue(undefined),
      );
      eventBus.subscribeAll(jest.fn().mockResolvedValue(undefined));

      eventBus.clear();

      expect(eventBus.getSubscriberCount("bookmark_created")).toBe(0);
      expect(eventBus.getSubscriberCount("bookmark_updated")).toBe(0);
    });
  });

  describe("clearEventType", () => {
    it("should remove handlers for specific event type only", () => {
      eventBus.subscribe(
        "bookmark_created",
        jest.fn().mockResolvedValue(undefined),
      );
      eventBus.subscribe(
        "bookmark_updated",
        jest.fn().mockResolvedValue(undefined),
      );

      eventBus.clearEventType("bookmark_created");

      expect(eventBus.getSubscriberCount("bookmark_created")).toBe(0);
      expect(eventBus.getSubscriberCount("bookmark_updated")).toBe(1);
    });

    it("should not affect global handlers", () => {
      eventBus.subscribe(
        "bookmark_created",
        jest.fn().mockResolvedValue(undefined),
      );
      eventBus.subscribeAll(jest.fn().mockResolvedValue(undefined));

      eventBus.clearEventType("bookmark_created");

      // Global handler still there
      expect(eventBus.getSubscriberCount("bookmark_created")).toBe(1);
    });
  });

  describe("handler timeout", () => {
    it("should timeout slow handlers", async () => {
      // 创建一个短超时的事件总线
      const shortTimeoutBus = new DistributionEventBus({
        enableLogging: false,
        handlerTimeoutMs: 50,
      });

      const slowHandler = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 200)),
        );

      shortTimeoutBus.subscribe("bookmark_created", slowHandler);

      // Should not throw, but handler should timeout
      await expect(
        shortTimeoutBus.publish({
          type: "bookmark_created",
          bookmarkId: "bookmark-1",
          userId: "user-1",
        }),
      ).resolves.not.toThrow();

      expect(slowHandler).toHaveBeenCalled();
    });
  });

  describe("event types", () => {
    it("should handle bookmark_created event", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      eventBus.subscribe("bookmark_created", handler);

      await eventBus.publish({
        type: "bookmark_created",
        bookmarkId: "b1",
        userId: "u1",
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "bookmark_created" }),
      );
    });

    it("should handle bookmark_updated event", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      eventBus.subscribe("bookmark_updated", handler);

      await eventBus.publish({
        type: "bookmark_updated",
        bookmarkId: "b1",
        userId: "u1",
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "bookmark_updated" }),
      );
    });

    it("should handle bookmark_deleted event", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      eventBus.subscribe("bookmark_deleted", handler);

      await eventBus.publish({
        type: "bookmark_deleted",
        bookmarkId: "b1",
        userId: "u1",
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "bookmark_deleted" }),
      );
    });

    it("should handle manual_trigger event", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      eventBus.subscribe("manual_trigger", handler);

      await eventBus.publish({
        type: "manual_trigger",
        targetId: "t1",
        userId: "u1",
        bookmarkIds: ["b1", "b2"],
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "manual_trigger",
          bookmarkIds: ["b1", "b2"],
        }),
      );
    });

    it("should handle scheduled_trigger event", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      eventBus.subscribe("scheduled_trigger", handler);

      await eventBus.publish({
        type: "scheduled_trigger",
        targetId: "t1",
        userId: "u1",
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: "scheduled_trigger" }),
      );
    });
  });
});
