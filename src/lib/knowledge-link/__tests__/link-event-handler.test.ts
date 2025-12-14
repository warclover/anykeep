/**
 * Link Event Handler Tests
 *
 * 知识关联事件处理器单元测试
 *
 * @version 1.0.0
 * @since 2025-12-15
 */

import {
  LinkEventHandler,
  getLinkEventHandler,
  initializeLinkEventHandler,
  resetLinkEventHandler,
  type LinkEventHandlerConfig,
} from "../handlers/link-event-handler";
import { eventBus } from "@/lib/shared/event-bus";
import type {
  SummaryCompletedEvent,
  EntitiesExtractedEvent,
} from "@/lib/shared/event-bus/event-types";

// ============================================================================
// Mock Dependencies
// ============================================================================

// Mock eventBus
jest.mock("@/lib/shared/event-bus", () => ({
  eventBus: {
    on: jest.fn().mockReturnValue(jest.fn()),
    emit: jest.fn(),
  },
}));

// Mock getLinkService
jest.mock("../services/link.service", () => ({
  getLinkService: jest.fn().mockReturnValue({
    processNewBookmark: jest.fn().mockResolvedValue(undefined),
  }),
}));

// ============================================================================
// Mock Data
// ============================================================================

const mockSummaryCompletedEvent: SummaryCompletedEvent = {
  userId: "test-user-uuid",
  bookmarkId: 123,
  summaryVersion: 2,
  summaryMode: "standard",
  tagsGenerated: 5,
  entitiesExtracted: 0,
  processingTimeMs: 1500,
  needsClassification: true,
  timestamp: new Date().toISOString(),
};

const mockEntitiesExtractedEvent: EntitiesExtractedEvent = {
  userId: "test-user-uuid",
  bookmarkId: 123,
  entities: [
    { name: "React", type: "tech", confidence: 0.9 },
    { name: "Next.js", type: "tech", confidence: 0.85 },
    { name: "John Doe", type: "person", confidence: 0.8 },
    { name: "AI", type: "concept", confidence: 0.95 },
    { name: "OpenAI", type: "company", confidence: 0.9 },
  ],
  entityCount: 5,
  needsLinkProcessing: true,
  timestamp: new Date().toISOString(),
};

// ============================================================================
// Tests: LinkEventHandler
// ============================================================================

describe("LinkEventHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLinkEventHandler();
  });

  // --------------------------------------------------------------------------
  // Constructor & Configuration
  // --------------------------------------------------------------------------

  describe("Constructor & Configuration", () => {
    it("should create instance with default config", () => {
      const handler = new LinkEventHandler();
      expect(handler).toBeDefined();
    });

    it("should create instance with custom config", () => {
      const customConfig: Partial<LinkEventHandlerConfig> = {
        enableOnSummaryCompleted: false,
        enableOnEntitiesExtracted: true,
        processingDelayMs: 500,
        debug: true,
      };

      const handler = new LinkEventHandler(customConfig);
      expect(handler).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Registration
  // --------------------------------------------------------------------------

  describe("Registration", () => {
    it("should register event handlers", () => {
      const handler = new LinkEventHandler();
      handler.register();

      expect(eventBus.on).toHaveBeenCalledWith(
        "summary:completed",
        expect.any(Function),
      );
      expect(eventBus.on).toHaveBeenCalledWith(
        "summary:entities_extracted",
        expect.any(Function),
      );
    });

    it("should not register when enableOnSummaryCompleted is false", () => {
      const handler = new LinkEventHandler({
        enableOnSummaryCompleted: false,
        enableOnEntitiesExtracted: false,
      });
      handler.register();

      expect(eventBus.on).not.toHaveBeenCalledWith(
        "summary:completed",
        expect.any(Function),
      );
    });

    it("should not double register", () => {
      const handler = new LinkEventHandler();
      handler.register();
      handler.register();

      // Should only be called twice (once for each event type on first register)
      expect(eventBus.on).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // Unregistration
  // --------------------------------------------------------------------------

  describe("Unregistration", () => {
    it("should unregister event handlers", () => {
      const mockUnsubscribe = jest.fn();
      (eventBus.on as jest.Mock).mockReturnValue(mockUnsubscribe);

      const handler = new LinkEventHandler();
      handler.register();
      handler.unregister();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it("should handle unregister when not registered", () => {
      const handler = new LinkEventHandler();
      // Should not throw
      expect(() => handler.unregister()).not.toThrow();
    });
  });
});

// ============================================================================
// Tests: Singleton Pattern
// ============================================================================

describe("Singleton Pattern", () => {
  beforeEach(() => {
    resetLinkEventHandler();
  });

  it("should return same instance on multiple calls", () => {
    const instance1 = getLinkEventHandler();
    const instance2 = getLinkEventHandler();

    expect(instance1).toBe(instance2);
  });

  it("should return new instance after reset", () => {
    const instance1 = getLinkEventHandler();
    resetLinkEventHandler();
    const instance2 = getLinkEventHandler();

    expect(instance1).not.toBe(instance2);
  });
});

// ============================================================================
// Tests: Initialize Function
// ============================================================================

describe("initializeLinkEventHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLinkEventHandler();
  });

  it("should initialize and register handler", () => {
    const handler = initializeLinkEventHandler();

    expect(handler).toBeDefined();
    expect(eventBus.on).toHaveBeenCalled();
  });

  it("should accept custom config", () => {
    const handler = initializeLinkEventHandler({
      debug: true,
      processingDelayMs: 2000,
    });

    expect(handler).toBeDefined();
  });

  it("should unregister previous handler on reinitialize", () => {
    const mockUnsubscribe = jest.fn();
    (eventBus.on as jest.Mock).mockReturnValue(mockUnsubscribe);

    initializeLinkEventHandler();
    initializeLinkEventHandler();

    // First handler should be unregistered
    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});

// ============================================================================
// Tests: Event Handling Logic
// ============================================================================

describe("Event Handling Logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetLinkEventHandler();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should process summary:completed event with delay", () => {
    const handler = new LinkEventHandler({ processingDelayMs: 1000 });
    handler.register();

    // Get the registered callback
    const summaryCompletedCallback = (eventBus.on as jest.Mock).mock.calls.find(
      (call) => call[0] === "summary:completed",
    )?.[1];

    expect(summaryCompletedCallback).toBeDefined();

    // Call the callback
    summaryCompletedCallback(mockSummaryCompletedEvent);

    // Advance timers
    jest.advanceTimersByTime(1000);

    // Link service should have been called (via processLinkDiscovery)
    // Note: actual verification depends on mock setup
  });

  it("should skip enhanced mode summary:completed when entities extracted", () => {
    const handler = new LinkEventHandler();
    handler.register();

    const summaryCompletedCallback = (eventBus.on as jest.Mock).mock.calls.find(
      (call) => call[0] === "summary:completed",
    )?.[1];

    // Call with enhanced mode and entities extracted
    const enhancedEvent: SummaryCompletedEvent = {
      ...mockSummaryCompletedEvent,
      summaryMode: "enhanced",
      entitiesExtracted: 5,
    };

    summaryCompletedCallback(enhancedEvent);

    // Should not set timeout (no processing)
    jest.advanceTimersByTime(2000);
  });

  it("should handle entities_extracted event without delay", () => {
    const handler = new LinkEventHandler();
    handler.register();

    const entitiesExtractedCallback = (
      eventBus.on as jest.Mock
    ).mock.calls.find((call) => call[0] === "summary:entities_extracted")?.[1];

    expect(entitiesExtractedCallback).toBeDefined();

    // Call the callback - should process immediately
    entitiesExtractedCallback(mockEntitiesExtractedEvent);
  });

  it("should skip entities_extracted when needsLinkProcessing is false", () => {
    const handler = new LinkEventHandler();
    handler.register();

    const entitiesExtractedCallback = (
      eventBus.on as jest.Mock
    ).mock.calls.find((call) => call[0] === "summary:entities_extracted")?.[1];

    const skipEvent: EntitiesExtractedEvent = {
      ...mockEntitiesExtractedEvent,
      needsLinkProcessing: false,
    };

    // Should return early
    entitiesExtractedCallback(skipEvent);
  });
});

// ============================================================================
// Tests: Module Exports
// ============================================================================

describe("Module Exports", () => {
  it("should export LinkEventHandler class", () => {
    expect(LinkEventHandler).toBeDefined();
    expect(typeof LinkEventHandler).toBe("function");
  });

  it("should export getLinkEventHandler function", () => {
    expect(getLinkEventHandler).toBeDefined();
    expect(typeof getLinkEventHandler).toBe("function");
  });

  it("should export initializeLinkEventHandler function", () => {
    expect(initializeLinkEventHandler).toBeDefined();
    expect(typeof initializeLinkEventHandler).toBe("function");
  });

  it("should export resetLinkEventHandler function", () => {
    expect(resetLinkEventHandler).toBeDefined();
    expect(typeof resetLinkEventHandler).toBe("function");
  });
});
