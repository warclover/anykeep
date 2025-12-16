/**
 * Browser API Mock for testing
 * Mocks chrome.storage.local and browser.storage.local APIs
 */

import { vi } from "vitest";

// In-memory storage
let storageData: Record<string, unknown> = {};

// Storage change listeners
const changeListeners: Array<
  (
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    areaName: string,
  ) => void
> = [];

/**
 * Reset storage to initial state (call in beforeEach)
 */
export function resetMockStorage(): void {
  storageData = {};
}

/**
 * Get current storage data (for assertions)
 */
export function getMockStorageData(): Record<string, unknown> {
  return { ...storageData };
}

/**
 * Set initial storage data (for test setup)
 */
export function setMockStorageData(data: Record<string, unknown>): void {
  storageData = { ...data };
}

const mockStorage = {
  local: {
    get: vi.fn(
      async (keys?: string | string[] | Record<string, unknown> | null) => {
        if (!keys) {
          return { ...storageData };
        }
        if (typeof keys === "string") {
          return { [keys]: storageData[keys] };
        }
        if (Array.isArray(keys)) {
          const result: Record<string, unknown> = {};
          for (const key of keys) {
            if (key in storageData) {
              result[key] = storageData[key];
            }
          }
          return result;
        }
        // keys is an object with default values
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(keys)) {
          result[key] = key in storageData ? storageData[key] : keys[key];
        }
        return result;
      },
    ),

    set: vi.fn(async (items: Record<string, unknown>) => {
      const changes: Record<
        string,
        { oldValue?: unknown; newValue?: unknown }
      > = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = {
          oldValue: storageData[key],
          newValue: value,
        };
        storageData[key] = value;
      }
      // Notify listeners
      for (const listener of changeListeners) {
        listener(changes, "local");
      }
    }),

    remove: vi.fn(async (keys: string | string[]) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      const changes: Record<
        string,
        { oldValue?: unknown; newValue?: unknown }
      > = {};
      for (const key of keyArray) {
        if (key in storageData) {
          changes[key] = { oldValue: storageData[key], newValue: undefined };
          delete storageData[key];
        }
      }
      // Notify listeners
      for (const listener of changeListeners) {
        listener(changes, "local");
      }
    }),

    clear: vi.fn(async () => {
      const changes: Record<
        string,
        { oldValue?: unknown; newValue?: unknown }
      > = {};
      for (const [key, value] of Object.entries(storageData)) {
        changes[key] = { oldValue: value, newValue: undefined };
      }
      storageData = {};
      // Notify listeners
      for (const listener of changeListeners) {
        listener(changes, "local");
      }
    }),
  },

  onChanged: {
    addListener: vi.fn(
      (
        listener: (
          changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
          areaName: string,
        ) => void,
      ) => {
        changeListeners.push(listener);
      },
    ),
    removeListener: vi.fn(
      (
        listener: (
          changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
          areaName: string,
        ) => void,
      ) => {
        const index = changeListeners.indexOf(listener);
        if (index > -1) {
          changeListeners.splice(index, 1);
        }
      },
    ),
    hasListener: vi.fn(
      (
        listener: (
          changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
          areaName: string,
        ) => void,
      ) => {
        return changeListeners.includes(listener);
      },
    ),
  },
};

const mockRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(),
  },
  getURL: vi.fn(
    (path: string) => `chrome-extension://test-extension-id${path}`,
  ),
  id: "test-extension-id",
};

const mockTabs = {
  query: vi.fn(),
  get: vi.fn(),
  sendMessage: vi.fn(),
};

const mockNotifications = {
  create: vi.fn(),
  clear: vi.fn(),
};

const mockContextMenus = {
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  removeAll: vi.fn(),
  onClicked: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

// Export browser mock
export const browser = {
  storage: mockStorage,
  runtime: mockRuntime,
  tabs: mockTabs,
  notifications: mockNotifications,
  contextMenus: mockContextMenus,
};

// Also export as chrome for compatibility
export const chrome = browser;

export default browser;
