/**
 * Profile Event Handler Service Unit Tests
 */

import {
  ProfileEventHandlerService,
  initProfileEventHandler,
  getProfileEventHandler,
  stopProfileEventHandler,
} from "../profile-event-handler.service";
import { eventBus, ClassificationEvents } from "@/lib/shared/event-bus";
import type { BookmarkClassifiedEvent } from "@/lib/shared/event-bus";

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  insert: jest.fn().mockResolvedValue({ error: null }),
  update: jest.fn().mockReturnThis(),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
} as unknown as Parameters<typeof initProfileEventHandler>[0];

describe("ProfileEventHandlerService", () => {
  let service: ProfileEventHandlerService;

  beforeEach(() => {
    // Reset event bus listeners
    eventBus.removeAllListeners();
    stopProfileEventHandler();
  });

  afterEach(() => {
    if (service) {
      service.stop();
    }
    stopProfileEventHandler();
  });

  describe("start/stop", () => {
    it("should subscribe to classification events on start", () => {
      service = new ProfileEventHandlerService(mockSupabaseClient);

      expect(
        eventBus.listenerCount(ClassificationEvents.BOOKMARK_CLASSIFIED),
      ).toBe(0);

      service.start();

      expect(
        eventBus.listenerCount(ClassificationEvents.BOOKMARK_CLASSIFIED),
      ).toBe(1);
    });

    it("should unsubscribe from events on stop", () => {
      service = new ProfileEventHandlerService(mockSupabaseClient);
      service.start();

      expect(
        eventBus.listenerCount(ClassificationEvents.BOOKMARK_CLASSIFIED),
      ).toBe(1);

      service.stop();

      expect(
        eventBus.listenerCount(ClassificationEvents.BOOKMARK_CLASSIFIED),
      ).toBe(0);
    });

    it("should not double subscribe on multiple starts", () => {
      service = new ProfileEventHandlerService(mockSupabaseClient);

      service.start();
      service.start(); // Second start should be ignored

      expect(
        eventBus.listenerCount(ClassificationEvents.BOOKMARK_CLASSIFIED),
      ).toBe(1);
    });

    it("should not subscribe when disabled", () => {
      service = new ProfileEventHandlerService(mockSupabaseClient, {
        enabled: false,
      });

      service.start();

      expect(
        eventBus.listenerCount(ClassificationEvents.BOOKMARK_CLASSIFIED),
      ).toBe(0);
    });
  });

  describe("singleton management", () => {
    it("should initialize handler singleton", () => {
      const handler = initProfileEventHandler(mockSupabaseClient);

      expect(handler).toBeInstanceOf(ProfileEventHandlerService);
      expect(getProfileEventHandler()).toBe(handler);
    });

    it("should return existing instance on re-initialization", () => {
      const handler1 = initProfileEventHandler(mockSupabaseClient);
      const handler2 = initProfileEventHandler(mockSupabaseClient);

      expect(handler1).toBe(handler2);
    });

    it("should clear instance on stop", () => {
      initProfileEventHandler(mockSupabaseClient);

      expect(getProfileEventHandler()).not.toBeNull();

      stopProfileEventHandler();

      expect(getProfileEventHandler()).toBeNull();
    });
  });

  describe("event handling", () => {
    it("should emit profile_updated event when classification has folderId", (done) => {
      service = new ProfileEventHandlerService(mockSupabaseClient);
      service.start();

      // Listen for profile updated event
      eventBus.on("organization:profile_updated", (event) => {
        expect(event.userId).toBe("user-123");
        expect(event.folderId).toBe(456);
        expect(event.folderName).toBe("Tech");
        done();
      });

      // Emit classification event
      const classificationEvent: BookmarkClassifiedEvent = {
        userId: "user-123",
        bookmarkId: 789,
        folderId: 456,
        folderName: "Tech",
        confidence: 85,
        action: "classify",
        timestamp: new Date().toISOString(),
      };

      eventBus.emit(
        ClassificationEvents.BOOKMARK_CLASSIFIED,
        classificationEvent,
      );
    });

    it("should not emit profile_updated when folderId is null", (done) => {
      service = new ProfileEventHandlerService(mockSupabaseClient);
      service.start();

      const profileUpdatedHandler = jest.fn();
      eventBus.on("organization:profile_updated", profileUpdatedHandler);

      // Emit classification event without folderId
      const classificationEvent: BookmarkClassifiedEvent = {
        userId: "user-123",
        bookmarkId: 789,
        folderId: null,
        folderName: null,
        confidence: 0,
        action: "inbox",
        timestamp: new Date().toISOString(),
      };

      eventBus.emit(
        ClassificationEvents.BOOKMARK_CLASSIFIED,
        classificationEvent,
      );

      // Wait a bit and check that handler was not called
      setTimeout(() => {
        expect(profileUpdatedHandler).not.toHaveBeenCalled();
        done();
      }, 100);
    });

    it("should not emit profile_updated when emitProfileUpdatedEvents is false", (done) => {
      service = new ProfileEventHandlerService(mockSupabaseClient, {
        emitProfileUpdatedEvents: false,
      });
      service.start();

      const profileUpdatedHandler = jest.fn();
      eventBus.on("organization:profile_updated", profileUpdatedHandler);

      // Emit classification event with folderId
      const classificationEvent: BookmarkClassifiedEvent = {
        userId: "user-123",
        bookmarkId: 789,
        folderId: 456,
        folderName: "Tech",
        confidence: 85,
        action: "classify",
        timestamp: new Date().toISOString(),
      };

      eventBus.emit(
        ClassificationEvents.BOOKMARK_CLASSIFIED,
        classificationEvent,
      );

      // Wait a bit and check that handler was not called
      setTimeout(() => {
        expect(profileUpdatedHandler).not.toHaveBeenCalled();
        done();
      }, 100);
    });
  });
});
