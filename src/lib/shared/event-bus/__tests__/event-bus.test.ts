/**
 * Event Bus Unit Tests
 */

import type { EventBus } from "../event-bus";
import { createEventBus } from "../event-bus";
import type { BookmarkClassifiedEvent } from "../event-types";

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = createEventBus({ async: false, debug: false });
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe("on/emit", () => {
    it("should call handler when event is emitted", () => {
      const handler = jest.fn();
      eventBus.on("classification:bookmark_classified", handler);

      const payload: BookmarkClassifiedEvent = {
        userId: "user-123",
        bookmarkId: 456,
        folderId: 789,
        folderName: "Tech",
        confidence: 0.85,
        action: "classify",
        timestamp: new Date().toISOString(),
      };

      eventBus.emit("classification:bookmark_classified", payload);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it("should call multiple handlers for same event", () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.on("classification:bookmark_classified", handler1);
      eventBus.on("classification:bookmark_classified", handler2);

      eventBus.emit("classification:bookmark_classified", {
        userId: "user-123",
        bookmarkId: 456,
        folderId: 789,
        folderName: "Tech",
        confidence: 0.85,
        action: "classify",
        timestamp: new Date().toISOString(),
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should not call handler for different event", () => {
      const handler = jest.fn();
      eventBus.on("classification:bookmark_classified", handler);

      eventBus.emit("organization:profile_updated", {
        userId: "user-123",
        folderId: 456,
        folderName: "Tech",
        bookmarkCount: 10,
        timestamp: new Date().toISOString(),
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("once", () => {
    it("should only call handler once", () => {
      const handler = jest.fn();
      eventBus.once("classification:bookmark_classified", handler);

      const payload: BookmarkClassifiedEvent = {
        userId: "user-123",
        bookmarkId: 456,
        folderId: 789,
        folderName: "Tech",
        confidence: 0.85,
        action: "classify",
        timestamp: new Date().toISOString(),
      };

      eventBus.emit("classification:bookmark_classified", payload);
      eventBus.emit("classification:bookmark_classified", payload);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("off", () => {
    it("should remove handler", () => {
      const handler = jest.fn();
      eventBus.on("classification:bookmark_classified", handler);
      eventBus.off("classification:bookmark_classified", handler);

      eventBus.emit("classification:bookmark_classified", {
        userId: "user-123",
        bookmarkId: 456,
        folderId: 789,
        folderName: "Tech",
        confidence: 0.85,
        action: "classify",
        timestamp: new Date().toISOString(),
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("should return unsubscribe function from on()", () => {
      const handler = jest.fn();
      const unsubscribe = eventBus.on(
        "classification:bookmark_classified",
        handler,
      );

      unsubscribe();

      eventBus.emit("classification:bookmark_classified", {
        userId: "user-123",
        bookmarkId: 456,
        folderId: 789,
        folderName: "Tech",
        confidence: 0.85,
        action: "classify",
        timestamp: new Date().toISOString(),
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("listenerCount", () => {
    it("should return correct count", () => {
      expect(eventBus.listenerCount("classification:bookmark_classified")).toBe(
        0,
      );

      eventBus.on("classification:bookmark_classified", jest.fn());
      expect(eventBus.listenerCount("classification:bookmark_classified")).toBe(
        1,
      );

      eventBus.on("classification:bookmark_classified", jest.fn());
      expect(eventBus.listenerCount("classification:bookmark_classified")).toBe(
        2,
      );
    });
  });

  describe("eventNames", () => {
    it("should return all registered event names", () => {
      eventBus.on("classification:bookmark_classified", jest.fn());
      eventBus.on("organization:profile_updated", jest.fn());

      const names = eventBus.eventNames();
      expect(names).toContain("classification:bookmark_classified");
      expect(names).toContain("organization:profile_updated");
    });
  });

  describe("removeAllListeners", () => {
    it("should remove all listeners for specific event", () => {
      eventBus.on("classification:bookmark_classified", jest.fn());
      eventBus.on("classification:bookmark_classified", jest.fn());
      eventBus.on("organization:profile_updated", jest.fn());

      eventBus.removeAllListeners("classification:bookmark_classified");

      expect(eventBus.listenerCount("classification:bookmark_classified")).toBe(
        0,
      );
      expect(eventBus.listenerCount("organization:profile_updated")).toBe(1);
    });

    it("should remove all listeners when no event specified", () => {
      eventBus.on("classification:bookmark_classified", jest.fn());
      eventBus.on("organization:profile_updated", jest.fn());

      eventBus.removeAllListeners();

      expect(eventBus.eventNames()).toHaveLength(0);
    });
  });

  describe("emitAsync", () => {
    it("should wait for all handlers to complete", async () => {
      const order: number[] = [];

      eventBus.on("classification:bookmark_classified", async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push(1);
      });

      eventBus.on("classification:bookmark_classified", async () => {
        await new Promise((r) => setTimeout(r, 5));
        order.push(2);
      });

      await eventBus.emitAsync("classification:bookmark_classified", {
        userId: "user-123",
        bookmarkId: 456,
        folderId: 789,
        folderName: "Tech",
        confidence: 0.85,
        action: "classify",
        timestamp: new Date().toISOString(),
      });

      expect(order).toContain(1);
      expect(order).toContain(2);
    });
  });

  describe("error handling", () => {
    it("should continue executing other handlers when one throws", () => {
      const handler1 = jest.fn(() => {
        throw new Error("Test error");
      });
      const handler2 = jest.fn();

      eventBus.on("classification:bookmark_classified", handler1);
      eventBus.on("classification:bookmark_classified", handler2);

      // Should not throw
      expect(() => {
        eventBus.emit("classification:bookmark_classified", {
          userId: "user-123",
          bookmarkId: 456,
          folderId: 789,
          folderName: "Tech",
          confidence: 0.85,
          action: "classify",
          timestamp: new Date().toISOString(),
        });
      }).not.toThrow();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });
});
