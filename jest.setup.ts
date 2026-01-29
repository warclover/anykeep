// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import { randomUUID } from "crypto";

// =============================================================================
// Suppress Logger Output in Tests
// =============================================================================
// Mock the logger to prevent console noise during test runs
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
    })),
  },
}));

// Configure React act() environment for React 18
// This is required for async state updates in hook tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
import { TextEncoder, TextDecoder } from "util";
import { TransformStream, ReadableStream, WritableStream } from "stream/web";

// Polyfill crypto.randomUUID for Jest environment
if (typeof globalThis.crypto === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = {
    randomUUID,
  };
} else if (typeof globalThis.crypto.randomUUID === "undefined") {
  globalThis.crypto.randomUUID = randomUUID;
}

// Polyfill TextEncoder/TextDecoder for Jest environment
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.TextDecoder = TextDecoder as any;
}

// Polyfill Web Streams API for Jest environment (required by AI SDK)
if (typeof globalThis.TransformStream === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.TransformStream = TransformStream as any;
}
if (typeof globalThis.ReadableStream === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.ReadableStream = ReadableStream as any;
}
if (typeof globalThis.WritableStream === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.WritableStream = WritableStream as any;
}

// Set test environment variables
// These are required by env.ts but don't need real values in tests
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}
if (!process.env.NODE_ENV) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.env as any).NODE_ENV = "test";
}

// =============================================================================
// Global Supabase Server Mock
// =============================================================================
// Mock @/lib/supabase/server to avoid Next.js cookies() context issues in tests
// This must be done here because Jest's moduleNameMapper runs before jest.mock()

jest.mock("@/lib/supabase/server", () => {
  // Default mock responses storage
  const mockResponses: Record<string, unknown> = {};
  // Default thenable response storage (for awaitable chains)
  let defaultThenableResponse: { data: unknown; error: unknown } = {
    data: null,
    error: null,
  };

  const getMockResponse = (key: string) =>
    mockResponses[key] ?? { data: null, error: null };

  // Create a fully chainable mock that supports any chain pattern
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createFlexibleChainMock = (tableName: string): any => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chainMock: any = {};
    // Track operation type per chain instance
    let operationType: string = "select";

    // Operation methods - track which operation is being performed
    // Note: select() after insert/update/delete is for returning data, not a new operation
    const mutationMethods = ["insert", "update", "delete"];
    for (const method of mutationMethods) {
      chainMock[method] = jest.fn(() => {
        operationType = method;
        return chainMock;
      });
    }
    // select() only sets operation type if no mutation has been done
    chainMock.select = jest.fn(() => {
      if (operationType === "select") {
        operationType = "select";
      }
      // If operationType is already insert/update/delete, keep it
      return chainMock;
    });

    // Filter methods - just return chainMock
    const filterMethods = [
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
      "like",
      "ilike",
      "is",
      "in",
      "contains",
      "containedBy",
      "range",
      "textSearch",
      "match",
      "not",
      "or",
      "and",
      "filter",
      "order",
      "limit",
      "offset",
      "maybeSingle",
    ];
    for (const method of filterMethods) {
      chainMock[method] = jest.fn(() => chainMock);
    }

    // Terminal method: single - returns resolved response
    // Supports both new format (tableName.single) and legacy format (tableName.operation.single)
    chainMock.single = jest.fn(() => {
      // Check for legacy format first (e.g., "workflows.select.single")
      const legacyKey = `${tableName}.${operationType}.single`;
      if (mockResponses[legacyKey] !== undefined) {
        return Promise.resolve(mockResponses[legacyKey]);
      }
      // Check for new format (e.g., "workflows.single")
      const newKey = `${tableName}.single`;
      if (mockResponses[newKey] !== undefined) {
        return Promise.resolve(mockResponses[newKey]);
      }
      // Fallback to default
      return Promise.resolve({ data: null, error: null });
    });

    // Make chainMock thenable (awaitable) for direct await on chain
    chainMock.then = (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => {
      // Check for legacy format (e.g., "workflows.select.list")
      const legacyKey = `${tableName}.${operationType}.list`;
      if (mockResponses[legacyKey] !== undefined) {
        return Promise.resolve(mockResponses[legacyKey]).then(resolve, reject);
      }
      // Check for new format (e.g., "workflows.list")
      const newKey = `${tableName}.list`;
      if (mockResponses[newKey] !== undefined) {
        return Promise.resolve(mockResponses[newKey]).then(resolve, reject);
      }
      // Check operation-specific thenable (e.g., "workflows.update")
      const operationKey = `${tableName}.${operationType}`;
      if (mockResponses[operationKey] !== undefined) {
        return Promise.resolve(mockResponses[operationKey]).then(
          resolve,
          reject,
        );
      }
      return Promise.resolve(defaultThenableResponse).then(resolve, reject);
    };

    return chainMock;
  };

  const mockClient = {
    from: jest.fn((tableName: string) => {
      return createFlexibleChainMock(tableName);
    }),
    rpc: jest.fn((funcName: string) =>
      Promise.resolve(getMockResponse(`rpc.${funcName}`)),
    ),
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({ data: { user: null }, error: null }),
      ),
      getSession: jest.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }),
      ),
    },
  };

  return {
    createClient: jest.fn(() => Promise.resolve(mockClient)),
    createServiceClient: jest.fn(() => Promise.resolve(mockClient)),
    createServerSupabaseClient: jest.fn(() => Promise.resolve(mockClient)),
    // Expose internals for test configuration
    __mockClient: mockClient,
    __setMockResponse: (key: string, response: unknown) => {
      mockResponses[key] = response;
    },
    __setDefaultThenableResponse: (response: {
      data: unknown;
      error: unknown;
    }) => {
      defaultThenableResponse = response;
    },
    __resetMockResponses: () => {
      Object.keys(mockResponses).forEach((key) => delete mockResponses[key]);
      defaultThenableResponse = { data: null, error: null };
    },
    __getMockResponses: () => mockResponses,
  };
});

// =============================================================================
// NOTE: Workflow mocks removed after workflow-lite refactoring (2026-01-29)
// The following modules no longer exist:
// - @/lib/workflow/state/state-manager
// - @/lib/workflow/engine/execution-engine
// - @/lib/workflow/integration/semantic-matcher
// =============================================================================
