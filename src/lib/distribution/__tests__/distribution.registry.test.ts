/**
 * DistributionRegistry 单元测试
 */

import { DistributionRegistry } from "../core/distribution.registry";
import type { IDistributionAdapter } from "../interfaces";
import type { DistributionResult } from "../types";
import { AdapterNotFoundError } from "../errors";

// Mock Adapter 工厂
function createMockAdapter(
  type: "obsidian" | "notion" | "webhook" | "rss" | "manual_export",
  options?: {
    displayName?: string;
    supportedPlatforms?: ("web" | "mobile" | "desktop")[];
    dispose?: jest.Mock;
  },
): IDistributionAdapter {
  return {
    type,
    displayName: options?.displayName ?? `${type} Adapter`,
    supportedPlatforms: options?.supportedPlatforms ?? [
      "web",
      "mobile",
      "desktop",
    ],
    initialize: jest.fn().mockResolvedValue(undefined),
    distribute: jest.fn().mockResolvedValue({
      success: true,
      distributedCount: 1,
      failedCount: 0,
      records: [],
    } as DistributionResult),
    validateConfig: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
    testConnection: jest.fn().mockResolvedValue({ success: true }),
    dispose: options?.dispose,
  };
}

describe("DistributionRegistry", () => {
  let registry: DistributionRegistry;

  beforeEach(() => {
    registry = new DistributionRegistry();
  });

  describe("register", () => {
    it("should register an adapter", () => {
      const adapter = createMockAdapter("obsidian");
      registry.register(adapter);

      expect(registry.has("obsidian")).toBe(true);
      expect(registry.size).toBe(1);
    });

    it("should throw error when registering duplicate adapter", () => {
      const adapter1 = createMockAdapter("obsidian");
      const adapter2 = createMockAdapter("obsidian");

      registry.register(adapter1);

      expect(() => registry.register(adapter2)).toThrow("适配器已存在");
    });

    it("should allow registering multiple different adapters", () => {
      registry.register(createMockAdapter("obsidian"));
      registry.register(createMockAdapter("notion"));
      registry.register(createMockAdapter("webhook"));

      expect(registry.size).toBe(3);
    });
  });

  describe("unregister", () => {
    it("should unregister an adapter", () => {
      registry.register(createMockAdapter("obsidian"));

      const result = registry.unregister("obsidian");

      expect(result).toBe(true);
      expect(registry.has("obsidian")).toBe(false);
    });

    it("should return false when unregistering non-existent adapter", () => {
      const result = registry.unregister("obsidian");

      expect(result).toBe(false);
    });

    it("should call dispose when unregistering", () => {
      const dispose = jest.fn().mockResolvedValue(undefined);
      const adapter = createMockAdapter("obsidian", { dispose });
      registry.register(adapter);

      registry.unregister("obsidian");

      expect(dispose).toHaveBeenCalled();
    });
  });

  describe("get", () => {
    it("should return registered adapter", () => {
      const adapter = createMockAdapter("obsidian");
      registry.register(adapter);

      const result = registry.get("obsidian");

      expect(result).toBe(adapter);
    });

    it("should throw AdapterNotFoundError for non-existent adapter", () => {
      expect(() => registry.get("obsidian")).toThrow(AdapterNotFoundError);
    });
  });

  describe("tryGet", () => {
    it("should return registered adapter", () => {
      const adapter = createMockAdapter("obsidian");
      registry.register(adapter);

      const result = registry.tryGet("obsidian");

      expect(result).toBe(adapter);
    });

    it("should return undefined for non-existent adapter", () => {
      const result = registry.tryGet("obsidian");

      expect(result).toBeUndefined();
    });
  });

  describe("has", () => {
    it("should return true for registered adapter", () => {
      registry.register(createMockAdapter("obsidian"));

      expect(registry.has("obsidian")).toBe(true);
    });

    it("should return false for non-registered adapter", () => {
      expect(registry.has("obsidian")).toBe(false);
    });
  });

  describe("getTypes", () => {
    it("should return all registered types", () => {
      registry.register(createMockAdapter("obsidian"));
      registry.register(createMockAdapter("notion"));

      const types = registry.getTypes();

      expect(types).toContain("obsidian");
      expect(types).toContain("notion");
      expect(types).toHaveLength(2);
    });

    it("should return empty array when no adapters registered", () => {
      expect(registry.getTypes()).toEqual([]);
    });
  });

  describe("getAll", () => {
    it("should return all registered adapters", () => {
      const adapter1 = createMockAdapter("obsidian");
      const adapter2 = createMockAdapter("notion");
      registry.register(adapter1);
      registry.register(adapter2);

      const adapters = registry.getAll();

      expect(adapters).toContain(adapter1);
      expect(adapters).toContain(adapter2);
      expect(adapters).toHaveLength(2);
    });
  });

  describe("getAllMetadata", () => {
    it("should return metadata for all adapters", () => {
      registry.register(
        createMockAdapter("obsidian", { displayName: "Obsidian" }),
      );
      registry.register(createMockAdapter("notion", { displayName: "Notion" }));

      const metadata = registry.getAllMetadata();

      expect(metadata).toHaveLength(2);
      expect(metadata[0]).toMatchObject({
        type: expect.any(String),
        displayName: expect.any(String),
        supportedPlatforms: expect.any(Array),
      });
    });
  });

  describe("getByPlatform", () => {
    it("should return adapters supporting specified platform", () => {
      registry.register(
        createMockAdapter("obsidian", { supportedPlatforms: ["desktop"] }),
      );
      registry.register(
        createMockAdapter("notion", {
          supportedPlatforms: ["web", "mobile", "desktop"],
        }),
      );

      const desktopAdapters = registry.getByPlatform("desktop");
      const webAdapters = registry.getByPlatform("web");

      expect(desktopAdapters).toHaveLength(2);
      expect(webAdapters).toHaveLength(1);
      expect(webAdapters[0].type).toBe("notion");
    });

    it("should return empty array when no adapters support platform", () => {
      registry.register(
        createMockAdapter("obsidian", { supportedPlatforms: ["desktop"] }),
      );

      const mobileAdapters = registry.getByPlatform("mobile");

      expect(mobileAdapters).toEqual([]);
    });
  });

  describe("getMetadataByPlatform", () => {
    it("should return metadata for adapters supporting specified platform", () => {
      registry.register(
        createMockAdapter("obsidian", { supportedPlatforms: ["desktop"] }),
      );
      registry.register(
        createMockAdapter("notion", {
          supportedPlatforms: ["web", "mobile", "desktop"],
        }),
      );

      const desktopMetadata = registry.getMetadataByPlatform("desktop");

      expect(desktopMetadata).toHaveLength(2);
    });
  });

  describe("size", () => {
    it("should return correct count", () => {
      expect(registry.size).toBe(0);

      registry.register(createMockAdapter("obsidian"));
      expect(registry.size).toBe(1);

      registry.register(createMockAdapter("notion"));
      expect(registry.size).toBe(2);

      registry.unregister("obsidian");
      expect(registry.size).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all adapters", async () => {
      registry.register(createMockAdapter("obsidian"));
      registry.register(createMockAdapter("notion"));

      await registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getTypes()).toEqual([]);
    });

    it("should call dispose on all adapters", async () => {
      const dispose1 = jest.fn().mockResolvedValue(undefined);
      const dispose2 = jest.fn().mockResolvedValue(undefined);

      registry.register(createMockAdapter("obsidian", { dispose: dispose1 }));
      registry.register(createMockAdapter("notion", { dispose: dispose2 }));

      await registry.clear();

      expect(dispose1).toHaveBeenCalled();
      expect(dispose2).toHaveBeenCalled();
    });

    it("should handle dispose errors gracefully", async () => {
      const dispose = jest.fn().mockRejectedValue(new Error("Dispose failed"));
      registry.register(createMockAdapter("obsidian", { dispose }));

      // Should not throw
      await expect(registry.clear()).resolves.not.toThrow();
      expect(registry.size).toBe(0);
    });
  });
});
