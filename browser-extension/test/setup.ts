/**
 * Vitest Setup File
 * Initializes test environment with browser API mocks and IndexedDB
 */

import "fake-indexeddb/auto";
import { beforeEach, vi } from "vitest";
import { browser, chrome, resetMockStorage } from "./mocks/browser";

// Make browser and chrome available globally
(globalThis as Record<string, unknown>).browser = browser;
(globalThis as Record<string, unknown>).chrome = chrome;

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  resetMockStorage();
});

// Mock console methods to reduce noise in tests (optional)
// vi.spyOn(console, 'log').mockImplementation(() => {})
// vi.spyOn(console, 'warn').mockImplementation(() => {})
// vi.spyOn(console, 'error').mockImplementation(() => {})

// Export for use in tests
export { browser, chrome, resetMockStorage };
export { setMockStorageData, getMockStorageData } from "./mocks/browser";
